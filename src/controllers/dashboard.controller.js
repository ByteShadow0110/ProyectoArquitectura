// Panel de inicio con indicadores reales (RF-13). Los datos los arma el servicio de reportes.
const reportes = require('../services/reportes.service');

module.exports = {
  async index(req, res) {
    const data = await reportes.dashboard(req.session.user);
    res.render('pages/dashboard/index', { title: 'Dashboard', active: 'dashboard', ...data });
  },
};
