'use strict';
const SELECT_BASE = `
  SELECT r.*, s.nombre AS servicio_nombre
    FROM reservas r
    JOIN servicios s ON s.id = r.servicio_id`;

function crearReservasRepo(db) {
  const q = {
    porId: db.prepare(`${SELECT_BASE} WHERE r.id = ?`),
    activasDelServicio: db.prepare(
      `SELECT id, inicio_min, fin_min FROM reservas
        WHERE servicio_id = ? AND fecha = ? AND estado <> 'cancelada'`),
    activasDelUsuario: db.prepare(
      `SELECT id, inicio_min, fin_min, estudiante_nombre FROM reservas
        WHERE usuario_id = ? AND fecha = ? AND estado <> 'cancelada'`),
    insertar: db.prepare(`
      INSERT INTO reservas (usuario_id, servicio_id, estudiante_nombre, fecha, inicio_min, fin_min, notas)
      VALUES (?, ?, ?, ?, ?, ?, ?)`),
    actualizar: db.prepare(`
      UPDATE reservas
         SET estudiante_nombre = ?, fecha = ?, inicio_min = ?, fin_min = ?, notas = ?, estado = ?,
             version = version + 1, actualizado_en = datetime('now')
       WHERE id = ? AND version = ?`),
    comprobante: db.prepare(`
      UPDATE reservas
         SET comprobante_archivo = ?, comprobante_tipo = ?, version = version + 1, actualizado_en = datetime('now')
       WHERE id = ?`),
    eliminar: db.prepare('DELETE FROM reservas WHERE id = ?'),
  };

  /**
   * Filtros dinámicos: las cláusulas son fijas y solo los VALORES vienen del usuario,
   * siempre como parámetros "?" (previene inyección SQL).
   */
  function listar({ usuarioId, fecha, estado, servicioId, limit, offset }) {
    const filtros = [
      usuarioId !== undefined && ['r.usuario_id = ?', usuarioId],
      fecha !== undefined && ['r.fecha = ?', fecha],
      estado !== undefined && ['r.estado = ?', estado],
      servicioId !== undefined && ['r.servicio_id = ?', servicioId],
    ].filter(Boolean);
    const where = filtros.length ? `WHERE ${filtros.map(([c]) => c).join(' AND ')}` : '';
    const params = filtros.map(([, p]) => p);
    const total = db.prepare(`SELECT COUNT(*) AS total FROM reservas r ${where}`).get(...params).total;
    const filas = db
      .prepare(`${SELECT_BASE} ${where} ORDER BY r.fecha, r.inicio_min, r.id LIMIT ? OFFSET ?`)
      .all(...params, limit, offset);
    return { filas, total };
  }

  return {
    listar,
    buscarPorId: (id) => q.porId.get(id),
    activasDelServicio: (servicioId, fecha) => q.activasDelServicio.all(servicioId, fecha),
    activasDelUsuario: (usuarioId, fecha) => q.activasDelUsuario.all(usuarioId, fecha),
    insertar: (r) =>
      Number(q.insertar.run(r.usuarioId, r.servicioId, r.estudianteNombre, r.fecha, r.inicio, r.fin, r.notas ?? '').lastInsertRowid),
    actualizar: (id, version, r) =>
      Number(q.actualizar.run(r.estudiante_nombre, r.fecha, r.inicio_min, r.fin_min, r.notas, r.estado, id, version).changes),
    guardarComprobante: (id, archivo, tipo) => Number(q.comprobante.run(archivo, tipo, id).changes),
    eliminar: (id) => Number(q.eliminar.run(id).changes),
  };
}

module.exports = { crearReservasRepo };
