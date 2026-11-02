'use strict';

/** Error de aplicación con código HTTP y código legible por máquinas. */
class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const errores = Object.freeze({
  validacion: (details) => new AppError(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos.', details),
  noAutenticado: () => new AppError(401, 'UNAUTHENTICATED', 'Debe iniciar sesión.'),
  credenciales: () => new AppError(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.'),
  prohibido: () => new AppError(403, 'FORBIDDEN', 'No tiene permisos para esta acción.'),
  noEncontrado: (recurso) => new AppError(404, 'NOT_FOUND', `${recurso} no existe.`),
  conflicto: (code, message, details) => new AppError(409, code, message, details),
  archivoInvalido: (message) => new AppError(415, 'UNSUPPORTED_FILE', message),
  archivoGrande: (maxMb) => new AppError(413, 'FILE_TOO_LARGE', `El archivo supera ${maxMb} MB.`),
});

module.exports = { AppError, errores };
