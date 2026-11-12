const AppError = require('../utils/AppError');

// Autorización por rol en el servidor (RF-03). Uso: requireRole('admin', 'supervisor')
module.exports = function requireRole(...roles) {
  return (req, res, next) => {
    const user = req.session && req.session.user;
    if (!user) return next(AppError.unauthorized());
    if (!roles.includes(user.rol)) return next(AppError.forbidden());
    return next();
  };
};
