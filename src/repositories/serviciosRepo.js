'use strict';
function crearServiciosRepo(db) {
  const q = {
    listar: db.prepare('SELECT * FROM servicios WHERE (? = 0 OR activo = 1) ORDER BY nombre'),
    porId: db.prepare('SELECT * FROM servicios WHERE id = ?'),
    insertar: db.prepare(
      'INSERT INTO servicios (nombre, descripcion, precio_centavos, cupo, activo) VALUES (?, ?, ?, ?, ?)'),
    actualizar: db.prepare(`
      UPDATE servicios
         SET nombre = ?, descripcion = ?, precio_centavos = ?, cupo = ?, activo = ?,
             version = version + 1, actualizado_en = datetime('now')
       WHERE id = ? AND version = ?`),
    eliminar: db.prepare('DELETE FROM servicios WHERE id = ?'),
    contarReservas: db.prepare('SELECT COUNT(*) AS total FROM reservas WHERE servicio_id = ?'),
  };
  return {
    listar: ({ soloActivos }) => q.listar.all(soloActivos ? 1 : 0),
    buscarPorId: (id) => q.porId.get(id),
    insertar: (s) =>
      Number(q.insertar.run(s.nombre, s.descripcion ?? '', s.precioCentavos, s.cupo, s.activo === false ? 0 : 1).lastInsertRowid),
    actualizar: (id, version, s) =>
      Number(q.actualizar.run(s.nombre, s.descripcion ?? '', s.precioCentavos, s.cupo, s.activo === false ? 0 : 1, id, version).changes),
    eliminar: (id) => Number(q.eliminar.run(id).changes),
    contarReservas: (id) => q.contarReservas.get(id).total,
  };
}

module.exports = { crearServiciosRepo };
