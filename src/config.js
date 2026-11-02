'use strict';
const path = require('node:path');

// Configuración centralizada (se puede sobrescribir con variables de entorno).
const config = Object.freeze({
  port: Number(process.env.PORT) || 3000,
  dbFile: process.env.DB_FILE || path.join(__dirname, '..', 'data', 'reservas.db'),
  uploadsDir: process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads'),
  sessionSecret: process.env.SESSION_SECRET || 'cambia-este-secreto-en-produccion',
  sessionMaxAgeMs: 1000 * 60 * 60 * 8, // 8 horas
  maxUploadBytes: 2 * 1024 * 1024, // 2 MB
  zonaHoraria: 'America/Guayaquil',
});

module.exports = config;
