'use strict';
const express = require('express');
const multer = require('multer');
const { asincrono, requiereSesion, idValido } = require('../middleware');

function rutasReservas({ reservasService, maxUploadBytes }) {
  const r = express.Router();
  const subida = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxUploadBytes, files: 1 } });
  const usuario = (req) => req.session.usuario;

  r.use(requiereSesion);

  r.get('/', (req, res) => res.json(reservasService.listar(usuario(req), req.query)));
  r.get('/:id', idValido, (req, res) => res.json({ data: reservasService.obtener(usuario(req), req.idRecurso) }));

  r.post('/', (req, res) => {
    const reserva = reservasService.crear(usuario(req), req.body);
    res.status(201).location(`/api/reservas/${reserva.id}`).json({ data: reserva });
  });

  r.patch('/:id', idValido, (req, res) =>
    res.json({ data: reservasService.actualizar(usuario(req), req.idRecurso, req.body) }));

  r.delete('/:id', idValido, asincrono(async (req, res) => {
    await reservasService.eliminar(usuario(req), req.idRecurso);
    res.status(204).end();
  }));

  // Función de archivo: subir y descargar el comprobante de pago de una reserva.
  r.put('/:id/comprobante', idValido, subida.single('comprobante'), asincrono(async (req, res) => {
    res.json({ data: await reservasService.adjuntarComprobante(usuario(req), req.idRecurso, req.file) });
  }));

  r.get('/:id/comprobante', idValido, (req, res, next) => {
    const { ruta, tipo } = reservasService.obtenerComprobante(usuario(req), req.idRecurso);
    res.type(tipo).sendFile(ruta, (err) => err && next(err));
  });

  return r;
}

module.exports = { rutasReservas };
