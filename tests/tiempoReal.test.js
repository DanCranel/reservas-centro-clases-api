'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { io } = require('socket.io-client');
const { crearEntorno, reservaValida } = require('./helpers');

let env;
const sockets = [];
before(async () => { env = await crearEntorno(); });
after(async () => { sockets.forEach((s) => s.disconnect()); await env.cerrar(); });

const conectar = (url, cookie) => new Promise((resolve, reject) => {
  const s = io(url, { transports: ['websocket'], extraHeaders: cookie ? { Cookie: cookie } : {}, reconnection: false });
  sockets.push(s);
  s.on('bienvenida', () => resolve(s));
  s.on('connect_error', reject);
});

const esperar = (socket, evento, ms = 1500) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error(`no llegó ${evento}`)), ms);
  socket.once(evento, (m) => { clearTimeout(t); resolve(m); });
});

test('socket sin sesión es rechazado', async () => {
  await assert.rejects(conectar(env.url), /UNAUTHENTICATED/);
});

test('admin y dueña reciben reserva:creada; otro usuario no', async () => {
  const admin = await env.admin();
  const maria = await env.maria();
  const otro = request.agent(env.servidor);
  const reg = await otro.post('/api/auth/register').send({ nombre: 'Rosa', email: 'rosa@correo.com', password: 'Clave1234' });
  const cookieOtro = reg.headers['set-cookie'][0].split(';')[0];

  const [sAdmin, sMaria, sOtro] = await Promise.all([conectar(env.url, admin.cookie), conectar(env.url, maria.cookie), conectar(env.url, cookieOtro)]);
  let otroRecibio = false;
  sOtro.on('reserva:creada', () => { otroRecibio = true; });

  const pAdmin = esperar(sAdmin, 'reserva:creada');
  const pMaria = esperar(sMaria, 'reserva:creada');
  const { body } = await maria.agente.post('/api/reservas').send(reservaValida());

  const [mAdmin, mMaria] = await Promise.all([pAdmin, pMaria]);
  assert.equal(mAdmin.datos.id, body.data.id);
  assert.equal(mMaria.evento, 'reserva:creada');
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(otroRecibio, false);

  const pConf = esperar(sMaria, 'reserva:actualizada');
  await admin.agente.patch(`/api/reservas/${body.data.id}`).send({ version: 1, estado: 'confirmada' });
  assert.equal((await pConf).datos.estado, 'confirmada');
});
