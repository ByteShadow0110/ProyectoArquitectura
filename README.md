# RefaccionesMX

Sistema web de gestión de **personal y activos** para una tienda de refacciones de dispositivos móviles.
Actividad Integradora – Arquitectura de Software 5B · Node.js (Express) · MVC · EJS · PostgreSQL.

## Estado
Módulos T7–T9: activos, asignaciones y solicitudes con persistencia PostgreSQL y vistas EJS.
Autenticación y los módulos de usuarios y personas siguen pendientes; los módulos protegidos
esperan que el middleware de autenticación establezca `req.session.user` con `id`,
`persona_id` y `rol` (`admin`, `supervisor` u `operativo`).

## Estructura
- `docs/` requisitos, arquitectura, modelo de datos, UX
- `src/` aplicación MVC (routes → controllers → services → models, views EJS)
- `db/` esquema, migraciones, seeds · `tests/` pruebas · `prototype/` maqueta navegable
- `src/views/` vistas del módulo de activos, asignaciones y solicitudes

## Módulos T7–T9
- Activos: búsqueda y filtros, alta/edición, baja lógica, stock y bitácora.
- Asignaciones: asignación de herramientas/equipos disponibles y registro de devolución.
- Solicitudes: creación por usuario autenticado y aprobación/rechazo por Admin o Supervisor.
- Aplica `db/schema.sql` y después `db/seeds/01_roles.sql` para inicializar roles.
  Los flujos de asignación operan sobre categorías `herramienta` y `equipo`
  (las refacciones se gestionan por stock).

## Ejecutar (desde Sprint 1)
```bash
npm install
cp .env.example .env
npm run dev
```

## Flujo Git
`main` (estable) ← `develop` ← `feature/<nombre>`. Pull Request revisado por un compañero; release (tag) al cierre de cada sprint. Commits: `feat:`, `fix:`, `docs:`, `test:`.
