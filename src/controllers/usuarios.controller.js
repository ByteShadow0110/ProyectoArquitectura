// Controlador de usuarios y roles (solo administrador). Sin reglas de negocio.
const service = require('../services/usuarios.service');
const personasService = require('../services/personas.service');
const AppError = require('../utils/AppError');

async function formData() {
  const [roles, personas] = await Promise.all([
    service.listRoles(),
    personasService.listOptions(),
  ]);
  return { roles, personas };
}

async function renderForm(res, { status = 200, usuario, errors = {}, errorMessage = null, editing }) {
  res.status(status).render('pages/usuarios/form', {
    title: editing ? 'Editar usuario' : 'Nuevo usuario',
    active: 'usuarios',
    editing, usuario, errors, errorMessage,
    ...(await formData()),
  });
}

module.exports = {
  async index(req, res) {
    const q = String(req.query.q || '').trim().slice(0, 80);
    const usuarios = await service.list({ q });
    res.render('pages/usuarios/index', { title: 'Usuarios y roles', active: 'usuarios', usuarios, q });
  },

  newForm: (req, res) => renderForm(res, { usuario: { activo: true }, editing: false }),

  async create(req, res) {
    try {
      await service.create(req.body);
      req.flash('ok', 'Usuario creado correctamente.');
      return res.redirect('/usuarios');
    } catch (err) {
      if (!(err instanceof AppError) || err.status >= 500) throw err;
      return renderForm(res, { status: 400, usuario: { ...req.body, activo: req.body.activo === 'on' }, errors: err.fields, errorMessage: err.message, editing: false });
    }
  },

  async editForm(req, res) {
    const usuario = await service.get(Number(req.params.id));
    return renderForm(res, { usuario: { ...usuario, persona_id: usuario.persona_id, rol_id: usuario.rol_id }, editing: true });
  },

  async update(req, res) {
    const id = Number(req.params.id);
    try {
      await service.update(id, req.body, req.session.user);
      req.flash('ok', 'Usuario actualizado.');
      return res.redirect('/usuarios');
    } catch (err) {
      if (!(err instanceof AppError) || err.status >= 500 || err.status === 404) throw err;
      return renderForm(res, { status: 400, usuario: { ...req.body, id, activo: req.body.activo === 'on' }, errors: err.fields, errorMessage: err.message, editing: true });
    }
  },

  async toggle(req, res) {
    try {
      const activo = await service.toggleActivo(Number(req.params.id), req.session.user);
      req.flash('ok', activo ? 'Usuario activado.' : 'Usuario desactivado.');
    } catch (err) {
      if (!(err instanceof AppError) || err.status >= 500) throw err;
      req.flash('error', err.message);
    }
    return res.redirect('/usuarios');
  },
};
