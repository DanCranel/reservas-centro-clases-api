'use strict';
const express = require('express');
const { asincrono, requiereSesion } = require('../middleware');

/** Regenera el id de sesión al autenticarse (previene fijación de sesión). */
const abrirSesion = (req, usuario) => new Promise((resolve, reject) => {
  req.session.regenerate((err) => {
    if (err) return reject(err);
    req.session.usuario = usuario;
    return req.session.save((e) => (e ? reject(e) : resolve()));
  });
});

function rutasAuth({ authService }) {
  const r = express.Router();

  r.post('/register', asincrono(async (req, res) => {
    const usuario = await authService.registrar(req.body);
    await abrirSesion(req, usuario);
    res.status(201).json({ data: usuario });
  }));

  r.post('/login', asincrono(async (req, res) => {
    const usuario = await authService.iniciarSesion(req.body);
    await abrirSesion(req, usuario);
    res.json({ data: usuario });
  }));

  r.post('/logout', requiereSesion, (req, res, next) => {
    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie('sid');
      return res.status(204).end();
    });
  });

  r.get('/me', requiereSesion, (req, res) => res.json({ data: req.session.usuario }));

  return r;
}

module.exports = { rutasAuth };
