const crypto = require('crypto');
const AppError = require('../utils/AppError');

// Protección CSRF con token por sesión (patrón "synchronizer token").
module.exports = function csrf(req, res, next) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  res.locals.csrfToken = req.session.csrfToken;

  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const sent = Buffer.from(String((req.body && req.body._csrf) || ''));
  const expected = Buffer.from(req.session.csrfToken);
  const valid = sent.length === expected.length && crypto.timingSafeEqual(sent, expected);
  if (!valid) return next(AppError.forbidden('Sesión de formulario inválida. Recarga la página e inténtalo de nuevo.'));
  return next();
};
