jest.mock('../../src/models/activos.model');

const model = require('../../src/models/activos.model');
const service = require('../../src/services/activos.service');

beforeEach(() => jest.clearAllMocks());

describe('activos.service', () => {
  test('normaliza el código y crea una refacción con stock', async () => {
    model.listCategories.mockResolvedValue([{ id: 2, tipo: 'refaccion' }]);
    model.create.mockResolvedValue({ id: 7 });

    await expect(service.create({
      codigo: ' pan-11 ',
      nombre: ' Pantalla ',
      categoria_id: '2',
      stock: '5',
      stock_minimo: '1',
    }, 3)).resolves.toEqual({ id: 7 });

    expect(model.create).toHaveBeenCalledWith({
      codigo: 'PAN-11',
      nombre: 'Pantalla',
      categoria_id: 2,
      estado: 'disponible',
      stock: 5,
      stock_minimo: 1,
      costo: null,
      modelos_compatibles: null,
    }, 3);
  });

  test('rechaza stock en categorías que no son refacciones', async () => {
    model.listCategories.mockResolvedValue([{ id: 4, tipo: 'herramienta' }]);

    await expect(service.create({
      codigo: 'HER-1',
      nombre: 'Desarmador',
      categoria_id: 4,
      stock: 1,
    }, 3)).rejects.toMatchObject({ status: 400 });
    expect(model.create).not.toHaveBeenCalled();
  });

  test('aplica filtros de búsqueda válidos', async () => {
    model.list.mockResolvedValue([]);

    await expect(service.list({
      buscar: '  iphone ',
      tipo: 'refaccion',
      estado: 'disponible',
    })).resolves.toEqual([]);

    expect(model.list).toHaveBeenCalledWith({
      search: 'iphone',
      tipo: 'refaccion',
      estado: 'disponible',
    });
  });

  test('devuelve 404 para activo inexistente', async () => {
    model.getById.mockResolvedValue(null);

    await expect(service.get('2')).rejects.toMatchObject({ status: 404 });
  });

  test('actualiza un activo validado', async () => {
    model.listCategories.mockResolvedValue([{ id: 2, tipo: 'refaccion' }]);
    model.update.mockResolvedValue({ id: 7 });

    await expect(service.update(7, {
      codigo: 'PAN-11',
      nombre: 'Pantalla iPhone 11',
      categoria_id: 2,
      stock: 5,
      stock_minimo: 1,
    }, 3)).resolves.toEqual({ id: 7 });
    expect(model.update).toHaveBeenCalledWith(7, expect.objectContaining({
      codigo: 'PAN-11',
      stock: 5,
    }), 3);
  });

  test('da de baja un activo y reporta inexistentes', async () => {
    model.deactivate.mockResolvedValueOnce({ id: 7 }).mockResolvedValueOnce(null);

    await expect(service.deactivate(7, 3)).resolves.toEqual({ id: 7 });
    await expect(service.deactivate(8, 3)).rejects.toMatchObject({ status: 404 });
  });

  test('no permite establecer el estado asignado desde el formulario', async () => {
    await expect(service.create({
      codigo: 'HER-1',
      nombre: 'Desarmador',
      categoria_id: 4,
      estado: 'asignado',
    }, 3)).rejects.toMatchObject({ status: 400 });
  });
});
