// Servicio "activos": lógica de negocio y reglas. Es la capa que se prueba (>=70% cobertura).
// Usa modelos; no conoce Express (req/res).
const model = require('../models/activos.model');

const TYPES = new Set(['refaccion', 'herramienta', 'equipo']);
const FILTER_STATES = new Set(['disponible', 'asignado', 'mantenimiento', 'baja']);
const EDITABLE_STATES = new Set(['disponible', 'mantenimiento']);

function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function positiveId(value, label) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw invalid(`${label} no válido.`);
  return id;
}

function numberField(value, label, { optional = false, decimal = false } = {}) {
  if (optional && (value === '' || value == null)) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || (!decimal && !Number.isInteger(number))) {
    throw invalid(`${label} debe ser un número válido y no negativo.`);
  }
  return number;
}

async function validateAsset(input) {
  const codigo = String(input.codigo || '').trim().toUpperCase();
  const nombre = String(input.nombre || '').trim();
  if (!codigo || codigo.length > 40) throw invalid('El código es obligatorio y no debe exceder 40 caracteres.');
  if (!nombre || nombre.length > 120) throw invalid('El nombre es obligatorio y no debe exceder 120 caracteres.');

  const categoria_id = positiveId(input.categoria_id, 'La categoría');
  const category = (await model.listCategories()).find(item => item.id === categoria_id);
  if (!category) throw invalid('Selecciona una categoría existente.');

  const estado = String(input.estado || 'disponible');
  if (!EDITABLE_STATES.has(estado)) throw invalid('El estado seleccionado no es válido.');
  const stock = numberField(input.stock ?? 0, 'El stock');
  const stock_minimo = numberField(input.stock_minimo ?? 0, 'El stock mínimo');
  if (category.tipo !== 'refaccion' && (stock !== 0 || stock_minimo !== 0)) {
    throw invalid('El stock solo aplica a activos de tipo refacción.');
  }
  const costo = numberField(input.costo, 'El costo', { optional: true, decimal: true });
  const modelos_compatibles = String(input.modelos_compatibles || '').trim() || null;
  if (modelos_compatibles && modelos_compatibles.length > 1000) {
    throw invalid('Los modelos compatibles no deben exceder 1000 caracteres.');
  }

  return { codigo, nombre, categoria_id, estado, stock, stock_minimo, costo, modelos_compatibles };
}

module.exports = {
  async list(filters = {}) {
    const tipo = filters.tipo || '';
    const estado = filters.estado || '';
    if (tipo && !TYPES.has(tipo)) throw invalid('El tipo seleccionado no es válido.');
    if (estado && !FILTER_STATES.has(estado)) throw invalid('El estado seleccionado no es válido.');
    return model.list({
      search: String(filters.buscar || '').trim().slice(0, 100),
      tipo,
      estado,
    });
  },

  async formData() {
    return { categories: await model.listCategories() };
  },

  async get(id) {
    const asset = await model.getById(positiveId(id, 'El activo'));
    if (!asset) {
      const error = new Error('No se encontró el activo.');
      error.status = 404;
      throw error;
    }
    return asset;
  },

  async create(input, userId) {
    return model.create(await validateAsset(input), positiveId(userId, 'El usuario'));
  },

  async update(id, input, userId) {
    const result = await model.update(
      positiveId(id, 'El activo'),
      await validateAsset(input),
      positiveId(userId, 'El usuario')
    );
    if (!result) {
      const error = new Error('No se encontró el activo.');
      error.status = 404;
      throw error;
    }
    return result;
  },

  async deactivate(id, userId) {
    const result = await model.deactivate(
      positiveId(id, 'El activo'),
      positiveId(userId, 'El usuario')
    );
    if (!result) {
      const error = new Error('No se encontró el activo.');
      error.status = 404;
      throw error;
    }
    return result;
  },
};
