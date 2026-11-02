-- Esquema de la API de reservas del Centro de Clases Paute
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS usuarios (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre        TEXT    NOT NULL CHECK (length(nombre) BETWEEN 2 AND 80),
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL,
  rol           TEXT    NOT NULL DEFAULT 'estudiante' CHECK (rol IN ('admin', 'estudiante')),
  creado_en     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS servicios (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre           TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  descripcion      TEXT    NOT NULL DEFAULT '',
  precio_centavos  INTEGER NOT NULL CHECK (precio_centavos >= 0),
  cupo             INTEGER NOT NULL CHECK (cupo BETWEEN 1 AND 30),
  activo           INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  version          INTEGER NOT NULL DEFAULT 1,
  creado_en        TEXT    NOT NULL DEFAULT (datetime('now')),
  actualizado_en   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reservas (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id         INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  servicio_id        INTEGER NOT NULL REFERENCES servicios(id) ON DELETE RESTRICT,
  estudiante_nombre  TEXT    NOT NULL CHECK (length(estudiante_nombre) BETWEEN 2 AND 80),
  fecha              TEXT    NOT NULL CHECK (fecha GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  inicio_min         INTEGER NOT NULL CHECK (inicio_min BETWEEN 0 AND 1439),
  fin_min            INTEGER NOT NULL CHECK (fin_min > inicio_min),
  notas              TEXT    NOT NULL DEFAULT '',
  estado             TEXT    NOT NULL DEFAULT 'pendiente'
                       CHECK (estado IN ('pendiente', 'confirmada', 'cancelada')),
  comprobante_archivo TEXT,
  comprobante_tipo    TEXT,
  version            INTEGER NOT NULL DEFAULT 1,
  creado_en          TEXT    NOT NULL DEFAULT (datetime('now')),
  actualizado_en     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reservas_servicio_fecha ON reservas (servicio_id, fecha);
CREATE INDEX IF NOT EXISTS idx_reservas_usuario_fecha  ON reservas (usuario_id, fecha);

CREATE TABLE IF NOT EXISTS sesiones (
  sid     TEXT PRIMARY KEY,
  datos   TEXT    NOT NULL,
  expira  INTEGER NOT NULL
);
