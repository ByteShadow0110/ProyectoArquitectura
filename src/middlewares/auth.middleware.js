// Exige sesión iniciada. Si no hay, manda al login recordando a dónde iba.
module.exports = function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  if (req.method === 'GET') req.session.returnTo = req.originalUrl;
  return res.redirect('/login');
};
