'use strict';
/**
 * Detección del tipo REAL de archivo por sus "números mágicos" (primeros bytes),
 * sin confiar en la extensión ni en el Content-Type que envía el cliente.
 */
const FIRMAS = [
  { tipo: 'application/pdf', ext: 'pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { tipo: 'image/png', ext: 'png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { tipo: 'image/jpeg', ext: 'jpg', bytes: [0xff, 0xd8, 0xff] },
];

const coincide = (buffer, bytes) => buffer.length >= bytes.length && bytes.every((b, i) => buffer[i] === b);

const detectarTipo = (buffer) => FIRMAS.find((f) => coincide(buffer, f.bytes)) ?? null;

module.exports = { detectarTipo, TIPOS_PERMITIDOS: FIRMAS.map((f) => f.tipo) };
