'use strict';
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { crearEntorno, reservaValida, MANANA } = require('./helpers');

let env;
before(async () => { env = await crearEntorno(); });
after(() => env.cerrar());

const formatoError = (res, status, code) => {
  assert.equal(res.status, status, JSON.stringify(res.body));
  assert.equal(res.body.error.code, code);
  assert.equal(typeof res.body.error.message, 'string');
};

describe('Autenticación y sesiones', () => {
  test('registro crea la cuenta (201) y abre sesión', async () => {
    const agente = request.agent(env.servidor);
    const res = await agente.post('/api/auth/register').send({ nombre: 'Luis Andrade', email: 'Luis@Correo.com', password: 'Clave1234' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.email, 'luis@correo.com');
    assert.equal(res.body.data.password_hash, undefined);
    assert.equal((await agente.get('/api/auth/me')).status, 200);
  });

  test('correo repetido -> 409 EMAIL_EN_USO', async () => {
    const res = await request(env.servidor).post('/api/auth/register').send({ nombre: 'Otra', email: 'maria@correo.com', password: 'Clave1234' });
    formatoError(res, 409, 'EMAIL_EN_USO');
  });

  test('datos inválidos -> 400 con detalle por campo', async () => {
    const res = await request(env.servidor).post('/api/auth/register').send({ nombre: 'X', email: 'no-es-correo', password: '123' });
    formatoError(res, 400, 'VALIDATION_ERROR');
    assert.deepEqual(res.body.error.details.map((d) => d.campo).sort(), ['email', 'nombre', 'password']);
  });

  test('credenciales incorrectas -> 401', async () => {
    const res = await request(env.servidor).post('/api/auth/login').send({ email: 'maria@correo.com', password: 'mala' });
    formatoError(res, 401, 'INVALID_CREDENTIALS');
  });

  test('logout destruye la sesión', async () => {
    const { agente } = await env.maria();
    assert.equal((await agente.post('/api/auth/logout')).status, 204);
    formatoError(await agente.get('/api/auth/me'), 401, 'UNAUTHENTICATED');
  });

  test('cookie de sesión es HttpOnly y SameSite', async () => {
    const res = await request(env.servidor).post('/api/auth/login').send({ email: 'maria@correo.com', password: 'Maria123!' });
    assert.match(res.headers['set-cookie'][0], /HttpOnly/);
    assert.match(res.headers['set-cookie'][0], /SameSite=Lax/);
  });
});

describe('Servicios (CRUD admin)', () => {
  test('listado público', async () => {
    const res = await request(env.servidor).get('/api/servicios');
    assert.equal(res.status, 200);
    assert.ok(res.body.data.length >= 4);
  });

  test('estudiante no puede crear -> 403', async () => {
    const { agente } = await env.maria();
    formatoError(await agente.post('/api/servicios').send({ nombre: 'Inglés', precioCentavos: 700, cupo: 3 }), 403, 'FORBIDDEN');
  });

  test('admin crea (201 + Location), nombre duplicado -> 409', async () => {
    const { agente } = await env.admin();
    const res = await agente.post('/api/servicios').send({ nombre: 'Inglés básico', precioCentavos: 700, cupo: 3 });
    assert.equal(res.status, 201);
    assert.equal(res.headers.location, `/api/servicios/${res.body.data.id}`);
    formatoError(await agente.post('/api/servicios').send({ nombre: 'inglés BÁSICO', precioCentavos: 700, cupo: 3 }), 409, 'NOMBRE_DUPLICADO');
  });

  test('PUT con versión desactualizada -> 409 VERSION_CONFLICTO', async () => {
    const { agente } = await env.admin();
    const datos = { nombre: 'Clases de recuperación', precioCentavos: 900, cupo: 4 };
    const ok = await agente.put('/api/servicios/2').send({ ...datos, version: 1 });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.version, 2);
    const res = await agente.put('/api/servicios/2').send({ ...datos, version: 1 });
    formatoError(res, 409, 'VERSION_CONFLICTO');
    assert.equal(res.body.error.details.versionActual, 2);
  });

  test('id inválido -> 400; inexistente -> 404', async () => {
    formatoError(await request(env.servidor).get('/api/servicios/abc'), 400, 'VALIDATION_ERROR');
    formatoError(await request(env.servidor).get('/api/servicios/9999'), 404, 'NOT_FOUND');
  });
});

