// Controlador de autenticación: traduce HTTP <-> servicio. Sin reglas de negocio.
const authService = require('../services/auth.service');
const AppError = require('../utils/AppError');

const regenerate = (req) => new Promise((resolve, reject) => req.session.regenerate((e) => (e ? reject(e) : resolve())));
const destroy = (req) => new Promise((resolve) => req.session.destroy(() => resolve()));

module.exports = {
  showLogin(req, res) {
    if (req.session.user) return res.redirect('/dashboard');
    return res.render('pages/auth/login', { title: 'Iniciar sesión', errorMessage: null, correo: '' });
  },

  async login(req, res) {
    try {
      const user = await authService.authenticate(req.body.correo, req.body.password);
      const returnTo = req.session.returnTo;
      await regenerate(req); // evita fijación de sesión
      req.session.user = user;
      const safe = typeof returnTo === 'string' && returnTo.startsWith('/') && !returnTo.startsWith('//');
      return res.redirect(safe ? returnTo : '/dashboard');
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
      return res.status(err.status === 401 ? 401 : 400).render('pages/auth/login', {
        title: 'Iniciar sesión',
        errorMessage: err.message,
        correo: String(req.body.correo || '').slice(0, 120),
      });
    }
  },

  async logout(req, res) {
    await destroy(req);
    res.clearCookie('connect.sid');
    return res.redirect('/login');
  },
};
