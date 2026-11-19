// Controlador "activos": delgado. Lee req, llama al servicio, responde (render/redirect).
// NO contiene lógica de negocio ni SQL.
const service = require('../services/activos.service');
const model = require('../models/activos.model');

module.exports = {
  async index(req, res) {
    const [assets, { categories }] = await Promise.all([
      service.list(req.query),
      service.formData(),
    ]);
    res.render('activos/index', { assets, categories, filters: req.query, user: req.user });
  },

  async new(req, res) {
    const { categories } = await service.formData();
    res.render('activos/form', { asset: {}, categories, user: req.user, action: '/activos' });
  },

  async create(req, res) {
    const asset = await service.create(req.body, req.user.id);
    res.redirect(`/activos/${asset.id}`);
  },

  async edit(req, res) {
    const [asset, { categories }] = await Promise.all([
      service.get(req.params.id),
      service.formData(),
    ]);
    res.render('activos/form', {
      asset, categories, user: req.user, action: `/activos/${asset.id}`,
    });
  },

  async update(req, res) {
    await service.update(req.params.id, req.body, req.user.id);
    res.redirect(`/activos/${req.params.id}`);
  },

  async deactivate(req, res) {
    await service.deactivate(req.params.id, req.user.id);
    res.redirect('/activos');
  },

  async show(req, res) {
    const asset = await service.get(req.params.id);
    const movements = await model.getMovements(asset.id);
    res.render('activos/show', { asset, movements, user: req.user });
  },
};