describe('Reservas', () => {
  test('sin sesión -> 401', async () => {
    formatoError(await request(env.servidor).get('/api/reservas'), 401, 'UNAUTHENTICATED');
  });

  test('crear reserva -> 201 con contrato completo', async () => {
    const { agente } = await env.maria();
    const res = await agente.post('/api/reservas').send(reservaValida({ notas: 'Trae el cuaderno' }));
    assert.equal(res.status, 201);
    assert.equal(res.headers.location, `/api/reservas/${res.body.data.id}`);
    assert.deepEqual(
      { ...res.body.data, id: 0, creadoEn: '', actualizadoEn: '', usuarioId: 0 },
      { id: 0, usuarioId: 0, servicio: { id: 2, nombre: 'Clases de recuperación' }, estudianteNombre: 'Sofía Pérez',
        fecha: MANANA, horaInicio: '15:00', horaFin: '16:00', duracionMin: 60, notas: 'Trae el cuaderno',
        estado: 'pendiente', tieneComprobante: false, version: 1, creadoEn: '', actualizadoEn: '' });
  });

  test('validaciones de negocio -> 400 (pasado, domingo, fuera de horario, duración)', async () => {
    const { agente } = await env.maria();
    for (const extra of [{ fecha: '2026-10-30' }, { fecha: '2026-11-08' }, { horaInicio: '07:00' }, { duracionMin: 45 }]) {
      formatoError(await agente.post('/api/reservas').send(reservaValida(extra)), 400, 'VALIDATION_ERROR');
    }
  });

  test('mismo estudiante en horario cruzado -> 409 RESERVA_DUPLICADA', async () => {
    const { agente } = await env.maria();
    const res = await agente.post('/api/reservas').send(reservaValida({ horaInicio: '15:30' }));
    formatoError(res, 409, 'RESERVA_DUPLICADA');
  });

  test('cupo lleno -> 409 CUPO_LLENO', async () => {
    const admin = (await env.admin()).agente;
    const { body } = await admin.post('/api/servicios').send({ nombre: 'Tutoría individual', precioCentavos: 1500, cupo: 1 });
    const { agente } = await env.maria();
    const base = { servicioId: body.data.id, fecha: MANANA, horaInicio: '10:00', duracionMin: 60 };
    assert.equal((await agente.post('/api/reservas').send({ ...base, estudianteNombre: 'Ana' })).status, 201);
    const res = await agente.post('/api/reservas').send({ ...base, estudianteNombre: 'Pedro', horaInicio: '10:30' });
    formatoError(res, 409, 'CUPO_LLENO');
    assert.deepEqual(res.body.error.details, { cupo: 1, ocupados: 1 });
  });

  test('servicio con reservas no se elimina -> 409', async () => {
    const { agente } = await env.admin();
    formatoError(await agente.delete('/api/servicios/2'), 409, 'SERVICIO_CON_RESERVAS');
  });

  test('aislamiento: un estudiante no ve reservas ajenas', async () => {
    const maria = (await env.maria()).agente;
    const { body } = await maria.post('/api/reservas').send(reservaValida({ estudianteNombre: 'Mateo', horaInicio: '17:00' }));
    const otro = request.agent(env.servidor);
    await otro.post('/api/auth/register').send({ nombre: 'Pedro', email: 'pedro@correo.com', password: 'Clave1234' });
    formatoError(await otro.get(`/api/reservas/${body.data.id}`), 403, 'FORBIDDEN');
    assert.equal((await otro.get('/api/reservas')).body.meta.total, 0);
  });

  test('filtros y paginación', async () => {
    const { agente } = await env.admin();
    const res = await agente.get(`/api/reservas?fecha=${MANANA}&estado=pendiente&limit=2&page=1`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 2);
    assert.equal(res.body.meta.limit, 2);
    assert.ok(res.body.meta.total >= 3);
  });

  test('filtro con intento de inyección SQL -> 400', async () => {
    const { agente } = await env.admin();
    formatoError(await agente.get("/api/reservas?estado=pendiente' OR '1'='1"), 400, 'VALIDATION_ERROR');
  });

  test('PATCH: reprogramar, versión obsoleta, permisos y transiciones', async () => {
    const maria = (await env.maria()).agente;
    const { body } = await maria.post('/api/reservas').send(reservaValida({ estudianteNombre: 'Valentina', horaInicio: '09:00' }));
    const id = body.data.id;

    const mov = await maria.patch(`/api/reservas/${id}`).send({ version: 1, horaInicio: '11:00' });
    assert.equal(mov.status, 200);
    assert.equal(mov.body.data.horaFin, '12:00');
    assert.equal(mov.body.data.version, 2);

    formatoError(await maria.patch(`/api/reservas/${id}`).send({ version: 1, notas: 'x' }), 409, 'VERSION_CONFLICTO');
    formatoError(await maria.patch(`/api/reservas/${id}`).send({ version: 2, estado: 'confirmada' }), 403, 'FORBIDDEN');

    const admin = (await env.admin()).agente;
    assert.equal((await admin.patch(`/api/reservas/${id}`).send({ version: 2, estado: 'confirmada' })).body.data.estado, 'confirmada');
    formatoError(await maria.delete(`/api/reservas/${id}`), 409, 'RESERVA_NO_ELIMINABLE');
    assert.equal((await maria.patch(`/api/reservas/${id}`).send({ version: 3, estado: 'cancelada' })).status, 200);
    formatoError(await admin.patch(`/api/reservas/${id}`).send({ version: 4, estado: 'confirmada' }), 409, 'RESERVA_CANCELADA');
  });

  test('DELETE de reserva pendiente -> 204 y luego 404', async () => {
    const { agente } = await env.maria();
    const { body } = await agente.post('/api/reservas').send(reservaValida({ estudianteNombre: 'Emilia', horaInicio: '18:00' }));
    assert.equal((await agente.delete(`/api/reservas/${body.data.id}`)).status, 204);
    formatoError(await agente.get(`/api/reservas/${body.data.id}`), 404, 'NOT_FOUND');
  });
});

