'use strict';
const express = require('express');
const { requiereAdmin, idValido } = require('../middleware');

function rutasServicios({ serviciosService }) {
  const r = express.Router();
  const esAdmin = (req) => req.session?.usuario?.rol === 'admin';

  r.get('/', (req, res) => res.json({ data: serviciosService.listar({ esAdmin: esAdmin(req) }) }));
  r.get('/:id', idValido, (req, res) => res.json({ data: serviciosService.obtener(req.idRecurso) }));

  r.post('/', requiereAdmin, (req, res) => {
    const servicio = serviciosService.crear(req.body);
    res.status(201).location(`/api/servicios/${servicio.id}`).json({ data: servicio });
  });

  r.put('/:id', requiereAdmin, idValido, (req, res) =>
    res.json({ data: serviciosService.actualizar(req.idRecurso, req.body) }));

  r.delete('/:id', requiereAdmin, idValido, (req, res) => {
    serviciosService.eliminar(req.idRecurso);
    res.status(204).end();
  });

  return r;
}

module.exports = { rutasServicios };
