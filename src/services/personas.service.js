// Servicio de personas (HU-03, HU-04, HU-05). Reglas: validación, correo único, baja lógica,
// alcance por área para el supervisor (RN-04).
const personas = require('../models/personas.model');
const AppError = require('../utils/AppError');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9 +()-]{7,20}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PAGE_SIZE = 20;

const canManage = (user) => user.rol === 'admin' || user.rol === 'supervisor';

function clean(input = {}) {
  const t = (v) => String(v || '').trim();
  return {
    nombre: t(input.nombre),
    apellidos: t(input.apellidos),
    correo: t(input.correo) || null,
    telefono: t(input.telefono) || null,
    puesto: t(input.puesto) || null,
    areaId: input.area_id ? Number(input.area_id) : null,
    fechaIngreso: t(input.fecha_ingreso),
  };
}

function isValidDate(value) {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

async function validate(data, user, { id = null } = {}) {
  const errors = {};
  if (!data.nombre) errors.nombre = 'El nombre es obligatorio.';
  else if (data.nombre.length > 80) errors.nombre = 'Máximo 80 caracteres.';
  if (!data.apellidos) errors.apellidos = 'Los apellidos son obligatorios.';
  else if (data.apellidos.length > 100) errors.apellidos = 'Máximo 100 caracteres.';

  if (data.correo) {
    if (!EMAIL_RE.test(data.correo) || data.correo.length > 120) errors.correo = 'Escribe un correo válido.';
    else {
      const dup = await personas.findByCorreo(data.correo);
      if (dup && dup.id !== id) errors.correo = 'Ya existe una persona con ese correo.';
    }
  }
  if (data.telefono && !PHONE_RE.test(data.telefono)) errors.telefono = 'Teléfono no válido (7 a 20 dígitos).';
  if (data.puesto && data.puesto.length > 60) errors.puesto = 'Máximo 60 caracteres.';

  if (!data.areaId) errors.area_id = 'Selecciona un área.';
  else {
    const areas = await personas.listAreas();
    if (!areas.some((a) => a.id === data.areaId)) errors.area_id = 'El área seleccionada no existe.';
    else if (user.rol === 'supervisor' && data.areaId !== user.areaId) {
      errors.area_id = 'Solo puedes gestionar personas de tu área.';
    }
  }

  if (!data.fechaIngreso) errors.fecha_ingreso = 'La fecha de ingreso es obligatoria.';
  else if (!isValidDate(data.fechaIngreso)) errors.fecha_ingreso = 'Fecha no válida.';
  else if (data.fechaIngreso > new Date().toISOString().slice(0, 10)) errors.fecha_ingreso = 'No puede ser futura.';

  if (Object.keys(errors).length) throw AppError.validation(errors);
}

// RN-04: el supervisor solo ve y gestiona su área; sin área asignada no ve nada.
function assertInScope(user, persona) {
  if (user.rol === 'supervisor' && persona.area_id !== user.areaId) {
    throw AppError.forbidden('Esta persona pertenece a otra área.');
  }
}

function assertCanManage(user) {
  if (!canManage(user)) throw AppError.forbidden();
}

module.exports = {
  PAGE_SIZE,
  clean,
  canManage,
  listAreas: () => personas.listAreas(),
  listOptions: () => personas.listSimple(), // personas activas para listas desplegables

  async list(user, query = {}) {
    const q = String(query.q || '').trim().slice(0, 80);
    const estado = ['activos', 'inactivos', 'todos'].includes(query.estado) ? query.estado : 'activos';
    let areaId = query.area ? Number(query.area) || null : null;
    if (user.rol === 'supervisor') areaId = user.areaId || -1; // -1: ninguna área, lista vacía
    const page = Math.max(1, Number(query.page) || 1);

    const filters = { q, areaId, estado };
    const [total, rows] = await Promise.all([
      personas.count(filters),
      personas.list(filters, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    ]);
    return {
      rows, total, page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      filters: { q, area: areaId && areaId > 0 ? areaId : '', estado },
    };
  },

  async get(user, id) {
    const persona = await personas.findById(id);
    if (!persona) throw AppError.notFound('Persona no encontrada.');
    assertInScope(user, persona);
    return persona;
  },

  async getExpediente(user, id) {
    const persona = await this.get(user, id);
    const asignaciones = await personas.listAsignaciones(id);
    return { persona, asignaciones };
  },

  async create(user, input) {
    assertCanManage(user);
    const data = clean(input);
    await validate(data, user);
    return personas.create(data);
  },

  async update(user, id, input) {
    assertCanManage(user);
    const current = await this.get(user, id);
    const data = clean(input);
    await validate(data, user, { id: current.id });
    await personas.update(id, data);
  },

  // Baja/alta lógica (RN-02): nunca se borra el registro.
  async toggleActivo(user, id) {
    assertCanManage(user);
    const current = await this.get(user, id);
    if (current.activo && (await personas.countAsignacionesActivas(id)) > 0) {
      throw AppError.conflict('No se puede dar de baja: la persona aún tiene activos asignados.');
    }
    await personas.setActivo(id, !current.activo);
    return !current.activo;
  },

  countActivas: () => personas.countActivas(),
};
