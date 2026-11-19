// Express 4 no captura promesas rechazadas: este envoltorio las manda al middleware de errores.
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
