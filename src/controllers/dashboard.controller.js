// Panel de inicio con conteos básicos. En el Sprint 3 se reemplaza por los indicadores completos (HU-09).
const personasService = require('../services/personas.service');
const activosService = require('../services/activos.service');
const solicitudesService = require('../services/solicitudes.service');

module.exports = {
  async index(req, res) {
    const [personasActivas, activosTotal, stockBajo, solicitudesPendientes] = await Promise.all([
      personasService.countActivas(),
      activosService.countActivos(),
      activosService.countStockBajo(),
      solicitudesService.countPendientes(),
    ]);
    res.render('pages/dashboard/index', {
      title: 'Dashboard', active: 'dashboard', personasActivas, activosTotal, stockBajo, solicitudesPendientes,
    });
  },
};
