'use strict';
/** Acceso a datos de usuarios. Todas las consultas son parametrizadas (sin concatenar entrada). */
function crearUsuariosRepo(db) {
  const q = {
    porEmail: db.prepare('SELECT * FROM usuarios WHERE email = ?'),
    porId: db.prepare('SELECT * FROM usuarios WHERE id = ?'),
    insertar: db.prepare('INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)'),
  };
  return {
    buscarPorEmail: (email) => q.porEmail.get(email),
    buscarPorId: (id) => q.porId.get(id),
    insertar: ({ nombre, email, passwordHash, rol = 'estudiante' }) =>
      Number(q.insertar.run(nombre, email, passwordHash, rol).lastInsertRowid),
  };
}

module.exports = { crearUsuariosRepo };
