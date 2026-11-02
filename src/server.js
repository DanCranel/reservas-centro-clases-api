'use strict';
const http = require('node:http');
const { Server } = require('socket.io');
const config = require('./config');
const { abrirBaseDeDatos } = require('./db/connection');
const { sembrar } = require('./db/seed');
const { crearApp } = require('./app');
const { crearNotificador } = require('./realtime/notificador');

/** Levanta HTTP + Socket.IO. Se exporta para reutilizarlo en pruebas de tiempo real. */
async function iniciar(opciones = {}) {
  const cfg = { ...config, ...opciones.config };
  const db = opciones.db ?? abrirBaseDeDatos(cfg.dbFile);
  await sembrar(db);

  const notificador = crearNotificador();
  const { app, middlewareSesion } = crearApp({ db, config: cfg, notificar: notificador.notificar, hoy: opciones.hoy });
  const servidor = http.createServer(app);
  notificador.conectar(new Server(servidor), middlewareSesion);

  await new Promise((resolve) => servidor.listen(opciones.puerto ?? cfg.port, resolve));
  return { servidor, db, puerto: servidor.address().port };
}

if (require.main === module) {
  iniciar().then(({ puerto }) => console.log(`API de reservas escuchando en http://localhost:${puerto}`));
}

module.exports = { iniciar };
