// Modelo de activos, categorías, asignaciones y movimientos: solo SQL parametrizado.
// Los métodos que participan en transacciones aceptan un `client` opcional (db.withTransaction).
const db = require('../config/db');

const run = (client) => (client ? client.query.bind(client) : db.query);

const BASE_SELECT = `
  SELECT a.id, a.codigo, a.nombre, a.categoria_id, a.estado, a.stock, a.stock_minimo,
         a.modelos_compatibles, a.costo, a.activo, a.creado_en, a.actualizado_en,
         c.nombre AS categoria, c.tipo
  FROM activos a
  JOIN categorias c ON c.id = a.categoria_id`;

function buildFilters({ q, tipo, estado, vigencia }) {
  const clauses = [];
  const params = [];
  if (q) {
    params.push(`%${q}%`);
    const n = params.length;
    clauses.push(`(a.codigo ILIKE $${n} OR a.nombre ILIKE $${n} OR a.modelos_compatibles ILIKE $${n})`);
  }
  if (tipo) { params.push(tipo); clauses.push(`c.tipo = $${params.length}`); }
  if (estado) { params.push(estado); clauses.push(`a.estado = $${params.length}`); }
  if (vigencia === 'activos') clauses.push('a.activo = TRUE');
  if (vigencia === 'inactivos') clauses.push('a.activo = FALSE');
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

module.exports = {
  async list(filters, { limit, offset }) {
    const { where, params } = buildFilters(filters);
    const { rows } = await db.query(
      `${BASE_SELECT} ${where} ORDER BY a.nombre LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    return rows;
  },

  async count(filters) {
    const { where, params } = buildFilters(filters);
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS total FROM activos a JOIN categorias c ON c.id = a.categoria_id ${where}`, params);
    return rows[0].total;
  },

  // forUpdate bloquea la fila dentro de una transacción (evita doble asignación concurrente).
  async findById(id, client, forUpdate = false) {
    const { rows } = await run(client)(
      `${BASE_SELECT} WHERE a.id = $1${forUpdate ? ' FOR UPDATE OF a' : ''}`, [id]);
    return rows[0] || null;
  },

  async findByCodigo(codigo) {
    const { rows } = await db.query('SELECT id FROM activos WHERE lower(codigo) = lower($1)', [codigo]);
    return rows[0] || null;
  },

  async create({ codigo, nombre, categoriaId, stock, stockMinimo, modelosCompatibles, costo }, client) {
    const { rows } = await run(client)(
      `INSERT INTO activos (codigo, nombre, categoria_id, stock, stock_minimo, modelos_compatibles, costo)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [codigo, nombre, categoriaId, stock, stockMinimo, modelosCompatibles, costo]
    );
    return rows[0].id;
  },

  async update(id, { codigo, nombre, categoriaId, estado, stockMinimo, modelosCompatibles, costo }) {
    await db.query(
      `UPDATE activos
          SET codigo = $2, nombre = $3, categoria_id = $4, estado = $5, stock_minimo = $6,
              modelos_compatibles = $7, costo = $8, actualizado_en = now()
        WHERE id = $1`,
      [id, codigo, nombre, categoriaId, estado, stockMinimo, modelosCompatibles, costo]
    );
  },

  // Baja lógica: activo=false y estado 'baja'; reactivar lo deja 'disponible'.
  async setActivo(id, activo) {
    await db.query(
      `UPDATE activos SET activo = $2, estado = CASE WHEN $2 THEN 'disponible' ELSE 'baja' END, actualizado_en = now()
        WHERE id = $1`,
      [id, activo]
    );
  },

  transaction: (fn) => db.withTransaction(fn),

  async setEstado(id, estado, client) {
    await run(client)('UPDATE activos SET estado = $2, actualizado_en = now() WHERE id = $1', [id, estado]);
  },

  async setStock(id, stock, client) {
    await run(client)('UPDATE activos SET stock = $2, actualizado_en = now() WHERE id = $1', [id, stock]);
  },

  async listCategorias() {
    const { rows } = await db.query('SELECT id, nombre, tipo FROM categorias ORDER BY tipo, nombre');
    return rows;
  },

  // Activos individuales (herramienta/equipo) disponibles: base para nuevas solicitudes.
  async listSolicitables() {
    const { rows } = await db.query(
      `${BASE_SELECT} WHERE a.activo = TRUE AND a.estado = 'disponible' AND c.tipo <> 'refaccion' ORDER BY a.nombre`);
    return rows;
  },

  async insertMovimiento({ activoId, tipo, cantidad = 1, usuarioId, nota = null }, client) {
    await run(client)(
      'INSERT INTO movimientos (activo_id, tipo, cantidad, usuario_id, nota) VALUES ($1, $2, $3, $4, $5)',
      [activoId, tipo, cantidad, usuarioId, nota]
    );
  },

  async listMovimientos(activoId) {
    const { rows } = await db.query(
      `SELECT m.id, m.tipo, m.cantidad, m.nota, m.creado_en, COALESCE(p.nombre || ' ' || p.apellidos, u.correo) AS usuario
         FROM movimientos m
         LEFT JOIN usuarios u ON u.id = m.usuario_id
         LEFT JOIN personas p ON p.id = u.persona_id
        WHERE m.activo_id = $1 ORDER BY m.creado_en DESC, m.id DESC LIMIT 50`,
      [activoId]
    );
    return rows;
  },

  // ---- Asignaciones ----
  async findAsignacionVigente(activoId, client) {
    const { rows } = await run(client)(
      `SELECT s.id, s.persona_id, s.fecha_asignacion, p.nombre, p.apellidos, p.area_id
         FROM asignaciones s JOIN personas p ON p.id = s.persona_id
        WHERE s.activo_id = $1 AND s.fecha_devolucion IS NULL`,
      [activoId]
    );
    return rows[0] || null;
  },

  async insertAsignacion({ activoId, personaId, solicitudId = null, asignadoPor }, client) {
    const { rows } = await run(client)(
      `INSERT INTO asignaciones (activo_id, persona_id, solicitud_id, asignado_por)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [activoId, personaId, solicitudId, asignadoPor]
    );
    return rows[0].id;
  },

  async cerrarAsignacion(id, client) {
    await run(client)('UPDATE asignaciones SET fecha_devolucion = now() WHERE id = $1', [id]);
  },

  async countStockBajo() {
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS total FROM activos a JOIN categorias c ON c.id = a.categoria_id
        WHERE a.activo = TRUE AND c.tipo = 'refaccion' AND a.stock <= a.stock_minimo`);
    return rows[0].total;
  },

  async countActivos() {
    const { rows } = await db.query('SELECT COUNT(*)::int AS total FROM activos WHERE activo = TRUE');
    return rows[0].total;
  },
};
