const AppError = require('../utils/AppError');
const env = require('../config/env');

function notFound(req, res, next) {
  next(AppError.notFound('La página que buscas no existe.'));
}

// Manejador central de errores (último middleware).
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message;

  if (err.code === 'EBADCSRFTOKEN') status = 403;
  if (!(err instanceof AppError) && status >= 500) {
    console.error(err); // el detalle va al log, nunca al usuario
    message = 'Ocurrió un error inesperado. Intenta de nuevo más tarde.';
  }

  if (status === 401) return res.redirect('/login');
  return res.status(status).render('pages/error', {
    title: status === 404 ? 'No encontrado' : status === 403 ? 'Acceso restringido' : 'Error',
    status,
    message,
    detail: env.isProd ? null : (status >= 500 ? err.stack : null),
  });
}

module.exports = { notFound, errorHandler };
