'use strict';
const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);
const LONGITUD = 64;

/** Devuelve "sal:hash" en hexadecimal usando scrypt (sin dependencias externas). */
async function hashPassword(plano) {
  const sal = crypto.randomBytes(16).toString('hex');
  const hash = await scrypt(plano, sal, LONGITUD);
  return `${sal}:${hash.toString('hex')}`;
}

/** Comparación en tiempo constante para evitar ataques de temporización. */
async function verificarPassword(plano, almacenado) {
  const [sal, hashHex] = String(almacenado).split(':');
  if (!sal || !hashHex) return false;
  const esperado = Buffer.from(hashHex, 'hex');
  const calculado = await scrypt(plano, sal, esperado.length);
  return crypto.timingSafeEqual(esperado, calculado);
}

module.exports = { hashPassword, verificarPassword };
