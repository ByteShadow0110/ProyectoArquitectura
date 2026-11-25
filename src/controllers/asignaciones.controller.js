const service = require('../services/asignaciones.service');

module.exports = {
  async index(req, res) {
    const assignments = await service.list();
    res.render('asignaciones/index', { assignments, user: req.user });
  },

  async new(req, res) {
    const { assets, people } = await service.formData();
    res.render('asignaciones/form', {
      assets, people, user: req.user, selectedAssetId: req.query.activo_id,
    });
  },

  async create(req, res) {
    await service.create(req.body, req.user.id);
    res.redirect('/asignaciones');
  },

  async returnAsset(req, res) {
    await service.returnAsset(req.params.id, req.user.id);
    res.redirect('/asignaciones');
  },
};
