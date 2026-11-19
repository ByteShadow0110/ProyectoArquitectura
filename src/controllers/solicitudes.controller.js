// Controlador "solicitudes": delgado. Lee req, llama al servicio, responde (render/redirect).
// NO contiene lógica de negocio ni SQL.
const service = require('../services/solicitudes.service');

module.exports = {
  async index(req, res) {
    const [requests, { assets }] = await Promise.all([
      service.list(req.query.estado || 'pendiente'),
      service.formData(),
    ]);
    res.render('solicitudes/index', {
      requests, assets, estado: req.query.estado || 'pendiente', user: req.user,
    });
  },

  async create(req, res) {
    await service.create(req.body, req.user.persona_id);
    res.redirect('/solicitudes');
  },

  async resolve(req, res) {
    await service.resolve(req.params.id, req.user.id, req.body.decision, req.body.motivo);
    res.redirect('/solicitudes');
  },
};
