'use strict';
const { hashPassword } = require('../domain/passwords');

const SERVICIOS = [
  { nombre: 'Resolución de tareas', descripcion: 'Acompañamiento en deberes de escuela y colegio.', precio_centavos: 500, cupo: 6 },
  { nombre: 'Clases de recuperación', descripcion: 'Refuerzo en matemáticas, física y lenguaje.', precio_centavos: 800, cupo: 4 },
  { nombre: 'Control de tareas', descripcion: 'Revisión diaria de cuadernos y plataformas.', precio_centavos: 400, cupo: 8 },
  { nombre: 'Programación para niños', descripcion: 'Lógica y Scratch para 8 a 14 años.', precio_centavos: 1000, cupo: 5 },
];

/** Inserta datos iniciales solo si la base está vacía (idempotente). */
async function sembrar(db) {
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM usuarios').get();
  if (total > 0) return false;

  const insUsuario = db.prepare('INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)');
  insUsuario.run('Administración Tejiendo Redes', 'admin@tejiendoredes.ec', await hashPassword('Admin123!'), 'admin');
  insUsuario.run('María Pérez', 'maria@correo.com', await hashPassword('Maria123!'), 'estudiante');

  const insServicio = db.prepare('INSERT INTO servicios (nombre, descripcion, precio_centavos, cupo) VALUES (?, ?, ?, ?)');
  SERVICIOS.forEach((s) => insServicio.run(s.nombre, s.descripcion, s.precio_centavos, s.cupo));
  return true;
}

module.exports = { sembrar };

if (require.main === module) {
  const config = require('../config');
  const { abrirBaseDeDatos } = require('./connection');
  sembrar(abrirBaseDeDatos(config.dbFile)).then((hecho) =>
    console.log(hecho ? 'Datos de ejemplo insertados.' : 'La base ya tenía datos; no se modificó.'));
}
