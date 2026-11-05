# RefaccionesMX

Sistema web de gestión de **personal y activos** para una tienda de refacciones de dispositivos móviles.
Actividad Integradora – Arquitectura de Software 5B · Node.js (Express) · MVC · EJS · PostgreSQL.

## Estado
Sprint 0: requisitos, arquitectura y prototipo UI/UX (`prototype/index.html`).

## Estructura
- `docs/` requisitos, arquitectura, modelo de datos, UX
- `src/` aplicación MVC (routes → controllers → services → models, views EJS)
- `db/` esquema, migraciones, seeds · `tests/` pruebas · `prototype/` maqueta navegable

## Ejecutar (desde Sprint 1)
```bash
npm install
cp .env.example .env
npm run dev
```

## Flujo Git
`main` (estable) ← `develop` ← `feature/<nombre>`. Pull Request revisado por un compañero; release (tag) al cierre de cada sprint. Commits: `feat:`, `fix:`, `docs:`, `test:`.
