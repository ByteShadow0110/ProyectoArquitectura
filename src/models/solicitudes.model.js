// Modelo de solicitudes: solo SQL parametrizado. `client` opcional para transacciones.
const db = require('../config/db');

const run = (client) => (client ? client.query.bind(client) : db.query);

const BASE_SELECT = `
  SELECT s.id, s.activo_id, s.solicitante_id, s.estado, s.motivo, s.motivo_resolucion, s.resuelta_por, s.creado_en, s.resuelta_en,
         ac.codigo, ac.nombre AS activo, ac.estado AS activo_estado,
         p.nombre || ' ' || p.apellidos AS solicitante
  FROM solicitudes s
  JOIN activos ac ON ac.id = s.activo_id
  JOIN personas p ON p.id = s.solicitante_id`;

function buildFilters({ estado, solicitanteId }) {
  const clauses = [];
  const params = [];
  if (estado) { params.push(estado); clauses.push(`s.estado = $${params.length}`); }
  if (solicitanteId) { params.push(solicitanteId); clauses.push(`s.solicitante_id = $${params.length}`); }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

module.exports = {
  async list(filters, { limit, offset }) {
    const { where, params } = buildFilters(filters);
    const { rows } = await db.query(
      `${BASE_SELECT} ${where} ORDER BY s.creado_en DESC, s.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    return rows;
  },

  async count(filters) {
    const { where, params } = buildFilters(filters);
    const { rows } = await db.query(`SELECT COUNT(*)::int AS total FROM solicitudes s ${where}`, params);
    return rows[0].total;
  },

  async findById(id, client, forUpdate = false) {
    const { rows } = await run(client)(`${BASE_SELECT} WHERE s.id = $1${forUpdate ? ' FOR UPDATE OF s' : ''}`, [id]);
    return rows[0] || null;
  },

  async findPendiente(activoId, solicitanteId) {
    const { rows } = await db.query(
      `SELECT id FROM solicitudes WHERE activo_id = $1 AND solicitante_id = $2 AND estado = 'pendiente'`,
      [activoId, solicitanteId]
    );
    return rows[0] || null;
  },

  async create({ activoId, solicitanteId, motivo }) {
    const { rows } = await db.query(
      'INSERT INTO solicitudes (activo_id, solicitante_id, motivo) VALUES ($1, $2, $3) RETURNING id',
      [activoId, solicitanteId, motivo]
    );
    return rows[0].id;
  },

  async resolver(id, { estado, motivoResolucion = null, usuarioId }, client) {
    await run(client)(
      `UPDATE solicitudes SET estado = $2, motivo_resolucion = $3, resuelta_por = $4, resuelta_en = now() WHERE id = $1`,
      [id, estado, motivoResolucion, usuarioId]
    );
  },

  transaction: (fn) => db.withTransaction(fn),

  async countPendientes() {
    const { rows } = await db.query(`SELECT COUNT(*)::int AS total FROM solicitudes WHERE estado = 'pendiente'`);
    return rows[0].total;
  },
};
