const model = require('../models/asignaciones.model');

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
  list: () => model.list(),
  formData: async () => ({
    assets: await model.listAvailableAssets(),
    people: await model.listPeople(),
  }),
  async create(input, userId) {
    return model.create({
      activoId: positiveId(input.activo_id, 'El activo'),
      personaId: positiveId(input.persona_id, 'La persona'),
      userId: positiveId(userId, 'El usuario'),
    });
  },
  async returnAsset(id, userId) {
    return model.returnAsset(
      positiveId(id, 'La asignación'),
      positiveId(userId, 'El usuario')
    );
  },
};
