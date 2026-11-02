'use strict';
const multer = require('multer');
const { AppError, errores } = require('../../domain/errors');

/** Permite usar funciones async en rutas: los errores llegan al manejador central. */
const asincrono = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const requiereSesion = (req, _res, next) => (req.session?.usuario ? next() : next(errores.noAutenticado()));

const requiereAdmin = (req, _res, next) => {
  if (!req.session?.usuario) return next(errores.noAutenticado());
  return req.session.usuario.rol === 'admin' ? next() : next(errores.prohibido());
};

/** Valida el parámetro :id de la ruta y lo deja como número en req.idRecurso. */
const idValido = (req, _res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return next(errores.validacion([{ campo: 'id', mensaje: 'debe ser un entero positivo' }]));
  req.idRecurso = id;
  return next();
};

const cabecerasSeguridad = (_req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
  });
  next();
};

const rutaNoEncontrada = (req, _res, next) =>
  next(new AppError(404, 'ROUTE_NOT_FOUND', `No existe la ruta ${req.method} ${req.originalUrl}.`));

/** Traduce cualquier error al formato uniforme { error: { code, message, details? } }. */
function crearManejadorErrores({ maxUploadBytes, log = console.error }) {
  const normalizar = (err) => {
    if (err instanceof AppError) return err;
    if (err?.type === 'entity.parse.failed') return new AppError(400, 'INVALID_JSON', 'El cuerpo no es un JSON válido.');
    if (err?.type === 'entity.too.large') return new AppError(413, 'PAYLOAD_TOO_LARGE', 'El cuerpo de la petición es muy grande.');
    if (err instanceof multer.MulterError) {
      return err.code === 'LIMIT_FILE_SIZE'
        ? errores.archivoGrande(maxUploadBytes / 1024 / 1024)
        : errores.validacion([{ campo: err.field ?? 'comprobante', mensaje: 'archivo no esperado (use el campo "comprobante")' }]);
    }
    log(err);
    return new AppError(500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado.');
  };

  // eslint-disable-next-line no-unused-vars
  return (err, _req, res, _next) => {
    const e = normalizar(err);
    res.status(e.status).json({ error: { code: e.code, message: e.message, ...(e.details ? { details: e.details } : {}) } });
  };
}

module.exports = { asincrono, requiereSesion, requiereAdmin, idValido, cabecerasSeguridad, rutaNoEncontrada, crearManejadorErrores };
