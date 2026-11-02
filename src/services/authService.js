'use strict';
const { errores } = require('../domain/errors');
const { validar } = require('../domain/validators');
const usuarios = require('../domain/usuarios');
const { hashPassword, verificarPassword } = require('../domain/passwords');

const exigirValido = (esquema, entrada) => {
  const r = validar(esquema, entrada);
  if (!r.ok) throw errores.validacion(r.errores);
  return r.value;
};

function crearAuthService({ usuariosRepo }) {
  async function registrar(entrada) {
    const datos = exigirValido(usuarios.esquemaRegistro, entrada);
    if (usuariosRepo.buscarPorEmail(datos.email)) {
      throw errores.conflicto('EMAIL_EN_USO', 'Ya existe una cuenta con ese correo.');
    }
    const id = usuariosRepo.insertar({ ...datos, passwordHash: await hashPassword(datos.password) });
    return usuarios.aDTO(usuariosRepo.buscarPorId(id));
  }

  async function iniciarSesion(entrada) {
    const { email, password } = exigirValido(usuarios.esquemaLogin, entrada);
    const usuario = usuariosRepo.buscarPorEmail(email);
    const valido = usuario && (await verificarPassword(password, usuario.password_hash));
    if (!valido) throw errores.credenciales();
    return usuarios.aDTO(usuario);
  }

  return { registrar, iniciarSesion };
}

module.exports = { crearAuthService, exigirValido };
