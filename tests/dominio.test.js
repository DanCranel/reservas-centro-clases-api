'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const v = require('../src/domain/validators');
const R = require('../src/domain/reservas');
const { detectarTipo } = require('../src/domain/archivos');

test('validar: acumula errores, rechaza campos desconocidos y no muta la entrada', () => {
  const entrada = Object.freeze({ nombre: ' A ', extra: 1 });
  const r = v.validar({ nombre: { regla: v.texto({ min: 2 }) }, edad: { regla: v.entero() } }, entrada);
  assert.equal(r.ok, false);
  assert.deepEqual(r.errores.map((e) => e.campo).sort(), ['edad', 'extra', 'nombre']);
});

test('validar: modo parcial permite omitir campos (PATCH)', () => {
  const r = v.validar({ a: { regla: v.entero() }, b: { regla: v.entero() } }, { a: '5' }, { parcial: true });
  assert.deepEqual(r, { ok: true, value: { a: 5 }, errores: [] });
});

test('fechaISO rechaza fechas inexistentes', () => {
  assert.equal(v.fechaISO()('2026-02-30').ok, false);
  assert.equal(v.fechaISO()('2026-02-28').ok, true);
});

test('seSolapan: intervalos contiguos no se cruzan', () => {
  assert.equal(R.seSolapan({ inicio: 900, fin: 960 }, { inicio: 960, fin: 1020 }), false);
  assert.equal(R.seSolapan({ inicio: 900, fin: 990 }, { inicio: 960, fin: 1020 }), true);
});

test('erroresDeHorario: pasado, domingo y fuera de horario', () => {
  const hoy = '2026-11-02';
  assert.equal(R.erroresDeHorario({ fecha: '2026-11-03', ...R.intervalo('15:00', 60) }, hoy).length, 0);
  assert.match(R.erroresDeHorario({ fecha: '2026-11-01', ...R.intervalo('15:00', 60) }, hoy)[0].mensaje, /pasado/);
  assert.match(R.erroresDeHorario({ fecha: '2026-11-08', ...R.intervalo('15:00', 60) }, hoy)[0].mensaje, /lunes a sábado/);
  assert.match(R.erroresDeHorario({ fecha: '2026-11-03', ...R.intervalo('19:30', 60) }, hoy)[0].mensaje, /20:00/);
});

test('transiciones de estado', () => {
  assert.equal(R.transicionPermitida('pendiente', 'confirmada'), true);
  assert.equal(R.transicionPermitida('cancelada', 'pendiente'), false);
  assert.equal(R.transicionPermitida('confirmada', 'pendiente'), false);
});

test('aplicarCambios devuelve un objeto nuevo sin mutar el original', () => {
  const actual = Object.freeze({ estudiante_nombre: 'Ana', fecha: '2026-11-03', inicio_min: 900, fin_min: 960, notas: '', estado: 'pendiente' });
  const nueva = R.aplicarCambios(actual, { horaInicio: '16:00' });
  assert.equal(nueva.inicio_min, 960);
  assert.equal(nueva.fin_min, 1020); // conserva la duración
  assert.equal(actual.inicio_min, 900);
});

test('detectarTipo usa los bytes reales, no la extensión', () => {
  assert.equal(detectarTipo(Buffer.from('%PDF-1.4 ...')).tipo, 'application/pdf');
  assert.equal(detectarTipo(Buffer.from([0xff, 0xd8, 0xff, 0xe0])).ext, 'jpg');
  assert.equal(detectarTipo(Buffer.from('hola mundo')), null);
});

test('normalizarNombre ignora tildes, mayúsculas y espacios', () => {
  const { normalizarNombre } = require('../src/domain/servicios');
  assert.equal(normalizarNombre('  Inglés   BÁSICO '), 'ingles basico');
});
