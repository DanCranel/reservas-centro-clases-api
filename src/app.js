'use strict';
const path = require('node:path');
const express = require('express');
const session = require('express-session');

const { crearUsuariosRepo } = require('./repositories/usuariosRepo');
const { crearServiciosRepo } = require('./repositories/serviciosRepo');
const { crearReservasRepo } = require('./repositories/reservasRepo');
const { crearArchivosStore } = require('./repositories/archivosStore');
const { crearAuthService } = require('./services/authService');
const { crearServiciosService } = require('./services/serviciosService');
const { crearReservasService } = require('./services/reservasService');
const { rutasAuth } = require('./http/routes/auth');
const { rutasServicios } = require('./http/routes/servicios');
const { rutasReservas } = require('./http/routes/reservas');
const { cabecerasSeguridad, rutaNoEncontrada, crearManejadorErrores } = require('./http/middleware');
const { SqliteStore } = require('./session/sqliteStore');

/** Fecha local (AAAA-MM-DD) en la zona horaria del centro. */
const hoyEn = (zona) => () => new Intl.DateTimeFormat('en-CA', { timeZone: zona }).format(new Date());

/**
 * Fábrica de la aplicación: arma capas e inyecta dependencias.
 * Los tests la usan con BD en memoria y un reloj fijo.
 */
function crearApp({ db, config, notificar = () => {}, hoy = hoyEn(config.zonaHoraria), log }) {
  const usuariosRepo = crearUsuariosRepo(db);
  const serviciosRepo = crearServiciosRepo(db);
  const reservasRepo = crearReservasRepo(db);
  const archivos = crearArchivosStore(config.uploadsDir);

  const authService = crearAuthService({ usuariosRepo });
  const serviciosService = crearServiciosService({ serviciosRepo, notificar });
  const reservasService = crearReservasService({ db, reservasRepo, serviciosRepo, archivos, notificar, hoy });

  const middlewareSesion = session({
    name: 'sid',
    secret: config.sessionSecret,
    store: new SqliteStore(db, { maxAgeMs: config.sessionMaxAgeMs }),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: config.sessionMaxAgeMs },
  });

  const app = express();
  app.disable('x-powered-by');
  app.use(cabecerasSeguridad);
  app.use(express.json({ limit: '20kb' }));
  app.use(middlewareSesion);
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/api/health', (_req, res) => res.json({ data: { estado: 'ok', hora: new Date().toISOString() } }));
  app.use('/api/auth', rutasAuth({ authService }));
  app.use('/api/servicios', rutasServicios({ serviciosService }));
  app.use('/api/reservas', rutasReservas({ reservasService, maxUploadBytes: config.maxUploadBytes }));

  app.use('/api', rutaNoEncontrada);
  app.use(crearManejadorErrores({ maxUploadBytes: config.maxUploadBytes, log }));

  return { app, middlewareSesion };
}

module.exports = { crearApp, hoyEn };
