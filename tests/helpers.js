'use strict';
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const request = require('supertest');
const { abrirBaseDeDatos } = require('../src/db/connection');
const { iniciar } = require('../src/server');

const HOY = '2026-11-02'; // lunes (reloj fijo => pruebas deterministas)
const MANANA = '2026-11-03'; // martes

/** Levanta un servidor real (HTTP + Socket.IO) con BD en memoria y carpeta temporal. */
async function crearEntorno() {
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reservas-test-'));
  const { servidor, puerto } = await iniciar({
    db: abrirBaseDeDatos(':memory:'),
    config: { uploadsDir, sessionSecret: 'test' },
    hoy: () => HOY,
    puerto: 0,
  });
  const url = `http://localhost:${puerto}`;

  /** Devuelve un agente con la cookie de sesión ya establecida. */
  async function agenteCon(email, password) {
    const agente = request.agent(servidor);
    const res = await agente.post('/api/auth/login').send({ email, password });
    if (res.status !== 200) throw new Error(`login falló: ${res.status}`);
    const cookie = res.headers['set-cookie'][0].split(';')[0];
    return { agente, cookie, usuario: res.body.data };
  }

  const cerrar = () => new Promise((resolve) => {
    servidor.closeAllConnections?.();
    servidor.close(() => { fs.rmSync(uploadsDir, { recursive: true, force: true }); resolve(); });
  });

  return {
    servidor, url, agenteCon, cerrar,
    admin: () => agenteCon('admin@tejiendoredes.ec', 'Admin123!'),
    maria: () => agenteCon('maria@correo.com', 'Maria123!'),
  };
}

const reservaValida = (extra = {}) => ({
  servicioId: 2, estudianteNombre: 'Sofía Pérez', fecha: MANANA, horaInicio: '15:00', duracionMin: 60, ...extra,
});

module.exports = { crearEntorno, reservaValida, HOY, MANANA };
