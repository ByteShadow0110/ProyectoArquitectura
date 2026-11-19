const { Pool, types } = require('pg');
const env = require('./env');

// DATE (OID 1082) como texto 'YYYY-MM-DD' para evitar corrimientos por zona horaria.
types.setTypeParser(1082, (value) => value);

const pool = new Pool(env.db);

module.exports = {
  // Siempre consultas parametrizadas: query('... WHERE id = $1', [id])
  query: (text, params) => pool.query(text, params),

  // Ejecuta fn(client) dentro de una transacción: COMMIT si termina bien, ROLLBACK si lanza error.
  async withTransaction(fn) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (e) { /* conexión ya cerrada */ }
      throw err;
    } finally {
      client.release();
    }
  },
  pool,
};
