'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

/** E/S de archivos aislada en un módulo: el resto del código no toca el disco. */
function crearArchivosStore(directorio) {
  const ruta = (nombre) => path.join(directorio, path.basename(nombre)); // basename evita path traversal
  return {
    ruta,
    async guardar(buffer, ext) {
      await fs.mkdir(directorio, { recursive: true });
      const nombre = `${crypto.randomUUID()}.${ext}`;
      await fs.writeFile(ruta(nombre), buffer, { flag: 'wx' });
      return nombre;
    },
    async eliminar(nombre) {
      if (!nombre) return;
      await fs.rm(ruta(nombre), { force: true });
    },
  };
}

module.exports = { crearArchivosStore };
