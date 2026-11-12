const { Pool, types } = require('pg');
const env = require('./env');

// DATE (OID 1082) como texto 'YYYY-MM-DD' para evitar corrimientos por zona horaria.
types.setTypeParser(1082, (value) => value);

const pool = new Pool(env.db);

module.exports = {
  // Siempre consultas parametrizadas: query('... WHERE id = $1', [id])
  query: (text, params) => pool.query(text, params),
  pool,
};
