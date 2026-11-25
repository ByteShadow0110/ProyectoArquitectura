const { Pool, types } = require('pg');
const env = require('./env');

// DATE (OID 1082) como texto 'YYYY-MM-DD' para evitar corrimientos por zona horaria.
types.setTypeParser(1082, (value) => value);

const pool = new Pool(env.db);

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (rollbackError) { /* conexión ya cerrada */ }
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  // Siempre consultas parametrizadas: query('... WHERE id = $1', [id])
  query: (text, params) => pool.query(text, params),
  pool,
  withTransaction,
  transaction: withTransaction,
};
