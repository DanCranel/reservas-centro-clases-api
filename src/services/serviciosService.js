'use strict';
const { errores } = require('../domain/errors');
const servicios = require('../domain/servicios');
const { exigirValido } = require('./authService');

const esUnicoViolado = (err) => /UNIQUE constraint failed/i.test(err?.message ?? '');

function crearServiciosService({ serviciosRepo, notificar }) {
  const obtenerFila = (id) => {
    const fila = serviciosRepo.buscarPorId(id);
    if (!fila) throw errores.noEncontrado('El servicio');
    return fila;
  };

  const conNombreUnico = (nombre, excluirId, fn) => {
    if (servicios.nombreRepetido(nombre, serviciosRepo.listar({ soloActivos: false }), excluirId)) {
      throw errores.conflicto('NOMBRE_DUPLICADO', 'Ya existe un servicio con ese nombre.');
    }
    try { // la restricción UNIQUE de la BD es la última línea de defensa
      return fn();
    } catch (err) {
      if (esUnicoViolado(err)) throw errores.conflicto('NOMBRE_DUPLICADO', 'Ya existe un servicio con ese nombre.');
      throw err;
    }
  };

  return {
    listar: ({ esAdmin }) => serviciosRepo.listar({ soloActivos: !esAdmin }).map(servicios.aDTO),

    obtener: (id) => servicios.aDTO(obtenerFila(id)),

    crear(entrada) {
      const datos = exigirValido(servicios.esquemaServicio, entrada);
      const id = conNombreUnico(datos.nombre, undefined, () => serviciosRepo.insertar(datos));
      const dto = servicios.aDTO(obtenerFila(id));
      notificar('servicio:creado', dto);
      return dto;
    },

    actualizar(id, entrada) {
      const { version, ...datos } = exigirValido(servicios.esquemaActualizarServicio, entrada);
      const actual = obtenerFila(id);
      const cambios = conNombreUnico(datos.nombre, id, () => serviciosRepo.actualizar(id, version, datos));
      if (cambios === 0) {
        throw errores.conflicto('VERSION_CONFLICTO', 'El servicio fue modificado por otra persona. Recargue e intente de nuevo.',
          { versionActual: actual.version });
      }
      const dto = servicios.aDTO(obtenerFila(id));
      notificar('servicio:actualizado', dto);
      return dto;
    },

    eliminar(id) {
      obtenerFila(id);
      if (serviciosRepo.contarReservas(id) > 0) {
        throw errores.conflicto('SERVICIO_CON_RESERVAS',
          'No se puede eliminar un servicio con reservas; desactívelo con activo=false.');
      }
      serviciosRepo.eliminar(id);
      notificar('servicio:eliminado', { id });
    },
  };
}

module.exports = { crearServiciosService };
