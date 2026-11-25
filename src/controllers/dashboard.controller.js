// Panel de inicio con indicadores agregados por el módulo de reportes.
const service = require('../services/reportes.service');

module.exports = {
  async index(req, res) {
    const data = await service.getDashboard(req.session.user);
    return res.render('pages/dashboard/index', {
      title: 'Dashboard', active: 'dashboard', ...data,
    });
  },
};
