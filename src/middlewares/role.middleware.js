module.exports = function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      return res.status(403).send('No tienes permiso para realizar esta acción.');
    }

    next();
  };
};
