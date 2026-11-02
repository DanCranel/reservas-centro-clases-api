'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

/** Abre (o crea) la base de datos y aplica el esquema. */
function abrirBaseDeDatos(archivo) {
  if (archivo !== ':memory:') fs.mkdirSync(path.dirname(archivo), { recursive: true });
  const db = new DatabaseSync(archivo);
  db.exec('PRAGMA foreign_keys = ON;');
  if (archivo !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  return db;
}

/**
 * Ejecuta fn dentro de una transacción. BEGIN IMMEDIATE toma el bloqueo de
 * escritura al inicio, así la verificación de cupo y la inserción son atómicas.
 */
function enTransaccion(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const resultado = fn();
    db.exec('COMMIT');
    return resultado;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

module.exports = { abrirBaseDeDatos, enTransaccion };
