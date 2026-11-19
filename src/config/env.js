require('dotenv').config();

const env = process.env.NODE_ENV || 'development';

const config = {
  env,
  isProd: env === 'production',
  isTest: env === 'test',
  port: Number(process.env.PORT) || 3000,
  sessionSecret: process.env.SESSION_SECRET || (env === 'production' ? undefined : 'dev-secret-no-usar-en-produccion'),
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 10,
  db: { connectionString: process.env.DATABASE_URL },
};

if (config.isProd && !config.sessionSecret) {
  throw new Error('SESSION_SECRET es obligatorio en producción');
}

module.exports = config;
