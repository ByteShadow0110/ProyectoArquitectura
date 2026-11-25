jest.mock('../../src/models/asignaciones.model');

const model = require('../../src/models/asignaciones.model');
const service = require('../../src/services/asignaciones.service');

beforeEach(() => jest.clearAllMocks());

describe('asignaciones.service', () => {
  test('valida identificadores antes de llamar al modelo', async () => {
    await expect(service.create({ activo_id: '0', persona_id: '2' }, 4))
      .rejects.toMatchObject({ status: 400 });
    expect(model.create).not.toHaveBeenCalled();
  });

  test('pasa usuario responsable al devolver un activo', async () => {
    model.returnAsset.mockResolvedValue({ id: 9 });

    await expect(service.returnAsset('9', '4')).resolves.toEqual({ id: 9 });
    expect(model.returnAsset).toHaveBeenCalledWith(9, 4);
  });
});
