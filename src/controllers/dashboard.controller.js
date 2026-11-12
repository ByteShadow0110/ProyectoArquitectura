// Panel de inicio. En el Sprint 3 se reemplaza por los indicadores reales (HU-13).
const personasService = require('../services/personas.service');

module.exports = {
  async index(req, res) {
    const personasActivas = await personasService.countActivas();
    res.render('pages/dashboard/index', { title: 'Dashboard', active: 'dashboard', personasActivas });
  },
};
