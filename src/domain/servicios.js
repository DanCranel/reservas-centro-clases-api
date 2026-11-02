'use strict';
const v = require('./validators');

const esquemaServicio = {
  nombre: { regla: v.texto({ min: 3, max: 80 }) },
  descripcion: { regla: v.texto({ max: 300 }), requerido: false },
  precioCentavos: { regla: v.entero({ min: 0, max: 100000 }) },
  cupo: { regla: v.entero({ min: 1, max: 30 }) },
  activo: { regla: v.booleano(), requerido: false },
};

const esquemaActualizarServicio = {
  ...esquemaServicio,
  version: { regla: v.entero({ min: 1 }) },
};

/** "Inglés Básico" y "ingles basico" se consideran el mismo nombre (pura). */
const normalizarNombre = (nombre) =>
  nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const nombreRepetido = (nombre, existentes, excluirId) =>
  existentes.some((s) => s.id !== excluirId && normalizarNombre(s.nombre) === normalizarNombre(nombre));

const aDTO = (fila) => ({
  id: fila.id,
  nombre: fila.nombre,
  descripcion: fila.descripcion,
  precioCentavos: fila.precio_centavos,
  precio: (fila.precio_centavos / 100).toFixed(2),
  cupo: fila.cupo,
  activo: fila.activo === 1,
  version: fila.version,
});

module.exports = { esquemaServicio, esquemaActualizarServicio, normalizarNombre, nombreRepetido, aDTO };
