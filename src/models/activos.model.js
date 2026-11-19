// Modelo "activos": acceso a PostgreSQL con consultas parametrizadas ($1, $2...).
const db = require('../config/db');

const byId = `
  SELECT a.id, a.codigo, a.nombre, a.categoria_id, c.nombre AS categoria,
         c.tipo, a.estado, a.stock, a.stock_minimo, a.modelos_compatibles,
         a.costo, a.activo
  FROM activos a
  JOIN categorias c ON c.id = a.categoria_id`;

module.exports = {
  async list({ search, tipo, estado }) {
    const values = [];
    const filters = ['a.activo = TRUE'];
    if (search) {
      values.push(`%${search}%`);
      filters.push(`(a.codigo ILIKE $${values.length} OR a.nombre ILIKE $${values.length} OR a.modelos_compatibles ILIKE $${values.length})`);
    }
    if (tipo) {
      values.push(tipo);
      filters.push(`c.tipo = $${values.length}`);
    }
    if (estado) {
      values.push(estado);
      filters.push(`a.estado = $${values.length}`);
    }

    const { rows } = await db.query(
      `${byId} WHERE ${filters.join(' AND ')} ORDER BY a.nombre`,
      values
    );
    return rows;
  },

  async listCategories() {
    const { rows } = await db.query(
      'SELECT id, nombre, tipo FROM categorias ORDER BY nombre'
    );
    return rows;
  },

  async getById(id) {
    const { rows } = await db.query(`${byId} WHERE a.id = $1 AND a.activo = TRUE`, [id]);
    return rows[0] || null;
  },

  async getMovements(id) {
    const { rows } = await db.query(
      `SELECT m.tipo, m.cantidad, m.nota, m.creado_en,
              COALESCE(p.nombre || ' ' || p.apellidos, u.correo, 'Sistema') AS usuario
       FROM movimientos m
       LEFT JOIN usuarios u ON u.id = m.usuario_id
       LEFT JOIN personas p ON p.id = u.persona_id
       WHERE m.activo_id = $1
       ORDER BY m.creado_en DESC, m.id DESC`,
      [id]
    );
    return rows;
  },

  async create(asset, userId) {
    return db.transaction(async client => {
      const { rows } = await client.query(
        `INSERT INTO activos
           (codigo, nombre, categoria_id, estado, stock, stock_minimo,
            modelos_compatibles, costo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [asset.codigo, asset.nombre, asset.categoria_id, asset.estado,
          asset.stock, asset.stock_minimo, asset.modelos_compatibles, asset.costo]
      );
      await client.query(
        `INSERT INTO movimientos (activo_id, tipo, cantidad, usuario_id, nota)
         VALUES ($1, 'ajuste', 1, $2, 'Activo registrado')`,
        [rows[0].id, userId]
      );
      if (asset.stock > 0) {
        await client.query(
          `INSERT INTO movimientos (activo_id, tipo, cantidad, usuario_id, nota)
           VALUES ($1, 'entrada', $2, $3, 'Stock inicial')`,
          [rows[0].id, asset.stock, userId]
        );
      }
      return rows[0];
    });
  },

  async update(id, asset, userId) {
    return db.transaction(async client => {
      const { rows: currentRows } = await client.query(
        'SELECT estado, stock, categoria_id FROM activos WHERE id = $1 AND activo = TRUE FOR UPDATE',
        [id]
      );
      if (!currentRows[0]) return null;

      const current = currentRows[0];
      if (current.estado === 'asignado' && current.categoria_id !== asset.categoria_id) {
        const error = new Error('No se puede cambiar la categoría de un activo asignado.');
        error.status = 409;
        throw error;
      }
      const { rows } = await client.query(
        `UPDATE activos
         SET codigo = $2, nombre = $3, categoria_id = $4,
             estado = CASE WHEN estado = 'asignado' THEN estado ELSE $5 END,
             stock = $6, stock_minimo = $7, modelos_compatibles = $8,
             costo = $9, actualizado_en = now()
         WHERE id = $1 AND activo = TRUE
         RETURNING id`,
        [id, asset.codigo, asset.nombre, asset.categoria_id, asset.estado,
          asset.stock, asset.stock_minimo, asset.modelos_compatibles, asset.costo]
      );

      const change = asset.stock - current.stock;
      if (change !== 0) {
        await client.query(
          `INSERT INTO movimientos (activo_id, tipo, cantidad, usuario_id, nota)
           VALUES ($1, $2, $3, $4, 'Ajuste de stock')`,
          [id, change > 0 ? 'entrada' : 'salida', Math.abs(change), userId]
        );
      }
      await client.query(
        `INSERT INTO movimientos (activo_id, tipo, cantidad, usuario_id, nota)
         VALUES ($1, 'ajuste', 1, $2, 'Datos del activo actualizados')`,
        [id, userId]
      );
      return rows[0];
    });
  },

  async deactivate(id, userId) {
    return db.transaction(async client => {
      const { rows } = await client.query(
        'SELECT estado FROM activos WHERE id = $1 AND activo = TRUE FOR UPDATE',
        [id]
      );
      if (!rows[0]) return null;
      if (rows[0].estado === 'asignado') {
        const error = new Error('Devuelve el activo antes de darlo de baja.');
        error.status = 409;
        throw error;
      }

      await client.query(
        `UPDATE activos SET activo = FALSE, estado = 'baja', actualizado_en = now()
         WHERE id = $1`,
        [id]
      );
      await client.query(
        `INSERT INTO movimientos (activo_id, tipo, cantidad, usuario_id, nota)
         VALUES ($1, 'ajuste', 1, $2, 'Activo dado de baja')`,
        [id, userId]
      );
      return { id };
    });
  },
};
