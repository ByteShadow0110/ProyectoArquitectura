// Controlador de personas: traduce HTTP <-> servicio. Sin reglas de negocio.
const service = require('../services/personas.service');
const AppError = require('../utils/AppError');

async function renderForm(req, res, { status = 200, persona, errors = {}, errorMessage = null, editing }) {
  res.status(status).render('pages/personas/form', {
    title: editing ? 'Editar persona' : 'Nueva persona',
    active: 'personas',
    editing, persona, errors, errorMessage,
    areas: await service.listAreas(),
  });
}

const isHandled = (err) => err instanceof AppError && err.status < 500 && err.status !== 404 && err.status !== 403;

module.exports = {
  async index(req, res) {
    const result = await service.list(req.session.user, req.query);
    const areas = await service.listAreas();
    res.render('pages/personas/index', {
      title: 'Personas', active: 'personas', areas, canManage: service.canManage(req.session.user), ...result,
    });
  },

  async show(req, res) {
    const { persona, asignaciones } = await service.getExpediente(req.session.user, Number(req.params.id));
    res.render('pages/personas/detalle', {
      title: `Expediente: ${persona.nombre} ${persona.apellidos}`,
      active: 'personas', persona, asignaciones, canManage: service.canManage(req.session.user),
    });
  },

  newForm: (req, res) => renderForm(req, res, {
    persona: { fecha_ingreso: new Date().toISOString().slice(0, 10), area_id: req.session.user.rol === 'supervisor' ? req.session.user.areaId : '' },
    editing: false,
  }),

  async create(req, res) {
    try {
      const id = await service.create(req.session.user, req.body);
      req.flash('ok', 'Persona registrada correctamente.');
      return res.redirect(`/personas/${id}`);
    } catch (err) {
      if (!isHandled(err)) throw err;
      return renderForm(req, res, { status: 400, persona: req.body, errors: err.fields, errorMessage: err.message, editing: false });
    }
  },

  async editForm(req, res) {
    const persona = await service.get(req.session.user, Number(req.params.id));
    return renderForm(req, res, { persona, editing: true });
  },

  async update(req, res) {
    const id = Number(req.params.id);
    try {
      await service.update(req.session.user, id, req.body);
      req.flash('ok', 'Datos actualizados.');
      return res.redirect(`/personas/${id}`);
    } catch (err) {
      if (!isHandled(err)) throw err;
      return renderForm(req, res, { status: 400, persona: { ...req.body, id }, errors: err.fields, errorMessage: err.message, editing: true });
    }
  },

  async toggle(req, res) {
    const id = Number(req.params.id);
    try {
      const activo = await service.toggleActivo(req.session.user, id);
      req.flash('ok', activo ? 'Persona reactivada.' : 'Persona dada de baja.');
    } catch (err) {
      if (!(err instanceof AppError) || err.status >= 500 || err.status === 404 || err.status === 403) throw err;
      req.flash('error', err.message);
    }
    return res.redirect(`/personas/${id}`);
  },
};
