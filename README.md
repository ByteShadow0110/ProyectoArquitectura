# RefaccionesMX

Sistema web de gestión de **personal y activos** para una tienda de refacciones de dispositivos móviles.
Actividad Integradora – Arquitectura de Software 5B · Node.js (Express) · MVC · EJS · PostgreSQL.

## Estado
- **Sprint 0:** requisitos, arquitectura y maqueta UI/UX (`prototype/index.html`).
- **Sprint 1:** interfaz base, autenticación y roles, módulo Personas. ✅
- Siguiente: Sprint 2 (activos, asignaciones y solicitudes).

## Estructura
```
src/
  routes/        URL + middlewares -> controlador
  controllers/   HTTP <-> servicio (delgados)
  services/      reglas de negocio (aquí se prueba)
  models/        SQL parametrizado (PostgreSQL)
  middlewares/   sesión, roles, CSRF, errores
  views/         EJS (partials + pages por módulo)
  public/        css, js
db/              schema.sql y seeds/
tests/           unit/ (servicios) e integration/ (HTTP)
prototype/       maqueta HTML navegable
```
Dependencia en una sola dirección: `Route → Controller → Service → Model → DB`.

## Requisitos
- [Node.js](https://nodejs.org) LTS
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (para PostgreSQL)

## Ejecutar
```bash
npm install
cp .env.example .env        # y cambia SESSION_SECRET
docker compose up -d        # PostgreSQL con esquema y datos de prueba
npm run dev                 # http://localhost:3000
```
Para reiniciar la base de datos desde cero: `docker compose down -v && docker compose up -d`.

## Pruebas
```bash
npm test                    # unitarias + integración, con cobertura
```

## Credenciales de desarrollo
Usuarios creados por `db/seeds/01_seed.sql` (solo desarrollo; la contraseña de todos está en ese archivo):

| Correo | Rol |
|--------|-----|
| admin@tienda.com | Administrador |
| ana.torres@tienda.com | Supervisor (área Taller) |
| luis.ramos@tienda.com | Operativo |

## Seguridad aplicada
Contraseñas con bcrypt, sesiones en PostgreSQL con cookie `httpOnly`, token CSRF en formularios, consultas parametrizadas, escape de salida en EJS, cabeceras con Helmet (CSP), límite de intentos de inicio de sesión y autorización por rol en el servidor.

## Flujo Git
`main` (estable) ← `develop` ← `feature/<nombre>`. Pull Request revisado por un compañero; release (tag) al cierre de cada sprint. Commits: `feat:`, `fix:`, `docs:`, `test:`.
