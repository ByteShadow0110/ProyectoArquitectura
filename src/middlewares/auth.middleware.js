module.exports = function requireAuth(req, res, next) {
  const user = req.session?.user;
  if (!user || !Number.isInteger(Number(user.id))) {
    return res.status(401).send('Inicia sesión para continuar.');
  }

  req.user = user;
  next();
};
