// Controlador de activos: traduce HTTP <-> servicio. Sin reglas de negocio.
const service = require('../services/activos.service');
const AppError = require('../utils/AppError');

// Errores que se muestran al usuario sin romper la página (los 403/404 siguen al manejador global).
const isHandled = (err) => err instanceof AppError && err.status < 500 && err.status !== 404 && err.status !== 403;

async function renderForm(req, res, { status = 200, activo, errors = {}, errorMessage = null, editing }) {
  res.status(status).render('pages/activos/form', {
    title: editing ? 'Editar activo' : 'Nuevo activo',
    active: 'activos',
    editing, activo, errors, errorMessage,
    categorias: await service.listCategorias(),
  });
}

async function renderDetalle(req, res, id, { status = 200, errors = {}, errorMessage = null, form = {} } = {}) {
  const data = await service.getDetalle(req.session.user, id);
  res.status(status).render('pages/activos/detalle', {
    title: `${data.activo.codigo} · ${data.activo.nombre}`,
    active: 'activos', canManage: service.canManage(req.session.user),
    errors, errorMessage, form, ...data,
  });
}

// Ejecuta una acción de detalle; si falla por regla de negocio, muestra el mensaje y vuelve al detalle.
async function action(req, res, fn, okMsg) {
  const id = Number(req.params.id);
  try {
    await fn(req.session.user, id, req.body);
    req.flash('ok', okMsg);
  } catch (err) {
    if (!isHandled(err)) throw err;
    req.flash('error', err.message);
  }
  return res.redirect(`/activos/${id}`);
}

module.exports = {
  async index(req, res) {
    const result = await service.list(req.session.user, req.query);
    res.render('pages/activos/index', {
      title: 'Activos', active: 'activos', canManage: service.canManage(req.session.user), ...result,
    });
  },

  async show(req, res) {
    return renderDetalle(req, res, Number(req.params.id));
  },

  newForm: (req, res) => renderForm(req, res, { activo: { stock: 0, stock_minimo: 0 }, editing: false }),

  async create(req, res) {
    try {
      const id = await service.create(req.session.user, req.body);
      req.flash('ok', 'Activo registrado correctamente.');
      return res.redirect(`/activos/${id}`);
    } catch (err) {
      if (!isHandled(err)) throw err;
      return renderForm(req, res, { status: 400, activo: req.body, errors: err.fields, errorMessage: err.message, editing: false });
    }
  },

  async editForm(req, res) {
    const activo = await service.get(Number(req.params.id));
    return renderForm(req, res, { activo, editing: true });
  },

  async update(req, res) {
    const id = Number(req.params.id);
    try {
      await service.update(req.session.user, id, req.body);
      req.flash('ok', 'Datos actualizados.');
      return res.redirect(`/activos/${id}`);
    } catch (err) {
      if (!isHandled(err)) throw err;
      const actual = await service.get(id);
      return renderForm(req, res, { status: 400, activo: { ...req.body, id, estado: actual.estado }, errors: err.fields, errorMessage: err.message, editing: true });
    }
  },

  async toggle(req, res) {
    const id = Number(req.params.id);
    try {
      const activo = await service.toggleActivo(req.session.user, id);
      req.flash('ok', activo ? 'Activo reactivado.' : 'Activo dado de baja.');
    } catch (err) {
      if (!isHandled(err)) throw err;
      req.flash('error', err.message);
    }
    return res.redirect(`/activos/${id}`);
  },

  asignar: (req, res) => action(req, res, (u, id, b) => service.asignar(u, id, b), 'Activo asignado correctamente.'),
  devolver: (req, res) => action(req, res, (u, id, b) => service.devolver(u, id, b), 'Devolución registrada.'),

  async movimiento(req, res) {
    const id = Number(req.params.id);
    try {
      await service.moverStock(req.session.user, id, req.body);
      req.flash('ok', 'Movimiento de stock registrado.');
    } catch (err) {
      if (!isHandled(err)) throw err;
      req.flash('error', err.message);
    }
    return res.redirect(`/activos/${id}`);
  },
};
