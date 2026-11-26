// Modelo de reportes e indicadores: solo lecturas con SQL parametrizado.
const db = require('../config/db');

module.exports = {
  // ---- Indicadores del dashboard ----
  async totalStockRefacciones() {
    const { rows } = await db.query(
      `SELECT COALESCE(SUM(a.stock), 0)::int AS total FROM activos a
         JOIN categorias c ON c.id = a.categoria_id WHERE a.activo = TRUE AND c.tipo = 'refaccion'`);
    return rows[0].total;
  },

  async countAsignados() {
    const { rows } = await db.query(`SELECT COUNT(*)::int AS total FROM activos WHERE activo = TRUE AND estado = 'asignado'`);
    return rows[0].total;
  },

  async countDisponibles() {
    const { rows } = await db.query(`SELECT COUNT(*)::int AS total FROM activos WHERE activo = TRUE AND estado = 'disponible'`);
    return rows[0].total;
  },

  async countSolicitudesPendientes(solicitanteId = null) {
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS total FROM solicitudes WHERE estado = 'pendiente' AND ($1::int IS NULL OR solicitante_id = $1)`,
      [solicitanteId]);
    return rows[0].total;
  },

  async countAsignadosA(personaId) {
    const { rows } = await db.query(
      'SELECT COUNT(*)::int AS total FROM asignaciones WHERE persona_id = $1 AND fecha_devolucion IS NULL', [personaId]);
    return rows[0].total;
  },

  async stockBajo(limit = null) {
    const { rows } = await db.query(
      `SELECT a.id, a.codigo, a.nombre, a.stock, a.stock_minimo
         FROM activos a JOIN categorias c ON c.id = a.categoria_id
        WHERE a.activo = TRUE AND c.tipo = 'refaccion' AND a.stock <= a.stock_minimo
        ORDER BY (a.stock - a.stock_minimo), a.nombre
        LIMIT COALESCE($1::int, 5000)`, [limit]);
    return rows;
  },

  async solicitudesRecientes(limit, solicitanteId = null) {
    const { rows } = await db.query(
      `SELECT s.id, s.estado, s.creado_en, ac.nombre AS activo, p.nombre || ' ' || p.apellidos AS solicitante
         FROM solicitudes s JOIN activos ac ON ac.id = s.activo_id JOIN personas p ON p.id = s.solicitante_id
        WHERE ($2::int IS NULL OR s.solicitante_id = $2)
        ORDER BY s.creado_en DESC, s.id DESC LIMIT $1`, [limit, solicitanteId]);
    return rows;
  },

  // ---- Reportes (RF-14) ----
  async activosPorEstado() {
    const { rows } = await db.query(
      `SELECT estado, COUNT(*)::int AS cantidad FROM activos GROUP BY estado ORDER BY estado`);
    return rows;
  },

  // Asignaciones (vigentes y devueltas) por persona y rango de fechas de asignación.
  async asignaciones({ personaId, areaId, desde, hasta }, limit) {
    const { rows } = await db.query(
      `SELECT p.nombre || ' ' || p.apellidos AS persona, ar.nombre AS area, ac.codigo, ac.nombre AS activo,
              s.fecha_asignacion, s.fecha_devolucion
         FROM asignaciones s
         JOIN personas p ON p.id = s.persona_id
         LEFT JOIN areas ar ON ar.id = p.area_id
         JOIN activos ac ON ac.id = s.activo_id
        WHERE ($1::int IS NULL OR s.persona_id = $1)
          AND ($2::int IS NULL OR p.area_id = $2)
          AND ($3::date IS NULL OR s.fecha_asignacion >= $3::date)
          AND ($4::date IS NULL OR s.fecha_asignacion < $4::date + 1)
        ORDER BY p.apellidos, p.nombre, s.fecha_asignacion DESC
        LIMIT $5`,
      [personaId, areaId, desde, hasta, limit]);
    return rows;
  },

  async movimientos({ tipo, desde, hasta }, limit) {
    const { rows } = await db.query(
      `SELECT m.creado_en, ac.codigo, ac.nombre AS activo, m.tipo, m.cantidad,
              COALESCE(p.nombre || ' ' || p.apellidos, u.correo) AS usuario, m.nota
         FROM movimientos m
         JOIN activos ac ON ac.id = m.activo_id
         LEFT JOIN usuarios u ON u.id = m.usuario_id
         LEFT JOIN personas p ON p.id = u.persona_id
        WHERE ($1::text IS NULL OR m.tipo = $1)
          AND ($2::date IS NULL OR m.creado_en >= $2::date)
          AND ($3::date IS NULL OR m.creado_en < $3::date + 1)
        ORDER BY m.creado_en DESC, m.id DESC
        LIMIT $4`,
      [tipo, desde, hasta, limit]);
    return rows;
  },
};
