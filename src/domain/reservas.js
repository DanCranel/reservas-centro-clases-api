'use strict';
/** Reglas de negocio de reservas: funciones puras, sin acceso a BD ni a HTTP. */
const v = require('./validators');

const DURACIONES = [60, 90, 120];
const ESTADOS = ['pendiente', 'confirmada', 'cancelada'];
const APERTURA_MIN = 8 * 60; // 08:00
const CIERRE_MIN = 20 * 60; // 20:00
const DIAS_HABILES = [1, 2, 3, 4, 5, 6]; // lunes a sábado

const TRANSICIONES = Object.freeze({
  pendiente: ['confirmada', 'cancelada'],
  confirmada: ['cancelada'],
  cancelada: [],
});

const esquemaCrear = {
  servicioId: { regla: v.entero({ min: 1 }) },
  estudianteNombre: { regla: v.texto({ min: 2, max: 80 }) },
  fecha: { regla: v.fechaISO() },
  horaInicio: { regla: v.hora() },
  duracionMin: { regla: v.unoDe(DURACIONES) },
  notas: { regla: v.texto({ max: 500 }), requerido: false },
};

const esquemaActualizar = {
  version: { regla: v.entero({ min: 1 }) }, // obligatorio: control de concurrencia optimista
  estudianteNombre: { regla: v.texto({ min: 2, max: 80 }), requerido: false },
  fecha: { regla: v.fechaISO(), requerido: false },
  horaInicio: { regla: v.hora(), requerido: false },
  duracionMin: { regla: v.unoDe(DURACIONES), requerido: false },
  notas: { regla: v.texto({ max: 500 }), requerido: false },
  estado: { regla: v.unoDe(ESTADOS), requerido: false },
};

const esquemaFiltros = {
  fecha: { regla: v.fechaISO(), requerido: false },
  estado: { regla: v.unoDe(ESTADOS), requerido: false },
  servicioId: { regla: v.entero({ min: 1 }), requerido: false },
  page: { regla: v.entero({ min: 1, max: 10000 }), requerido: false },
  limit: { regla: v.entero({ min: 1, max: 100 }), requerido: false },
};

const horaAMinutos = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const minutosAHora = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

const diaDeSemana = (fechaISO) => new Date(`${fechaISO}T12:00:00Z`).getUTCDay();

/** Dos intervalos [a1,a2) y [b1,b2) se cruzan si cada uno empieza antes de que termine el otro. */
const seSolapan = (a, b) => a.inicio < b.fin && b.inicio < a.fin;

/** Construye el intervalo de una reserva a partir de hora de inicio y duración. */
const intervalo = (horaInicio, duracionMin) => {
  const inicio = horaAMinutos(horaInicio);
  return { inicio, fin: inicio + duracionMin };
};

/**
 * Verifica fecha y horario de atención. `hoy` se recibe como parámetro
 * para que la función sea determinista y fácil de probar.
 */
function erroresDeHorario({ fecha, inicio, fin }, hoy) {
  return [
    fecha < hoy && { campo: 'fecha', mensaje: 'no puede estar en el pasado' },
    !DIAS_HABILES.includes(diaDeSemana(fecha)) && { campo: 'fecha', mensaje: 'el centro atiende de lunes a sábado' },
    inicio < APERTURA_MIN && { campo: 'horaInicio', mensaje: 'el centro abre a las 08:00' },
    fin > CIERRE_MIN && { campo: 'horaInicio', mensaje: 'la clase debe terminar hasta las 20:00' },
  ].filter(Boolean);
}

const transicionPermitida = (desde, hacia) => desde === hacia || TRANSICIONES[desde].includes(hacia);

/** Combina la reserva actual con los cambios y devuelve un objeto NUEVO. */
function aplicarCambios(actual, cambios) {
  const horaInicio = cambios.horaInicio ?? minutosAHora(actual.inicio_min);
  const duracion = cambios.duracionMin ?? actual.fin_min - actual.inicio_min;
  const { inicio, fin } = intervalo(horaInicio, duracion);
  return {
    ...actual,
    estudiante_nombre: cambios.estudianteNombre ?? actual.estudiante_nombre,
    fecha: cambios.fecha ?? actual.fecha,
    inicio_min: inicio,
    fin_min: fin,
    notas: cambios.notas ?? actual.notas,
    estado: cambios.estado ?? actual.estado,
  };
}

const cambiaHorario = (cambios) => ['fecha', 'horaInicio', 'duracionMin'].some((k) => k in cambios);

/** Transforma una fila de BD al contrato público de la API. */
const aDTO = (fila) => ({
  id: fila.id,
  usuarioId: fila.usuario_id,
  servicio: { id: fila.servicio_id, nombre: fila.servicio_nombre },
  estudianteNombre: fila.estudiante_nombre,
  fecha: fila.fecha,
  horaInicio: minutosAHora(fila.inicio_min),
  horaFin: minutosAHora(fila.fin_min),
  duracionMin: fila.fin_min - fila.inicio_min,
  notas: fila.notas,
  estado: fila.estado,
  tieneComprobante: Boolean(fila.comprobante_archivo),
  version: fila.version,
  creadoEn: fila.creado_en,
  actualizadoEn: fila.actualizado_en,
});

module.exports = {
  DURACIONES, ESTADOS, esquemaCrear, esquemaActualizar, esquemaFiltros,
  horaAMinutos, minutosAHora, seSolapan, intervalo, erroresDeHorario,
  transicionPermitida, aplicarCambios, cambiaHorario, aDTO,
};
