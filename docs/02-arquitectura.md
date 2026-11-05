# 02 · Arquitectura (T2)

## Decisión (ADR-001)
**Monolito modular con patrón MVC en capas**, Node.js + Express, vistas EJS renderizadas en servidor, PostgreSQL.
- *Por qué:* equipo de 3, 5 semanas, requisitos que se afinan por sprint → un solo despliegue, simple de mantener. Microservicios se descartan (costo operativo sin beneficio a esta escala).
- *Cómo se evita el "spaghetti":* módulos verticales (auth, usuarios, personas, activos, solicitudes, reportes) y dependencias en una sola dirección.

## Capas y responsabilidades
```
 Navegador ──HTTP──▶ Routes ──▶ Middlewares ──▶ Controller ──▶ Service ──▶ Model ──SQL──▶ PostgreSQL
    ▲                                              │
    └────────── HTML (EJS View) ◀──────────────────┘
```
| Capa | Carpeta | Responsabilidad | Prohibido |
|------|---------|-----------------|-----------|
| Route | `src/routes` | URL + verbo + middlewares → controlador | Lógica |
| Middleware | `src/middlewares` | Sesión, rol, validación, errores | Reglas de negocio |
| Controller | `src/controllers` | Traducir HTTP ↔ servicio, elegir vista/redirect | SQL, reglas |
| Service | `src/services` | Reglas de negocio (p. ej. "solo asignar activos disponibles") | `req/res`, SQL |
| Model | `src/models` | Consultas SQL parametrizadas | Reglas, HTTP |
| View | `src/views` | Presentación EJS (layouts, partials, pages) | Consultas, reglas |

Regla de dependencia: `Route → Controller → Service → Model → DB`. Nunca hacia atrás.

## Buenas prácticas adoptadas
- **Separation of Concerns / SRP** por capa; controladores delgados, servicios testeables (objetivo O4).
- **Seguridad:** bcrypt, `express-session` con cookie `httpOnly`, consultas parametrizadas (anti SQLi), EJS con escape por defecto (anti XSS), autorización por rol en middleware, secretos en `.env`.
- **Errores:** un middleware central; los servicios lanzan errores de dominio.
- **Validación** de entrada en middleware antes del controlador.
- **Auditoría:** tabla `movimientos` + campos `creado_en/actualizado_en`.
- **Borrado lógico** (`activo = false`) para conservar trazabilidad.
- **Pruebas:** unitarias en servicios (Jest, modelos simulados) e integración con Supertest.
- **Git:** `main` (estable) ← `develop` ← `feature/<nombre>`; PR con revisión; release/tag por sprint.

## Flujo de ejemplo: asignar herramienta (HU-06)
1. `POST /activos/:id/asignar` → `auth` (sesión) → `role(['admin','supervisor'])` → `validate`.
2. `activos.controller.asignar` llama `activos.service.asignar(activoId, personaId, userId)`.
3. El servicio verifica estado = *disponible*; si no, lanza error de dominio.
4. El modelo ejecuta en transacción: insertar `asignaciones`, actualizar `activos.estado`, insertar `movimientos`.
5. El controlador redirige con mensaje flash; la vista refleja el nuevo estado.

## Mapa de módulos por sprint
S1 auth/usuarios/personas · S2 activos/asignaciones/solicitudes · S3 dashboard/reportes/pruebas · S4 aceptación/despliegue.
