# RefaccionesMX

Sistema web de gestión de **personal y activos** para una tienda de refacciones de dispositivos móviles.
Actividad Integradora – Arquitectura de Software 5B · Node.js (Express) · MVC · EJS · PostgreSQL.

## Estado
- **Sprint 0:** requisitos, arquitectura y maqueta UI/UX (`prototype/index.html`).
- **Sprint 1:** interfaz base, autenticación y roles, módulo Personas. ✅
- **Sprint 2:** módulo Activos (T7), asignaciones y solicitudes (T8), vistas y navegación de los módulos (T9). ✅
- **Sprint 3:** dashboard con indicadores reales, reportes con exportación (T10) y pruebas/correcciones (T11). ✅
- Siguiente: Sprint 4 (aceptación, despliegue y capacitación).

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

## Módulos del Sprint 2
| Ruta | Quién | Qué hace |
|------|-------|----------|
| `/activos` | todos consultan; admin/supervisor gestionan | Listado con filtros (SKU, tipo, estado), alta/edición/baja lógica, alerta de stock bajo |
| `/activos/:id` | todos | Detalle, asignación vigente y bitácora de movimientos |
| `/activos/:id/asignar` y `/devolver` | admin/supervisor | Asignar herramientas/equipos disponibles a una persona (el supervisor, solo de su área) y devolverlos |
| `/activos/:id/movimiento` | admin/supervisor | Entradas, salidas y ajustes de stock de refacciones (nunca negativo) |
| `/solicitudes` | operativo ve las suyas; admin/supervisor todas | Solicitar un activo; aprobar (crea la asignación) o rechazar con motivo obligatorio |

Las asignaciones, aprobaciones y movimientos de stock se ejecutan en transacción con bloqueo de fila. El esquema (`db/schema.sql`) añade `solicitudes.motivo_resolucion`; para aplicarlo reinicia la BD con `docker compose down -v && docker compose up -d`.

## Dashboard y reportes (Sprint 3)
- **Dashboard** (`/dashboard`): admin y supervisor ven refacciones en stock, alertas de stock bajo, activos asignados y solicitudes pendientes, con la lista de stock bajo y las solicitudes recientes. El operativo ve una versión básica con solo lo suyo.
- **Reportes** (`/reportes`, solo admin y supervisor): activos por estado, asignaciones por persona, movimientos por fecha y stock bajo, con filtros por fecha, persona y tipo de movimiento. El supervisor solo ve personas de su área.
- **Exportar:** CSV (`/reportes/csv`, abre bien en Excel y neutraliza fórmulas) y PDF con el botón *Imprimir / PDF* del navegador.

## Seguridad aplicada
Contraseñas con bcrypt, sesiones en PostgreSQL con cookie `httpOnly`, token CSRF en formularios, consultas parametrizadas, escape de salida en EJS, cabeceras con Helmet (CSP), límite de intentos de inicio de sesión y autorización por rol en el servidor.

## Flujo Git
`main` (estable) ← `develop` ← `feature/<nombre>`. Pull Request revisado por un compañero; release (tag) al cierre de cada sprint. Commits: `feat:`, `fix:`, `docs:`, `test:`.
