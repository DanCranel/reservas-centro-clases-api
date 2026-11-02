'use strict';
const { errores } = require('../domain/errors');
const { validar } = require('../domain/validators');
const R = require('../domain/reservas');
const { detectarTipo } = require('../domain/archivos');
const { enTransaccion } = require('../db/connection');
const { exigirValido } = require('./authService');

const esAdmin = (usuario) => usuario.rol === 'admin';

/**
 * Orquesta reglas puras (domain) y E/S (repositorios, archivos, notificaciones).
 * Dependencias inyectadas -> fácil de probar con una BD en memoria y un reloj fijo.
 */
function crearReservasService({ db, reservasRepo, serviciosRepo, archivos, notificar, hoy }) {
  const destino = (fila) => ({ usuarioId: fila.usuario_id });

  const obtenerFila = (id) => {
    const fila = reservasRepo.buscarPorId(id);
    if (!fila) throw errores.noEncontrado('La reserva');
    return fila;
  };

  const obtenerConAcceso = (usuario, id) => {
    const fila = obtenerFila(id);
    if (!esAdmin(usuario) && fila.usuario_id !== usuario.id) throw errores.prohibido();
    return fila;
  };

  /** Reglas que requieren consultar la BD: servicio activo, cupo y duplicados. */
  function verificarDisponibilidad({ servicioId, usuarioId, estudianteNombre, fecha, inicio, fin, excluirId }) {
    const servicio = serviciosRepo.buscarPorId(servicioId);
    if (!servicio) throw errores.validacion([{ campo: 'servicioId', mensaje: 'el servicio no existe' }]);
    if (servicio.activo !== 1) throw errores.conflicto('SERVICIO_INACTIVO', 'El servicio no está disponible.');

    const nueva = { inicio, fin };
    const cruces = (filas) => filas
      .filter((f) => f.id !== excluirId)
      .filter((f) => R.seSolapan(nueva, { inicio: f.inicio_min, fin: f.fin_min }));

    const ocupados = cruces(reservasRepo.activasDelServicio(servicioId, fecha)).length;
    if (ocupados >= servicio.cupo) {
      throw errores.conflicto('CUPO_LLENO', 'No hay cupos disponibles en ese horario.', { cupo: servicio.cupo, ocupados });
    }
    const mismoEstudiante = cruces(reservasRepo.activasDelUsuario(usuarioId, fecha))
      .some((f) => f.estudiante_nombre.toLowerCase() === estudianteNombre.toLowerCase());
    if (mismoEstudiante) {
      throw errores.conflicto('RESERVA_DUPLICADA', 'Ese estudiante ya tiene una reserva que se cruza con ese horario.');
    }
  }

  const exigirHorarioValido = (datos) => {
    const errs = R.erroresDeHorario(datos, hoy());
    if (errs.length) throw errores.validacion(errs);
  };

  function listar(usuario, query) {
    const r = validar(R.esquemaFiltros, query);
    if (!r.ok) throw errores.validacion(r.errores);
    const { page = 1, limit = 20, ...filtros } = r.value;
    const { filas, total } = reservasRepo.listar({
      ...filtros,
      usuarioId: esAdmin(usuario) ? undefined : usuario.id,
      limit,
      offset: (page - 1) * limit,
    });
    return { data: filas.map(R.aDTO), meta: { page, limit, total, paginas: Math.ceil(total / limit) } };
  }

  const obtener = (usuario, id) => R.aDTO(obtenerConAcceso(usuario, id));

  function crear(usuario, entrada) {
    const datos = exigirValido(R.esquemaCrear, entrada);
    const { inicio, fin } = R.intervalo(datos.horaInicio, datos.duracionMin);
    exigirHorarioValido({ fecha: datos.fecha, inicio, fin });

    const id = enTransaccion(db, () => {
      verificarDisponibilidad({ ...datos, usuarioId: usuario.id, inicio, fin });
      return reservasRepo.insertar({ ...datos, usuarioId: usuario.id, inicio, fin });
    });
    const fila = obtenerFila(id);
    const dto = R.aDTO(fila);
    notificar('reserva:creada', dto, destino(fila));
    return dto;
  }

  function actualizar(usuario, id, entrada) {
    const { version, ...cambios } = exigirValido(R.esquemaActualizar, entrada);

    const fila = enTransaccion(db, () => {
      const actual = obtenerConAcceso(usuario, id);
      if (actual.version !== version) {
        throw errores.conflicto('VERSION_CONFLICTO', 'La reserva fue modificada por otra persona. Recargue e intente de nuevo.',
          { versionActual: actual.version });
      }
      if (actual.estado === 'cancelada') throw errores.conflicto('RESERVA_CANCELADA', 'Una reserva cancelada no se puede modificar.');
      if (cambios.estado && !esAdmin(usuario) && cambios.estado !== 'cancelada' && cambios.estado !== actual.estado) {
        throw errores.prohibido(); // solo administración confirma reservas
      }
      if (cambios.estado && !R.transicionPermitida(actual.estado, cambios.estado)) {
        throw errores.conflicto('TRANSICION_INVALIDA', `No se puede pasar de "${actual.estado}" a "${cambios.estado}".`);
      }

      const nueva = R.aplicarCambios(actual, cambios);
      if (R.cambiaHorario(cambios)) {
        exigirHorarioValido({ fecha: nueva.fecha, inicio: nueva.inicio_min, fin: nueva.fin_min });
        verificarDisponibilidad({
          servicioId: nueva.servicio_id, usuarioId: nueva.usuario_id, estudianteNombre: nueva.estudiante_nombre,
          fecha: nueva.fecha, inicio: nueva.inicio_min, fin: nueva.fin_min, excluirId: actual.id,
        });
      }
      reservasRepo.actualizar(id, version, nueva);
      return obtenerFila(id);
    });
    const dto = R.aDTO(fila);
    notificar('reserva:actualizada', dto, destino(fila));
    return dto;
  }

  async function eliminar(usuario, id) {
    const fila = obtenerConAcceso(usuario, id);
    if (!esAdmin(usuario) && fila.estado !== 'pendiente') {
      throw errores.conflicto('RESERVA_NO_ELIMINABLE', 'Solo se pueden eliminar reservas pendientes; cancele la reserva.');
    }
    reservasRepo.eliminar(id);
    await archivos.eliminar(fila.comprobante_archivo);
    notificar('reserva:eliminada', { id }, destino(fila));
  }

  async function adjuntarComprobante(usuario, id, archivo) {
    const fila = obtenerConAcceso(usuario, id);
    if (!archivo) throw errores.validacion([{ campo: 'comprobante', mensaje: 'debe adjuntar un archivo' }]);
    const tipo = detectarTipo(archivo.buffer);
    if (!tipo) throw errores.archivoInvalido('Solo se aceptan comprobantes PDF, PNG o JPG.');

    const nombre = await archivos.guardar(archivo.buffer, tipo.ext);
    reservasRepo.guardarComprobante(id, nombre, tipo.tipo);
    await archivos.eliminar(fila.comprobante_archivo); // reemplaza el anterior
    const actualizada = obtenerFila(id);
    const dto = R.aDTO(actualizada);
    notificar('reserva:comprobante', dto, destino(actualizada));
    return dto;
  }

  function obtenerComprobante(usuario, id) {
    const fila = obtenerConAcceso(usuario, id);
    if (!fila.comprobante_archivo) throw errores.noEncontrado('El comprobante');
    return { ruta: archivos.ruta(fila.comprobante_archivo), tipo: fila.comprobante_tipo };
  }

  return { listar, obtener, crear, actualizar, eliminar, adjuntarComprobante, obtenerComprobante };
}

module.exports = { crearReservasService };
