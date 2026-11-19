// Modelo de usuarios y roles: solo SQL parametrizado, sin reglas de negocio.
const db = require('../config/db');

const BASE_SELECT = `
  SELECT u.id, u.correo, u.password_hash, u.activo, u.persona_id, u.rol_id, u.creado_en,
         r.nombre AS rol,
         p.nombre || ' ' || p.apellidos AS persona_nombre,
         p.area_id
  FROM usuarios u
  JOIN roles r ON r.id = u.rol_id
  LEFT JOIN personas p ON p.id = u.persona_id`;

module.exports = {
  async findByCorreo(correo) {
    const { rows } = await db.query(`${BASE_SELECT} WHERE lower(u.correo) = lower($1)`, [correo]);
    return rows[0] || null;
  },

  async findById(id) {
    const { rows } = await db.query(`${BASE_SELECT} WHERE u.id = $1`, [id]);
    return rows[0] || null;
  },

  async findByPersonaId(personaId) {
    const { rows } = await db.query('SELECT id FROM usuarios WHERE persona_id = $1', [personaId]);
    return rows[0] || null;
  },

  async list({ q } = {}) {
    const params = [];
    let where = '';
    if (q) {
      params.push(`%${q}%`);
      where = 'WHERE u.correo ILIKE $1 OR p.nombre ILIKE $1 OR p.apellidos ILIKE $1';
    }
    const { rows } = await db.query(`${BASE_SELECT} ${where} ORDER BY u.correo`, params);
    return rows;
  },

  async create({ personaId, correo, passwordHash, rolId, activo }) {
    const { rows } = await db.query(
      `INSERT INTO usuarios (persona_id, correo, password_hash, rol_id, activo)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [personaId, correo, passwordHash, rolId, activo]
    );
    return rows[0].id;
  },

  // passwordHash es opcional: si es null no se cambia la contraseña.
  async update(id, { personaId, correo, passwordHash, rolId, activo }) {
    await db.query(
      `UPDATE usuarios
          SET persona_id = $2, correo = $3, rol_id = $4, activo = $5,
              password_hash = COALESCE($6, password_hash)
        WHERE id = $1`,
      [id, personaId, correo, rolId, activo, passwordHash]
    );
  },

  async setActivo(id, activo) {
    await db.query('UPDATE usuarios SET activo = $2 WHERE id = $1', [id, activo]);
  },

  async listRoles() {
    const { rows } = await db.query('SELECT id, nombre FROM roles ORDER BY id');
    return rows;
  },
};
