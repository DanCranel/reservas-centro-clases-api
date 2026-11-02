'use strict';
const v = require('./validators');

const esquemaRegistro = {
  nombre: { regla: v.texto({ min: 2, max: 80 }) },
  email: { regla: v.email() },
  password: { regla: v.password() },
};

const esquemaLogin = {
  email: { regla: v.email() },
  password: { regla: v.texto({ min: 1, max: 72, recortar: false }) },
};

/** Nunca se expone el hash de la contraseña. */
const aDTO = ({ id, nombre, email, rol }) => ({ id, nombre, email, rol });

module.exports = { esquemaRegistro, esquemaLogin, aDTO };
