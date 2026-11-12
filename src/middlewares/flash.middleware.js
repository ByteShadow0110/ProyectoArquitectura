// Mensajes de una sola lectura (confirmaciones tras guardar). req.flash(tipo, texto)
module.exports = function flash(req, res, next) {
  req.flash = (type, text) => {
    req.session.flash = { type, text };
  };
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
};
