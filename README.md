# API REST de reservas · Centro de Clases Paute

Tarea Unidad 2 · Aplicaciones Web · Universidad Politécnica Salesiana
Autor: Daniel Morales

API para gestionar reservas de clases (resolución de tareas, recuperación, control de tareas y programación) con **Node.js + Express**, persistencia en **SQLite**, **sesiones** con cookie, **subida de archivos** (comprobante de pago) y **notificaciones en tiempo real** con Socket.IO. Incluye una página de demostración en `/`.

## Requisitos y ejecución

- Node.js **22.13 o superior** (usa el módulo integrado `node:sqlite`; no hay que instalar ninguna base de datos).

```bash
npm install
npm start            # http://localhost:3000  (crea data/reservas.db y datos de ejemplo)
npm test             # 40 pruebas automáticas (unitarias, integración y tiempo real)
```

Usuarios de ejemplo: `admin@tejiendoredes.ec / Admin123!` (admin) · `maria@correo.com / Maria123!` (estudiante).
Variables opcionales: `PORT`, `DB_FILE`, `UPLOADS_DIR`, `SESSION_SECRET`.

## Arquitectura en capas

```
src/
  domain/         Reglas PURAS: validadores, horarios, solapamientos, transiciones, DTOs, detección de tipo de archivo
  repositories/   E/S: consultas SQL parametrizadas y manejo de archivos en disco
  services/       Casos de uso: orquestan dominio + repositorios + notificaciones (dependencias inyectadas)
  http/           Rutas Express y middleware (sesión, roles, validación de :id, errores uniformes)
  realtime/       Notificador Socket.IO (salas por rol/usuario)
  session/        Almacén de sesiones en SQLite
  db/             Esquema, conexión, transacciones y datos semilla
public/           Página de demostración (login, reservas, comprobantes y panel en vivo)
tests/            node:test + supertest + socket.io-client
docs/             Colección Postman, archivo .http y evidencias
```

## Endpoints

| Método | Ruta | Descripción | Éxito |
|---|---|---|---|
| POST | `/api/auth/register` | Registro (abre sesión) | 201 |
| POST | `/api/auth/login` | Inicio de sesión | 200 |
| POST | `/api/auth/logout` | Cierra la sesión | 204 |
| GET | `/api/auth/me` | Usuario de la sesión | 200 |
| GET | `/api/servicios` | Catálogo (público) | 200 |
| GET | `/api/servicios/:id` | Detalle | 200 |
| POST | `/api/servicios` | Crear (admin) | 201 + `Location` |
| PUT | `/api/servicios/:id` | Reemplazar (admin, requiere `version`) | 200 |
| DELETE | `/api/servicios/:id` | Eliminar (admin) | 204 |
| GET | `/api/reservas?fecha&estado&servicioId&page&limit` | Listar (estudiante: solo las suyas) | 200 |
| GET | `/api/reservas/:id` | Detalle | 200 |
| POST | `/api/reservas` | Crear | 201 + `Location` |
| PATCH | `/api/reservas/:id` | Reprogramar / cambiar estado (requiere `version`) | 200 |
| DELETE | `/api/reservas/:id` | Eliminar (estudiante: solo pendientes) | 204 |
| PUT | `/api/reservas/:id/comprobante` | Subir comprobante (`multipart`, campo `comprobante`) | 200 |
| GET | `/api/reservas/:id/comprobante` | Descargar comprobante | 200 |

### Formato uniforme de errores

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Los datos enviados no son válidos.",
             "details": [ { "campo": "fecha", "mensaje": "el centro atiende de lunes a sábado" } ] } }
```

Códigos: `400 VALIDATION_ERROR / INVALID_JSON`, `401 UNAUTHENTICATED / INVALID_CREDENTIALS`, `403 FORBIDDEN`, `404 NOT_FOUND / ROUTE_NOT_FOUND`, `409 EMAIL_EN_USO / NOMBRE_DUPLICADO / VERSION_CONFLICTO / CUPO_LLENO / RESERVA_DUPLICADA / TRANSICION_INVALIDA / RESERVA_CANCELADA / SERVICIO_CON_RESERVAS`, `413 FILE_TOO_LARGE`, `415 UNSUPPORTED_FILE`, `500 INTERNAL_ERROR`.

### Ejemplo

```http
POST /api/reservas
Content-Type: application/json

{ "servicioId": 2, "estudianteNombre": "Sofía Pérez", "fecha": "2026-11-03", "horaInicio": "15:00", "duracionMin": 60 }
```

```json
HTTP/1.1 201 Created
Location: /api/reservas/1

{ "data": { "id": 1, "usuarioId": 2, "servicio": { "id": 2, "nombre": "Clases de recuperación" },
  "estudianteNombre": "Sofía Pérez", "fecha": "2026-11-03", "horaInicio": "15:00", "horaFin": "16:00",
  "duracionMin": 60, "notas": "", "estado": "pendiente", "tieneComprobante": false, "version": 1, ... } }
```

## Reglas de negocio

- Atención de lunes a sábado, 08:00–20:00; duraciones de 60, 90 o 120 min; no se reserva en el pasado.
- Cada servicio tiene un **cupo** por franja; si se llena → `409 CUPO_LLENO`.
- Un mismo estudiante no puede tener dos reservas cruzadas → `409 RESERVA_DUPLICADA`.
- Estados: `pendiente → confirmada | cancelada`, `confirmada → cancelada`. Solo administración confirma.
- **Concurrencia optimista**: cada actualización envía `version`; si otra persona modificó el registro → `409 VERSION_CONFLICTO` con la versión actual.

## Tiempo real (Socket.IO)

El socket se autentica con la **misma cookie de sesión**. Administración recibe todos los eventos; cada estudiante solo los de sus reservas.

Eventos: `reserva:creada`, `reserva:actualizada`, `reserva:eliminada`, `reserva:comprobante`, `servicio:creado`, `servicio:actualizado`, `servicio:eliminado`. Carga útil: `{ evento, datos, fecha }`.

## Seguridad

Consultas parametrizadas, contraseñas con `scrypt` + sal y comparación en tiempo constante, regeneración del id de sesión al iniciar sesión, cookie `HttpOnly` + `SameSite=Lax` (+ `Secure` en producción), rechazo de campos no permitidos, tipo de archivo verificado por sus bytes, nombres de archivo aleatorios, límites de tamaño (JSON 20 KB, archivo 2 MB) y cabeceras `nosniff` / `X-Frame-Options`.

## Pruebas

- `npm test`: 40 pruebas (dominio puro, endpoints, archivos, sesiones y tiempo real) con BD en memoria y reloj fijo.
- `docs/coleccion-postman.json`: 30 peticiones y 53 aserciones. Con el servidor recién iniciado:
  `npx newman run docs/coleccion-postman.json --working-dir docs`
- `docs/requests.http`: misma colección para la extensión REST Client de VS Code.
