'use strict';
/**
 * Validación declarativa y PURA: cada regla recibe un valor y devuelve
 * { ok: true, value } o { ok: false, mensaje }. No hay E/S ni mutaciones.
 */

const ok = (value) => ({ ok: true, value });
const falla = (mensaje) => ({ ok: false, mensaje });

const texto = ({ min = 0, max = 255, recortar = true } = {}) => (v) => {
  if (typeof v !== 'string') return falla('debe ser texto');
  const s = recortar ? v.trim() : v;
  if (s.length < min) return falla(`debe tener al menos ${min} caracteres`);
  if (s.length > max) return falla(`debe tener como máximo ${max} caracteres`);
  return ok(s);
};

const entero = ({ min = -Infinity, max = Infinity } = {}) => (v) => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (!Number.isInteger(n)) return falla('debe ser un número entero');
  if (n < min || n > max) return falla(`debe estar entre ${min} y ${max}`);
  return ok(n);
};

const booleano = () => (v) => (typeof v === 'boolean' ? ok(v) : falla('debe ser true o false'));

const unoDe = (opciones) => (v) =>
  opciones.includes(v) ? ok(v) : falla(`debe ser uno de: ${opciones.join(', ')}`);

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const email = () => (v) => {
  const r = texto({ min: 5, max: 120 })(v);
  if (!r.ok) return r;
  const normal = r.value.toLowerCase();
  return RE_EMAIL.test(normal) ? ok(normal) : falla('no es un correo válido');
};

const password = () => (v) => {
  const r = texto({ min: 8, max: 72, recortar: false })(v);
  if (!r.ok) return r;
  if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return falla('debe incluir letras y números');
  return ok(v);
};

const fechaISO = () => (v) => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return falla('debe tener formato AAAA-MM-DD');
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? ok(v) : falla('no es una fecha real');
};

const hora = () => (v) => {
  if (typeof v !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) return falla('debe tener formato HH:MM (24 h)');
  return ok(v);
};

/**
 * Aplica un esquema { campo: { regla, requerido } } a un objeto.
 * parcial=true permite omitir campos (útil para PATCH).
 * Devuelve { ok, value, errores } sin modificar la entrada.
 */
function validar(esquema, entrada, { parcial = false } = {}) {
  const datos = entrada && typeof entrada === 'object' && !Array.isArray(entrada) ? entrada : {};
  const desconocidos = Object.keys(datos)
    .filter((k) => !(k in esquema))
    .map((campo) => ({ campo, mensaje: 'campo no permitido' }));

  const resultado = Object.entries(esquema).reduce(
    (acc, [campo, { regla, requerido = true }]) => {
      const valor = datos[campo];
      if (valor === undefined || valor === null || valor === '') {
        return requerido && !parcial
          ? { ...acc, errores: [...acc.errores, { campo, mensaje: 'es obligatorio' }] }
          : acc;
      }
      const r = regla(valor);
      return r.ok
        ? { ...acc, value: { ...acc.value, [campo]: r.value } }
        : { ...acc, errores: [...acc.errores, { campo, mensaje: r.mensaje }] };
    },
    { value: {}, errores: desconocidos },
  );
  return { ...resultado, ok: resultado.errores.length === 0 };
}

module.exports = { validar, texto, entero, booleano, unoDe, email, password, fechaISO, hora };
