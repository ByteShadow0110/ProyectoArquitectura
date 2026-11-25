// Modelo de reportes: consultas parametrizadas sobre activos y sus movimientos.
const db = require('../config/db');

function addDateFilters(clauses, params, column, filters) {
  if (filters.desde) {
    params.push(filters.desde);
    clauses.push(`${column} >= $${params.length}::date`);
  }
  if (filters.hasta) {
    params.push(filters.hasta);
    clauses.push(`${column} < ($${params.length}::date + INTERVAL '1 day')`);
  }
}

function addCategoryFilter(clauses, params, filters) {
  if (filters.categoriaId) {
    params.push(filters.categoriaId);
    clauses.push(`c.id = $${params.length}`);
  }
}

function addPersonAreaFilters(clauses, params, filters, personColumn, areaColumn) {
  if (filters.personaId) {
    params.push(filters.personaId);
    clauses.push(`${personColumn} = $${params.length}`);
  }
  if (filters.areaId) {
    params.push(filters.areaId);
    clauses.push(`${areaColumn} = $${params.length}`);
  }
}

function where(clauses) {
  return clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
}

module.exports = {
  async getDashboardMetrics() {
    const { rows } = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE a.estado = 'disponible')::int AS disponibles,
         COUNT(*) FILTER (WHERE a.estado = 'asignado')::int AS asignados,
         COALESCE(SUM(a.stock) FILTER (WHERE c.tipo = 'refaccion'), 0)::int AS unidades_stock,
         (SELECT COUNT(*)::int FROM solicitudes WHERE estado = 'pendiente') AS solicitudes_pendientes,
         (SELECT COUNT(*)::int
            FROM activos al JOIN categorias ca ON ca.id = al.categoria_id
           WHERE al.activo = TRUE AND ca.tipo = 'refaccion' AND al.stock <= al.stock_minimo) AS alertas_stock
       FROM activos a
       JOIN categorias c ON c.id = a.categoria_id
       WHERE a.activo = TRUE`
    );
    return rows[0];
  },

  async listStockBajo(limit = 8) {
    const { rows } = await db.query(
      `SELECT a.id, a.codigo, a.nombre, a.stock, a.stock_minimo,
              c.nombre AS categoria
         FROM activos a
         JOIN categorias c ON c.id = a.categoria_id
        WHERE a.activo = TRUE AND c.tipo = 'refaccion' AND a.stock <= a.stock_minimo
        ORDER BY a.stock ASC, a.nombre
        LIMIT $1`,
      [limit]
    );
    return rows;
  },

  async listSolicitudesRecientes(limit = 5) {
    const { rows } = await db.query(
      `SELECT s.id, s.estado, s.creado_en,
              p.nombre || ' ' || p.apellidos AS solicitante,
              a.id AS activo_id, a.nombre AS activo
         FROM solicitudes s
         JOIN personas p ON p.id = s.solicitante_id
         JOIN activos a ON a.id = s.activo_id
        ORDER BY s.creado_en DESC, s.id DESC
        LIMIT $1`,
      [limit]
    );
    return rows;
  },

  async listMovimientosRecientes(limit = 8) {
    const { rows } = await db.query(
      `SELECT m.id, m.tipo, m.cantidad, m.nota, m.creado_en,
              a.id AS activo_id, a.codigo, a.nombre AS activo,
              COALESCE(p.nombre || ' ' || p.apellidos, u.correo, 'Usuario eliminado') AS usuario
         FROM movimientos m
         JOIN activos a ON a.id = m.activo_id
         LEFT JOIN usuarios u ON u.id = m.usuario_id
         LEFT JOIN personas p ON p.id = u.persona_id
        ORDER BY m.creado_en DESC, m.id DESC
        LIMIT $1`,
      [limit]
    );
    return rows;
  },

  async listCategorias() {
    const { rows } = await db.query('SELECT id, nombre, tipo FROM categorias ORDER BY nombre');
    return rows;
  },

  async listPersonasYAreas() {
    const [people, areas] = await Promise.all([
      db.query(
        `SELECT p.id, p.nombre || ' ' || p.apellidos AS nombre, p.area_id
           FROM personas p
          WHERE p.activo = TRUE
          ORDER BY p.apellidos, p.nombre`
      ),
      db.query('SELECT id, nombre FROM areas ORDER BY nombre'),
    ]);
    return { personas: people.rows, areas: areas.rows };
  },

  async listActivosPorEstado(filters) {
    const clauses = [];
    const params = [];
    addDateFilters(clauses, params, 'a.creado_en', filters);
    addCategoryFilter(clauses, params, filters);
    if (filters.estado) {
      params.push(filters.estado);
      clauses.push(`a.estado = $${params.length}`);
    }
    addPersonAreaFilters(clauses, params, filters, 'p.id', 'p.area_id');
    const { rows } = await db.query(
      `SELECT a.estado, COUNT(*)::int AS cantidad,
              ROUND(COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0), 1) AS porcentaje
         FROM activos a
         JOIN categorias c ON c.id = a.categoria_id
         LEFT JOIN asignaciones ag ON ag.activo_id = a.id AND ag.fecha_devolucion IS NULL
         LEFT JOIN personas p ON p.id = ag.persona_id
         ${where(clauses)}
        GROUP BY a.estado
        ORDER BY CASE a.estado
          WHEN 'disponible' THEN 1 WHEN 'asignado' THEN 2
          WHEN 'mantenimiento' THEN 3 ELSE 4 END`,
      params
    );
    return rows;
  },

  async listAsignaciones(filters) {
    const clauses = [];
    const params = [];
    addDateFilters(clauses, params, 'ag.fecha_asignacion', filters);
    addCategoryFilter(clauses, params, filters);
    addPersonAreaFilters(clauses, params, filters, 'p.id', 'p.area_id');
    if (filters.estado) {
      clauses.push(filters.estado === 'vigente'
        ? 'ag.fecha_devolucion IS NULL'
        : 'ag.fecha_devolucion IS NOT NULL');
    }
    const { rows } = await db.query(
      `SELECT ag.id, ag.fecha_asignacion, ag.fecha_devolucion,
              a.codigo, a.nombre AS activo, c.nombre AS categoria,
              p.nombre || ' ' || p.apellidos AS persona, ar.nombre AS area,
              CASE WHEN ag.fecha_devolucion IS NULL THEN 'vigente' ELSE 'devuelta' END AS estado
         FROM asignaciones ag
         JOIN activos a ON a.id = ag.activo_id
         JOIN categorias c ON c.id = a.categoria_id
         JOIN personas p ON p.id = ag.persona_id
         LEFT JOIN areas ar ON ar.id = p.area_id
         ${where(clauses)}
        ORDER BY ag.fecha_asignacion DESC, ag.id DESC`,
      params
    );
    return rows;
  },

  async listMovimientos(filters) {
    const clauses = [];
    const params = [];
    addDateFilters(clauses, params, 'm.creado_en', filters);
    addCategoryFilter(clauses, params, filters);
    addPersonAreaFilters(clauses, params, filters, 'p.id', 'p.area_id');
    if (filters.estado) {
      params.push(filters.estado);
      clauses.push(`m.tipo = $${params.length}`);
    }
    const { rows } = await db.query(
      `SELECT m.id, m.creado_en, m.tipo, m.cantidad, m.nota,
              a.codigo, a.nombre AS activo, c.nombre AS categoria,
              COALESCE(p.nombre || ' ' || p.apellidos, u.correo, 'Usuario eliminado') AS usuario,
              ar.nombre AS area
         FROM movimientos m
         JOIN activos a ON a.id = m.activo_id
         JOIN categorias c ON c.id = a.categoria_id
         LEFT JOIN usuarios u ON u.id = m.usuario_id
         LEFT JOIN personas p ON p.id = u.persona_id
         LEFT JOIN areas ar ON ar.id = p.area_id
         ${where(clauses)}
        ORDER BY m.creado_en DESC, m.id DESC`,
      params
    );
    return rows;
  },

  async listStockBajoReporte(filters) {
    const clauses = ["a.activo = TRUE", "c.tipo = 'refaccion'", 'a.stock <= a.stock_minimo'];
    const params = [];
    addDateFilters(clauses, params, 'a.creado_en', filters);
    addCategoryFilter(clauses, params, filters);
    const { rows } = await db.query(
      `SELECT a.codigo, a.nombre, c.nombre AS categoria, a.stock, a.stock_minimo
         FROM activos a
         JOIN categorias c ON c.id = a.categoria_id
         ${where(clauses)}
        ORDER BY a.stock ASC, a.nombre`,
      params
    );
    return rows;
  },
};
