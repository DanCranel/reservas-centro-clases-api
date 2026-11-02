'use strict';
const session = require('express-session');

/** Almacén de sesiones en SQLite: las sesiones sobreviven a reinicios del servidor. */
class SqliteStore extends session.Store {
  constructor(db, { maxAgeMs }) {
    super();
    this.maxAgeMs = maxAgeMs;
    this.q = {
      get: db.prepare('SELECT datos FROM sesiones WHERE sid = ? AND expira > ?'),
      set: db.prepare(`INSERT INTO sesiones (sid, datos, expira) VALUES (?, ?, ?)
                       ON CONFLICT(sid) DO UPDATE SET datos = excluded.datos, expira = excluded.expira`),
      touch: db.prepare('UPDATE sesiones SET expira = ? WHERE sid = ?'),
      destroy: db.prepare('DELETE FROM sesiones WHERE sid = ?'),
      purgar: db.prepare('DELETE FROM sesiones WHERE expira <= ?'),
    };
  }

  expiracion(sess) {
    const exp = sess?.cookie?.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + this.maxAgeMs;
    return exp;
  }

  get(sid, cb) {
    try {
      const fila = this.q.get.get(sid, Date.now());
      cb(null, fila ? JSON.parse(fila.datos) : null);
    } catch (err) { cb(err); }
  }

  set(sid, sess, cb = () => {}) {
    try {
      this.q.purgar.run(Date.now());
      this.q.set.run(sid, JSON.stringify(sess), this.expiracion(sess));
      cb(null);
    } catch (err) { cb(err); }
  }

  touch(sid, sess, cb = () => {}) {
    try { this.q.touch.run(this.expiracion(sess), sid); cb(null); } catch (err) { cb(err); }
  }

  destroy(sid, cb = () => {}) {
    try { this.q.destroy.run(sid); cb(null); } catch (err) { cb(err); }
  }
}

module.exports = { SqliteStore };
