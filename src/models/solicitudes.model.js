// Modelo "solicitudes": acceso a PostgreSQL con consultas parametrizadas ($1, $2...).
const db = require('../config/db');

module.exports = {
  async list(estado) {
    const values = [];
    const where = estado ? 'WHERE s.estado = $1' : '';
    if (estado) values.push(estado);
    const { rows } = await db.query(
      `SELECT s.id, s.estado, s.motivo, s.motivo_resolucion, s.creado_en, s.resuelta_en,
              a.id AS activo_id, a.codigo, a.nombre AS activo,
              p.nombre || ' ' || p.apellidos AS solicitante,
              COALESCE(u.correo, '') AS resuelto_por
       FROM solicitudes s
       JOIN activos a ON a.id = s.activo_id
       JOIN personas p ON p.id = s.solicitante_id
       LEFT JOIN usuarios u ON u.id = s.resuelta_por
       ${where}
       ORDER BY CASE WHEN s.estado = 'pendiente' THEN 0 ELSE 1 END,
                s.creado_en DESC`,
      values
    );
    return rows;
  },

  async listAvailableAssets() {
    const { rows } = await db.query(
      `SELECT a.id, a.codigo, a.nombre
       FROM activos a
       JOIN categorias c ON c.id = a.categoria_id
       WHERE a.activo = TRUE AND a.estado = 'disponible'
         AND c.tipo IN ('herramienta', 'equipo')
       ORDER BY a.nombre`
    );
    return rows;
  },

  async create({ activoId, solicitanteId, motivo }) {
    return db.transaction(async client => {
      const { rows: people } = await client.query(
        'SELECT activo FROM personas WHERE id = $1',
        [solicitanteId]
      );
      if (!people[0] || !people[0].activo) {
        const error = new Error('La persona solicitante no está activa.');
        error.status = 409;
        throw error;
      }
      const { rows: assets } = await client.query(
        `SELECT a.estado, a.activo, c.tipo
         FROM activos a
         JOIN categorias c ON c.id = a.categoria_id
         WHERE a.id = $1
         FOR UPDATE OF a`,
        [activoId]
      );
      const asset = assets[0];
      if (!asset || !asset.activo || asset.estado !== 'disponible' ||
          !['herramienta', 'equipo'].includes(asset.tipo)) {
        const error = new Error('El activo no está disponible para solicitud.');
        error.status = 409;
        throw error;
      }

      const { rows } = await client.query(
        `INSERT INTO solicitudes (activo_id, solicitante_id, motivo)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [activoId, solicitanteId, motivo]
      );
      return rows[0];
    });
  },

  async resolve(id, userId, decision, motivo) {
    return db.transaction(async client => {
      const { rows: requestRows } = await client.query(
        'SELECT id, activo_id, solicitante_id, estado FROM solicitudes WHERE id = $1 FOR UPDATE',
        [id]
      );
      const request = requestRows[0];
      if (!request) {
        const error = new Error('No se encontró la solicitud.');
        error.status = 404;
        throw error;
      }
      if (request.estado !== 'pendiente') {
        const error = new Error('La solicitud ya fue resuelta.');
        error.status = 409;
        throw error;
      }

      if (decision === 'aprobada') {
        const { rows: people } = await client.query(
          'SELECT activo FROM personas WHERE id = $1',
          [request.solicitante_id]
        );
        if (!people[0] || !people[0].activo) {
          const error = new Error('La persona solicitante ya no está activa.');
          error.status = 409;
          throw error;
        }
        const { rows: assets } = await client.query(
          `SELECT a.estado, a.activo, c.tipo
           FROM activos a
           JOIN categorias c ON c.id = a.categoria_id
           WHERE a.id = $1
           FOR UPDATE OF a`,
          [request.activo_id]
        );
        const asset = assets[0];
        if (!asset || !asset.activo || asset.estado !== 'disponible' ||
            !['herramienta', 'equipo'].includes(asset.tipo)) {
          const error = new Error('El activo ya no está disponible para asignación.');
          error.status = 409;
          throw error;
        }
        await client.query(
          `INSERT INTO asignaciones (activo_id, persona_id, solicitud_id, asignado_por)
           SELECT activo_id, solicitante_id, id, $2 FROM solicitudes WHERE id = $1`,
          [id, userId]
        );
        await client.query(
          `UPDATE activos SET estado = 'asignado', actualizado_en = now()
           WHERE id = $1`,
          [request.activo_id]
        );
        await client.query(
          `INSERT INTO movimientos (activo_id, tipo, usuario_id, nota)
           VALUES ($1, 'asignacion', $2, $3)`,
          [request.activo_id, userId, `Asignación por solicitud #${id}`]
        );
      }

      const { rows } = await client.query(
        `UPDATE solicitudes
         SET estado = $2,
             motivo_resolucion = CASE WHEN $2 = 'rechazada' THEN $3 ELSE NULL END,
             resuelta_por = $4, resuelta_en = now()
         WHERE id = $1
         RETURNING id, estado`,
        [id, decision, motivo, userId]
      );
      return rows[0];
    });
  },
};
