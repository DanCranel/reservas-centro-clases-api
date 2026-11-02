'use strict';
/**
 * Puente entre la lógica de negocio y Socket.IO. Los servicios solo llaman
 * notificar(evento, datos, { usuarioId }); no saben que existe un socket.
 *  - La sala "admin" recibe todos los eventos.
 *  - La sala "usuario:<id>" recibe solo los eventos de sus reservas.
 *  - Eventos sin usuarioId (catálogo de servicios) se envían a todos.
 */
function crearNotificador() {
  let io = null;

  function notificar(evento, datos, { usuarioId } = {}) {
    if (!io) return;
    const mensaje = { evento, datos, fecha: new Date().toISOString() };
    if (usuarioId === undefined) {
      io.emit(evento, mensaje);
      return;
    }
    io.to('admin').to(`usuario:${usuarioId}`).emit(evento, mensaje);
  }

  /** Conecta Socket.IO reutilizando la sesión HTTP para autenticar el socket. */
  function conectar(servidorIo, middlewareSesion) {
    io = servidorIo;
    io.engine.use(middlewareSesion);
    io.use((socket, next) => {
      const usuario = socket.request.session?.usuario;
      return usuario ? next() : next(new Error('UNAUTHENTICATED'));
    });
    io.on('connection', (socket) => {
      const { id, rol, nombre } = socket.request.session.usuario;
      socket.join(rol === 'admin' ? 'admin' : `usuario:${id}`);
      socket.emit('bienvenida', { mensaje: `Conectado como ${nombre}`, rol });
    });
  }

  return { notificar, conectar };
}

module.exports = { crearNotificador };
