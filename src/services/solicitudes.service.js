// Servicio "solicitudes": lógica de negocio y reglas. Es la capa que se prueba (>=70% cobertura).
// Usa modelos; no conoce Express (req/res).
const model = require('../models/solicitudes.model');

const STATES = new Set(['pendiente', 'aprobada', 'rechazada']);

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

module.exports = {
  async list(estado) {
    if (estado && estado !== 'todas' && !STATES.has(estado)) {
      throw invalid('El estado seleccionado no es válido.');
    }
    return model.list(estado === 'todas' ? '' : estado);
  },

  async formData() {
    return { assets: await model.listAvailableAssets() };
  },

  async create(input, solicitanteId) {
    const activoId = positiveId(input.activo_id, 'El activo');
    const personaId = positiveId(solicitanteId, 'La persona solicitante');
    const motivo = String(input.motivo || '').trim();
    if (motivo.length < 3 || motivo.length > 1000) {
      throw invalid('El motivo debe tener entre 3 y 1000 caracteres.');
    }
    return model.create({ activoId, solicitanteId: personaId, motivo });
  },

  async resolve(id, userId, decision, motivo) {
    const requestId = positiveId(id, 'La solicitud');
    const resolverId = positiveId(userId, 'El usuario');
    if (!['aprobada', 'rechazada'].includes(decision)) {
      throw invalid('La decisión no es válida.');
    }
    const reason = String(motivo || '').trim();
    if (decision === 'rechazada' && (reason.length < 3 || reason.length > 1000)) {
      throw invalid('Indica un motivo de rechazo de entre 3 y 1000 caracteres.');
    }
    return model.resolve(requestId, resolverId, decision, reason || null);
  },
};
