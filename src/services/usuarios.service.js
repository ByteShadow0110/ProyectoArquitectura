// Servicio de usuarios y roles (HU-02). Reglas: correo único, contraseña >= 8, supervisor con persona y área.
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const usuarios = require('../models/usuarios.model');
const personas = require('../models/personas.model');
const AppError = require('../utils/AppError');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

function clean(input = {}) {
  return {
    correo: String(input.correo || '').trim(),
    password: String(input.password || ''),
    rolId: Number(input.rol_id) || null,
    personaId: input.persona_id ? Number(input.persona_id) : null,
    activo: input.activo === 'on' || input.activo === 'true' || input.activo === true,
  };
}

async function validate(data, { id = null } = {}) {
  const errors = {};
  const roles = await usuarios.listRoles();
  const rol = roles.find((r) => r.id === data.rolId);

  if (!data.correo) errors.correo = 'El correo es obligatorio.';
  else if (!EMAIL_RE.test(data.correo) || data.correo.length > 120) errors.correo = 'Escribe un correo válido.';
  else {
    const dup = await usuarios.findByCorreo(data.correo);
    if (dup && dup.id !== id) errors.correo = 'Ya existe un usuario con ese correo.';
  }

  const requirePassword = id === null;
  if (requirePassword && !data.password) errors.password = 'La contraseña es obligatoria.';
  else if (data.password && data.password.length < MIN_PASSWORD) {
    errors.password = `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;
  }

  if (!rol) errors.rol_id = 'Selecciona un rol.';

  if (data.personaId) {
    const persona = await personas.findById(data.personaId);
    if (!persona) errors.persona_id = 'La persona seleccionada no existe.';
    else {
      const linked = await usuarios.findByPersonaId(data.personaId);
      if (linked && linked.id !== id) errors.persona_id = 'Esa persona ya tiene un usuario.';
      else if (rol && rol.nombre === 'supervisor' && !persona.area_id) {
        errors.persona_id = 'Un supervisor debe estar ligado a una persona con área.';
      }
    }
  } else if (rol && rol.nombre === 'supervisor') {
    errors.persona_id = 'Un supervisor debe estar ligado a una persona (define su área).';
  }

  if (Object.keys(errors).length) throw AppError.validation(errors);
}

module.exports = {
  clean,

  list: (filters) => usuarios.list(filters),
  listRoles: () => usuarios.listRoles(),

  async get(id) {
    const user = await usuarios.findById(id);
    if (!user) throw AppError.notFound('Usuario no encontrado.');
    return user;
  },

  async create(input) {
    const data = clean(input);
    await validate(data);
    const passwordHash = await bcrypt.hash(data.password, env.bcryptRounds);
    return usuarios.create({ ...data, passwordHash });
  },

  async update(id, input, actingUser) {
    const current = await this.get(id);
    const data = clean(input);
    await validate(data, { id: current.id });
    if (actingUser.id === current.id && !data.activo) {
      throw AppError.validation({}, 'No puedes desactivar tu propia cuenta.');
    }
    const passwordHash = data.password ? await bcrypt.hash(data.password, env.bcryptRounds) : null;
    await usuarios.update(id, { ...data, passwordHash });
  },

  async toggleActivo(id, actingUser) {
    const current = await this.get(id);
    if (actingUser.id === current.id) throw AppError.validation({}, 'No puedes desactivar tu propia cuenta.');
    await usuarios.setActivo(id, !current.activo);
    return !current.activo;
  },
};
