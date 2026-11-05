# 01 · Requisitos (T1 – Sprint 0)

**Sistema:** RefaccionesMX – gestión de personal y activos de una tienda de refacciones para dispositivos móviles.
**Equipo:** Oscar Uriel Montañez Cuevas, Christian Alexander Hernández Palacios, Jorge Guzmán · **Profesor:** Jorge Javier Camacho Cortés

## 1. Problema
La tienda controla empleados, refacciones (pantallas, baterías, flex, módulos de carga), herramientas de taller y equipos en hojas de cálculo, papel y chats. Consecuencias: registros duplicados, sin trazabilidad, no se sabe quién tiene qué herramienta ni cuánto stock hay, reportes lentos.

## 2. Objetivos medibles (del PDF)
| ID | Objetivo |
|----|----------|
| O1 | 100% de requisitos documentados y validados por escrito por el cliente |
| O2 | Sistema web con 4 módulos en 5 semanas: usuarios y roles, personas, activos, reportes |
| O3 | Registrar/consultar una persona o activo: de ≥15 min a ≤2 min |
| O4 | ≥90% casos de prueba aprobados y ≥70% cobertura en lógica crítica |

## 3. Actores y roles
| Rol | Quién | Alcance |
|-----|-------|---------|
| Administrador | Dueño/gerente | Todo, incluida gestión de usuarios y roles |
| Supervisor | Encargado de sucursal/taller | Personas y activos, aprobar solicitudes, reportes |
| Operativo | Vendedor/técnico | Consultar, registrar movimientos, solicitar herramientas |

## 4. Glosario
- **Persona**: empleado de la tienda con expediente y área (Ventas, Taller, Almacén, Administración).
- **Activo**: bien gestionado. Tipos: *Refacción* (con SKU, stock, modelos compatibles), *Herramienta* (destornilladores, estación de calor, microscopio) y *Equipo* (PC, caja registradora).
- **Asignación**: entrega de un activo a una persona, con fecha y estado.
- **Solicitud**: petición de un activo que requiere aprobación.
- **Movimiento**: entrada, salida, asignación o devolución (bitácora).

## 5. Requisitos funcionales
### Módulo A – Usuarios y roles
- RF-01 Iniciar y cerrar sesión.
- RF-02 CRUD de usuarios (solo Admin); asociar usuario ↔ persona.
- RF-03 Asignar rol y activar/desactivar usuario.
- RF-04 Restringir acciones y pantallas según rol.
### Módulo B – Personas
- RF-05 Alta/edición/baja lógica de empleados (datos, área, puesto, fecha ingreso).
- RF-06 Búsqueda por nombre, área o estado.
- RF-07 Expediente: datos + activos asignados + historial.
### Módulo C – Activos
- RF-08 Alta/edición/baja lógica de activos con categoría y estado (disponible, asignado, mantenimiento, baja).
- RF-09 Refacciones: SKU, stock, stock mínimo, modelos compatibles, alerta de stock bajo.
- RF-10 Asignar/devolver activo a persona (quién tiene qué).
- RF-11 Solicitudes de activos con aprobación/rechazo del Supervisor.
- RF-12 Bitácora de movimientos por activo.
### Módulo D – Dashboard y reportes
- RF-13 Dashboard con KPIs (stock bajo, activos asignados, solicitudes pendientes).
- RF-14 Reportes filtrables: activos por estado, asignaciones por persona, movimientos por fecha.
- RF-15 Exportar reporte a CSV/PDF.

## 6. Requisitos no funcionales
- RNF-01 Seguridad: contraseñas con hash (bcrypt), sesiones seguras, consultas parametrizadas, control de acceso por rol.
- RNF-02 Rendimiento: páginas de lista < 2 s con 5,000 registros.
- RNF-03 Usabilidad: registrar/consultar en ≤ 2 min; interfaz responsive.
- RNF-04 Mantenibilidad: MVC por capas, lógica en servicios, ≥70% cobertura en lógica crítica.
- RNF-05 Compatibilidad: navegadores actuales (Chrome, Edge, Firefox).
- RNF-06 Trazabilidad: toda modificación registra usuario y fecha.
- RNF-07 Disponibilidad de respaldo: respaldo de BD (plan de mantenimiento).

