const db = require('../config/db');

module.exports = {
  async list() {
    const { rows } = await db.query(
      `SELECT ag.id, ag.fecha_asignacion,
              a.id AS activo_id, a.codigo, a.nombre AS activo,
              p.nombre || ' ' || p.apellidos AS persona
       FROM asignaciones ag
       JOIN activos a ON a.id = ag.activo_id
       JOIN personas p ON p.id = ag.persona_id
       WHERE ag.fecha_devolucion IS NULL
       ORDER BY ag.fecha_asignacion DESC`
    );
    return rows;
  },

  async listPeople() {
    const { rows } = await db.query(
      `SELECT id, nombre || ' ' || apellidos AS nombre
       FROM personas WHERE activo = TRUE
       ORDER BY apellidos, nombre`
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

  async create({ activoId, personaId, userId }) {
    return db.transaction(async client => {
      const { rows } = await client.query(
        `SELECT a.estado, a.activo, c.tipo
         FROM activos a
         JOIN categorias c ON c.id = a.categoria_id
         WHERE a.id = $1
         FOR UPDATE OF a`,
        [activoId]
      );
      const asset = rows[0];
      if (!asset || !asset.activo || asset.estado !== 'disponible' ||
          !['herramienta', 'equipo'].includes(asset.tipo)) {
        const error = new Error('El activo no está disponible para asignación.');
        error.status = 409;
        throw error;
      }
      const { rows: people } = await client.query(
        'SELECT activo FROM personas WHERE id = $1',
        [personaId]
      );
      if (!people[0] || !people[0].activo) {
        const error = new Error('La persona no está activa.');
        error.status = 409;
        throw error;
      }

      const { rows: assignment } = await client.query(
        `INSERT INTO asignaciones (activo_id, persona_id, asignado_por)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [activoId, personaId, userId]
      );
      await client.query(
        `UPDATE activos SET estado = 'asignado', actualizado_en = now()
         WHERE id = $1`,
        [activoId]
      );
      await client.query(
        `INSERT INTO movimientos (activo_id, tipo, usuario_id, nota)
         VALUES ($1, 'asignacion', $2, 'Asignación directa')`,
        [activoId, userId]
      );
      return assignment[0];
    });
  },

  async returnAsset(id, userId) {
    return db.transaction(async client => {
      const { rows } = await client.query(
        `SELECT id, activo_id FROM asignaciones
         WHERE id = $1 AND fecha_devolucion IS NULL
         FOR UPDATE`,
        [id]
      );
      if (!rows[0]) {
        const error = new Error('No se encontró una asignación activa.');
        error.status = 404;
        throw error;
      }

      const assignment = rows[0];
      await client.query(
        'UPDATE asignaciones SET fecha_devolucion = now() WHERE id = $1',
        [id]
      );
      await client.query(
        `UPDATE activos SET estado = 'disponible', actualizado_en = now()
         WHERE id = $1 AND estado = 'asignado'`,
        [assignment.activo_id]
      );
      await client.query(
        `INSERT INTO movimientos (activo_id, tipo, usuario_id, nota)
         VALUES ($1, 'devolucion', $2, 'Devolución de activo')`,
        [assignment.activo_id, userId]
      );
      return { id };
    });
  },
};
