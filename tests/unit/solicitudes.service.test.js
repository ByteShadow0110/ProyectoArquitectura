jest.mock('../../src/models/solicitudes.model');

const model = require('../../src/models/solicitudes.model');
const service = require('../../src/services/solicitudes.service');

beforeEach(() => jest.clearAllMocks());

describe('solicitudes.service', () => {
  test('crea una solicitud asociada a la persona autenticada', async () => {
    model.create.mockResolvedValue({ id: 12 });

    await expect(service.create({
      activo_id: '5',
      motivo: 'Reparación de placa',
    }, 8)).resolves.toEqual({ id: 12 });

    expect(model.create).toHaveBeenCalledWith({
      activoId: 5,
      solicitanteId: 8,
      motivo: 'Reparación de placa',
    });
  });

  test('requiere motivo al rechazar una solicitud', async () => {
    await expect(service.resolve(12, 3, 'rechazada', ' '))
      .rejects.toMatchObject({ status: 400 });
    expect(model.resolve).not.toHaveBeenCalled();
  });

  test('solo acepta estados definidos en el filtro', async () => {
    await expect(service.list('cancelada')).rejects.toMatchObject({ status: 400 });
    expect(model.list).not.toHaveBeenCalled();
  });
});
