// Modelo de personas y áreas: solo SQL parametrizado, sin reglas de negocio.
const db = require('../config/db');

const BASE_SELECT = `
  SELECT p.id, p.nombre, p.apellidos, p.correo, p.telefono, p.puesto, p.area_id,
         p.fecha_ingreso, p.activo, p.creado_en, p.actualizado_en,
         a.nombre AS area
  FROM personas p
  LEFT JOIN areas a ON a.id = p.area_id`;

// Construye WHERE dinámico pero siempre con parámetros ($n).
function buildFilters({ q, areaId, estado }) {
  const clauses = [];
  const params = [];
  if (q) {
    params.push(`%${q}%`);
    const n = params.length;
    clauses.push(`(p.nombre ILIKE $${n} OR p.apellidos ILIKE $${n} OR (p.nombre || ' ' || p.apellidos) ILIKE $${n} OR p.puesto ILIKE $${n})`);
  }
  if (areaId) {
    params.push(areaId);
    clauses.push(`p.area_id = $${params.length}`);
  }
  if (estado === 'activos') clauses.push('p.activo = TRUE');
  if (estado === 'inactivos') clauses.push('p.activo = FALSE');
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

module.exports = {
  async list(filters, { limit, offset }) {
    const { where, params } = buildFilters(filters);
    const { rows } = await db.query(
      `${BASE_SELECT} ${where} ORDER BY p.apellidos, p.nombre LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    return rows;
  },

  async count(filters) {
    const { where, params } = buildFilters(filters);
    const { rows } = await db.query(`SELECT COUNT(*)::int AS total FROM personas p ${where}`, params);
    return rows[0].total;
  },

  async findById(id) {
    const { rows } = await db.query(`${BASE_SELECT} WHERE p.id = $1`, [id]);
    return rows[0] || null;
  },

  async findByCorreo(correo) {
    const { rows } = await db.query('SELECT id FROM personas WHERE lower(correo) = lower($1)', [correo]);
    return rows[0] || null;
  },

  async create({ nombre, apellidos, correo, telefono, puesto, areaId, fechaIngreso }) {
    const { rows } = await db.query(
      `INSERT INTO personas (nombre, apellidos, correo, telefono, puesto, area_id, fecha_ingreso)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [nombre, apellidos, correo, telefono, puesto, areaId, fechaIngreso]
    );
    return rows[0].id;
  },

  async update(id, { nombre, apellidos, correo, telefono, puesto, areaId, fechaIngreso }) {
    await db.query(
      `UPDATE personas
          SET nombre = $2, apellidos = $3, correo = $4, telefono = $5, puesto = $6,
              area_id = $7, fecha_ingreso = $8, actualizado_en = now()
        WHERE id = $1`,
      [id, nombre, apellidos, correo, telefono, puesto, areaId, fechaIngreso]
    );
  },

  async setActivo(id, activo) {
    await db.query('UPDATE personas SET activo = $2, actualizado_en = now() WHERE id = $1', [id, activo]);
  },

  async listSimple() {
    const { rows } = await db.query(
      `SELECT p.id, p.nombre, p.apellidos, a.nombre AS area
         FROM personas p LEFT JOIN areas a ON a.id = p.area_id
        WHERE p.activo = TRUE ORDER BY p.apellidos, p.nombre`
    );
    return rows;
  },

  async listAreas() {
    const { rows } = await db.query('SELECT id, nombre FROM areas ORDER BY nombre');
    return rows;
  },

  // Activos que la persona tiene hoy (se llenará en el Sprint 2 con las asignaciones).
  async listAsignaciones(personaId) {
    const { rows } = await db.query(
      `SELECT a.id AS asignacion_id, ac.codigo, ac.nombre, a.fecha_asignacion
         FROM asignaciones a
         JOIN activos ac ON ac.id = a.activo_id
        WHERE a.persona_id = $1 AND a.fecha_devolucion IS NULL
        ORDER BY a.fecha_asignacion DESC`,
      [personaId]
    );
    return rows;
  },

  async countAsignacionesActivas(personaId) {
    const { rows } = await db.query(
      'SELECT COUNT(*)::int AS total FROM asignaciones WHERE persona_id = $1 AND fecha_devolucion IS NULL',
      [personaId]
    );
    return rows[0].total;
  },

  async countActivas() {
    const { rows } = await db.query('SELECT COUNT(*)::int AS total FROM personas WHERE activo = TRUE');
    return rows[0].total;
  },
};
