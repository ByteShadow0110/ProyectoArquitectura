// Controlador de solicitudes: traduce HTTP <-> servicio. Sin reglas de negocio.
const service = require('../services/solicitudes.service');
const AppError = require('../utils/AppError');

const isHandled = (err) => err instanceof AppError && err.status < 500 && err.status !== 404 && err.status !== 403;

async function renderForm(req, res, { status = 200, solicitud = {}, errors = {}, errorMessage = null }) {
  res.status(status).render('pages/solicitudes/form', {
    title: 'Nueva solicitud', active: 'solicitudes',
    solicitud, errors, errorMessage,
    activos: await service.listActivosSolicitables(),
  });
}

async function resolve(req, res, fn, okMsg) {
  try {
    await fn(req.session.user, Number(req.params.id), req.body);
    req.flash('ok', okMsg);
  } catch (err) {
    if (!isHandled(err)) throw err;
    req.flash('error', err.message);
  }
  return res.redirect('/solicitudes');
}

module.exports = {
  async index(req, res) {
    const result = await service.list(req.session.user, req.query);
    res.render('pages/solicitudes/index', {
      title: 'Solicitudes de activos', active: 'solicitudes', canManage: service.canManage(req.session.user), ...result,
    });
  },

  newForm: (req, res) => renderForm(req, res, { solicitud: { activo_id: req.query.activo || '' } }),

  async create(req, res) {
    try {
      await service.create(req.session.user, req.body);
      req.flash('ok', 'Solicitud enviada. Un supervisor la revisará.');
      return res.redirect('/solicitudes?estado=todas');
    } catch (err) {
      if (!isHandled(err)) throw err;
      return renderForm(req, res, { status: 400, solicitud: req.body, errors: err.fields, errorMessage: err.message });
    }
  },

  aprobar: (req, res) => resolve(req, res, (u, id) => service.aprobar(u, id), 'Solicitud aprobada: se creó la asignación.'),
  rechazar: (req, res) => resolve(req, res, (u, id, b) => service.rechazar(u, id, b), 'Solicitud rechazada.'),
};
