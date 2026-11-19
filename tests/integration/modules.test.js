process.env.SESSION_SECRET = 'test-session-secret';
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';

jest.mock('../../src/models/activos.model');
jest.mock('../../src/models/asignaciones.model');
jest.mock('../../src/models/solicitudes.model');
jest.mock('../../src/middlewares/auth.middleware', () => (req, res, next) => {
  req.user = req.session?.user || {
    id: 1,
    persona_id: 1,
    nombre: 'Admin Prueba',
    rol: 'admin',
  };
  next();
});

const request = require('supertest');
const app = require('../../src/app');
const activos = require('../../src/models/activos.model');
const asignaciones = require('../../src/models/asignaciones.model');
const solicitudes = require('../../src/models/solicitudes.model');

const category = { id: 1, nombre: 'Refacción', tipo: 'refaccion' };
const asset = {
  id: 5,
  codigo: 'PAN-11',
  nombre: 'Pantalla iPhone 11',
  categoria_id: 1,
  categoria: 'Refacción',
  tipo: 'refaccion',
  estado: 'disponible',
  stock: 3,
  stock_minimo: 1,
  modelos_compatibles: 'iPhone 11',
  costo: null,
  activo: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  activos.list.mockResolvedValue([asset]);
  activos.listCategories.mockResolvedValue([category]);
  activos.getById.mockResolvedValue(asset);
  activos.getMovements.mockResolvedValue([]);
  activos.create.mockResolvedValue({ id: asset.id });
  activos.update.mockResolvedValue({ id: asset.id });
  activos.deactivate.mockResolvedValue({ id: asset.id });

  asignaciones.list.mockResolvedValue([]);
  asignaciones.listPeople.mockResolvedValue([{ id: 1, nombre: 'Ana Torres' }]);
  asignaciones.listAvailableAssets.mockResolvedValue([{ id: 8, codigo: 'HER-1', nombre: 'Microscopio' }]);
  asignaciones.create.mockResolvedValue({ id: 10 });
  asignaciones.returnAsset.mockResolvedValue({ id: 10 });

  solicitudes.list.mockResolvedValue([]);
  solicitudes.listAvailableAssets.mockResolvedValue([{ id: 8, codigo: 'HER-1', nombre: 'Microscopio' }]);
  solicitudes.create.mockResolvedValue({ id: 12 });
  solicitudes.resolve.mockResolvedValue({ id: 12, estado: 'aprobada' });
});

describe('flujo HTTP de T7–T9', () => {
  test('activos: lista filtrada, alta con stock, edición, bitácora y baja lógica', async () => {
    await request(app)
      .get('/activos?tipo=refaccion&estado=disponible&buscar=iphone')
      .expect(200)
      .expect('Content-Type', /html/);
    expect(activos.list).toHaveBeenCalledWith({
      search: 'iphone',
      tipo: 'refaccion',
      estado: 'disponible',
    });

    await request(app)
      .post('/activos')
      .type('form')
      .send({
        codigo: 'PAN-11',
        nombre: 'Pantalla iPhone 11',
        categoria_id: '1',
        stock: '3',
        stock_minimo: '1',
      })
      .expect(302)
      .expect('Location', `/activos/${asset.id}`);
    expect(activos.create).toHaveBeenCalledWith(expect.objectContaining({
      codigo: 'PAN-11',
      stock: 3,
      stock_minimo: 1,
    }), 1);

    await request(app)
      .post(`/activos/${asset.id}`)
      .type('form')
      .send({
        codigo: 'PAN-11',
        nombre: 'Pantalla actualizada',
        categoria_id: '1',
        stock: '2',
        stock_minimo: '1',
        estado: 'disponible',
      })
      .expect(302)
      .expect('Location', `/activos/${asset.id}`);
    expect(activos.update).toHaveBeenCalledWith(asset.id, expect.objectContaining({ stock: 2 }), 1);

    await request(app).get(`/activos/${asset.id}`).expect(200);
    expect(activos.getMovements).toHaveBeenCalledWith(asset.id);

    await request(app).post(`/activos/${asset.id}/baja`).expect(302).expect('Location', '/activos');
    expect(activos.deactivate).toHaveBeenCalledWith(asset.id, 1);
  });

  test('solicitudes: render, creación, aprobación y rechazo con motivo', async () => {
    await request(app).get('/solicitudes').expect(200);
    await request(app)
      .post('/solicitudes')
      .type('form')
      .send({ activo_id: '8', motivo: 'Reparación de placa' })
      .expect(302)
      .expect('Location', '/solicitudes');
    expect(solicitudes.create).toHaveBeenCalledWith({
      activoId: 8,
      solicitanteId: 1,
      motivo: 'Reparación de placa',
    });

    await request(app)
      .post('/solicitudes/12/resolver')
      .type('form')
      .send({ decision: 'aprobada' })
      .expect(302)
      .expect('Location', '/solicitudes');
    expect(solicitudes.resolve).toHaveBeenCalledWith(12, 1, 'aprobada', null);

    await request(app)
      .post('/solicitudes/13/resolver')
      .type('form')
      .send({ decision: 'rechazada', motivo: 'No hay disponibilidad' })
      .expect(302)
      .expect('Location', '/solicitudes');
    expect(solicitudes.resolve).toHaveBeenCalledWith(13, 1, 'rechazada', 'No hay disponibilidad');
  });

  test('asignaciones: formulario, alta, devolución y CSS estático', async () => {
    await request(app).get('/asignaciones').expect(200);
    await request(app).get('/asignaciones/nueva').expect(200);
    await request(app)
      .post('/asignaciones')
      .type('form')
      .send({ activo_id: '8', persona_id: '1' })
      .expect(302)
      .expect('Location', '/asignaciones');
    expect(asignaciones.create).toHaveBeenCalledWith({
      activoId: 8,
      personaId: 1,
      userId: 1,
    });

    await request(app).post('/asignaciones/10/devolver').expect(302).expect('Location', '/asignaciones');
    expect(asignaciones.returnAsset).toHaveBeenCalledWith(10, 1);
    await request(app).get('/css/modules.css').expect(200).expect('Content-Type', /css/);
  });
});