describe('Archivo: comprobante de pago', () => {
  let id;
  let agente;
  before(async () => {
    ({ agente } = await env.maria());
    const { body } = await agente.post('/api/reservas').send(reservaValida({ estudianteNombre: 'Camila', horaInicio: '13:00' }));
    id = body.data.id;
  });

  test('subir PDF válido -> 200 y descarga con su tipo', async () => {
    const pdf = Buffer.from('%PDF-1.4\n% comprobante de prueba\n');
    const res = await agente.put(`/api/reservas/${id}/comprobante`).attach('comprobante', pdf, 'pago.pdf');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.tieneComprobante, true);
    const desc = await agente.get(`/api/reservas/${id}/comprobante`).buffer(true);
    assert.equal(desc.status, 200);
    assert.match(desc.headers['content-type'], /application\/pdf/);
  });

  test('archivo disfrazado (.pdf que no es PDF) -> 415', async () => {
    const res = await agente.put(`/api/reservas/${id}/comprobante`).attach('comprobante', Buffer.from('<script>alert(1)</script>'), 'pago.pdf');
    formatoError(res, 415, 'UNSUPPORTED_FILE');
  });

  test('archivo mayor a 2 MB -> 413', async () => {
    const grande = Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(2 * 1024 * 1024 + 10)]);
    formatoError(await agente.put(`/api/reservas/${id}/comprobante`).attach('comprobante', grande, 'g.pdf'), 413, 'FILE_TOO_LARGE');
  });

  test('sin archivo -> 400', async () => {
    formatoError(await agente.put(`/api/reservas/${id}/comprobante`), 400, 'VALIDATION_ERROR');
  });
});

describe('Errores generales', () => {
  test('JSON mal formado -> 400 INVALID_JSON', async () => {
    const res = await request(env.servidor).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
    formatoError(res, 400, 'INVALID_JSON');
  });

  test('ruta inexistente -> 404 ROUTE_NOT_FOUND', async () => {
    formatoError(await request(env.servidor).get('/api/no-existe'), 404, 'ROUTE_NOT_FOUND');
  });

  test('campos no permitidos se rechazan (sin asignación masiva)', async () => {
    const { agente } = await env.maria();
    const res = await agente.post('/api/reservas').send(reservaValida({ estudianteNombre: 'Tomás', horaInicio: '16:00', estado: 'confirmada' }));
    formatoError(res, 400, 'VALIDATION_ERROR');
    assert.equal(res.body.error.details[0].campo, 'estado');
  });
});