## 7. Historias de usuario (con criterios de aceptación)
| ID | Historia | Criterios de aceptación | RF |
|----|----------|-------------------------|----|
| HU-01 | Como usuario quiero iniciar sesión para acceder según mi rol | Credenciales válidas → dashboard; inválidas → mensaje sin revelar cuál falló | RF-01 |
| HU-02 | Como Admin quiero crear usuarios y asignarles rol | Correo único; rol obligatorio; contraseña ≥ 8 caracteres | RF-02/03 |
| HU-03 | Como Supervisor quiero registrar un empleado en < 2 min | Campos obligatorios validados; aparece en la lista al guardar | RF-05 |
| HU-04 | Como Operativo quiero buscar un empleado y ver sus activos | Búsqueda por nombre devuelve resultados al teclear; expediente muestra asignaciones | RF-06/07 |
| HU-05 | Como Supervisor quiero registrar una refacción con SKU y stock | SKU único; stock ≥ 0; modelos compatibles opcionales | RF-08/09 |
| HU-06 | Como Supervisor quiero asignar una herramienta a un técnico | Solo activos "disponibles"; queda en bitácora; estado → asignado | RF-10/12 |
| HU-07 | Como Operativo quiero solicitar una herramienta | Solicitud en estado pendiente; notifica al Supervisor | RF-11 |
| HU-08 | Como Supervisor quiero aprobar/rechazar solicitudes | Al aprobar se crea la asignación; al rechazar se pide motivo | RF-11 |
| HU-09 | Como Admin quiero ver alertas de stock bajo | Dashboard lista refacciones con stock ≤ mínimo | RF-09/13 |
| HU-10 | Como Admin quiero reportes exportables | Filtros por fecha/estado/persona; descarga CSV | RF-14/15 |

## 8. Matriz rol × permiso
| Función | Admin | Supervisor | Operativo |
|---------|:-----:|:----------:|:---------:|
| Gestionar usuarios y roles | ✔ | ✘ | ✘ |
| Alta/edición de personas | ✔ | ✔ | ✘ |
| Consultar personas | ✔ | ✔ | ✔ |
| Alta/edición de activos | ✔ | ✔ | ✘ |
| Consultar activos | ✔ | ✔ | ✔ |
| Asignar/devolver activos | ✔ | ✔ | ✘ |
| Crear solicitud | ✔ | ✔ | ✔ |
| Aprobar solicitud | ✔ | ✔ | ✘ |
| Dashboard | ✔ | ✔ | Básico |
| Reportes y exportar | ✔ | ✔ | ✘ |

## 9. Supuestos y fuera de alcance
- Una sola sucursal; sin punto de venta ni facturación; sin app móvil nativa.
- Pendiente de validar por escrito con el cliente (O1): lista de áreas, categorías de activos y reportes requeridos.

## 10. Trazabilidad pantalla ↔ historia ↔ tabla
| Pantalla (prototype/) | Historias | Tablas |
|-----------------------|-----------|--------|
| login.html | HU-01 | usuarios |
| dashboard.html | HU-09 | activos, solicitudes, asignaciones |
| usuarios.html / usuario-form.html | HU-02 | usuarios, roles |
| personas.html / persona-detalle.html / persona-form.html | HU-03, HU-04 | personas, areas, asignaciones |
| activos.html / activo-detalle.html / activo-form.html | HU-05, HU-06 | activos, categorias, asignaciones, movimientos |
| solicitudes.html | HU-07, HU-08 | solicitudes |
| reportes.html | HU-10 | vistas sobre todas |
