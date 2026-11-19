module.exports = function errorHandler(error, req, res, next) {
  const status = error.code === '23505'
    ? 409
    : Number.isInteger(error.status) ? error.status : 500;
  const message = error.code === '23505'
    ? 'El código o dato único ya está registrado.'
    : status === 500 ? 'Ocurrió un error interno.' : error.message;
  if (status >= 500) console.error(error);
  res.status(status).send(message);
};
