process.env.SESSION_SECRET = 'test-session-secret';
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';

jest.mock('../../src/models/activos.model');
jest.mock('../../src/models/asignaciones.model');
jest.mock('../../src/models/solicitudes.model');
jest.mock('../../src/middlewares/auth.middleware', () => (req, res, next) => {
  req.session.user = req.session.user || {
    id: 1, personaId: 1, areaId: 1, nombre: 'Admin Prueba', rol: 'admin',
  };
  req.user = req.session.user;
  res.locals.user = req.session.user;
  next();
});

const request = require('supertest');
const app = require('../../src/app');
const activos = require('../../src/models/activos.model');
const asignaciones = require('../../src/models/asignaciones.model');
const solicitudes = require('../../src/models/solicitudes.model');

const category = { id: 1, nombre: 'Refacción', tipo: 'refaccion' };
const asset = {
  id: 5, codigo: 'PAN-11', nombre: 'Pantalla iPhone 11', categoria_id: 1,
  categoria: 'Refacción', tipo: 'refaccion', estado: 'disponible', stock: 3,
  stock_minimo: 1, modelos_compatibles: 'iPhone 11', costo: null, activo: true,
};
const tool = {
  id: 8, codigo: 'HER-1', nombre: 'Microscopio', categoria_id: 2,
  tipo: 'herramienta', estado: 'disponible', stock: 0, activo: true,
};

function extractCsrf(html) {
  const match = html.match(/name="_csrf" value="([a-f0-9]+)"/);
  return match && match[1];
}

beforeEach(() => {
  jest.clearAllMocks();
  activos.list.mockResolvedValue([asset]);
  activos.count.mockResolvedValue(1);
  activos.listCategorias.mockResolvedValue([category, { id: 2, nombre: 'Herramienta', tipo: 'herramienta' }]);
  activos.findByCodigo.mockResolvedValue(null);
  activos.findById.mockResolvedValue(asset);
  activos.create.mockResolvedValue(asset.id);
  activos.update.mockResolvedValue(undefined);
  activos.setActivo.mockResolvedValue(undefined);
  activos.listMovimientos.mockResolvedValue([]);
  activos.findAsignacionVigente.mockResolvedValue(null);
  activos.listSolicitables.mockResolvedValue([tool]);
  activos.transaction.mockImplementation((fn) => fn({}));
  activos.insertMovimiento.mockResolvedValue(undefined);
  activos.insertAsignacion.mockResolvedValue(20);
  activos.setEstado.mockResolvedValue(undefined);

  asignaciones.list.mockResolvedValue([]);
  asignaciones.listPeople.mockResolvedValue([{ id: 1, nombre: 'Ana Torres' }]);
  asignaciones.listAvailableAssets.mockResolvedValue([tool]);
  asignaciones.create.mockResolvedValue({ id: 10 });
  asignaciones.returnAsset.mockResolvedValue({ id: 10 });

  solicitudes.count.mockResolvedValue(1);
  solicitudes.list.mockResolvedValue([]);
  solicitudes.findPendiente.mockResolvedValue(null);
  solicitudes.create.mockResolvedValue(12);
  solicitudes.transaction.mockImplementation((fn) => fn({}));
  solicitudes.findById.mockResolvedValue({
    id: 12, activo_id: 8, solicitante_id: 1, solicitante: 'Admin Prueba', estado: 'pendiente',
  });
  solicitudes.resolver.mockResolvedValue(undefined);
});

describe('flujo HTTP de T7–T9', () => {
  test('activos: lista, alta, edición, detalle y baja lógica', async () => {
    const agent = request.agent(app);
    const list = await agent.get('/activos?tipo=refaccion&estado=disponible&q=iphone').expect(200);
    expect(activos.list).toHaveBeenCalledWith(
      { q: 'iphone', tipo: 'refaccion', estado: 'disponible', vigencia: 'activos' },
      { limit: 20, offset: 0 }
    );

    const form = await agent.get('/activos/nuevo').expect(200);
    const token = extractCsrf(form.text);
    expect(token).toBeTruthy();
    await agent.post('/activos').type('form').send({
      _csrf: token, codigo: 'PAN-11', nombre: 'Pantalla iPhone 11',
      categoria_id: '1', stock: '3', stock_minimo: '1',
    }).expect(302).expect('Location', `/activos/${asset.id}`);
    expect(activos.create).toHaveBeenCalledWith(
      expect.objectContaining({ codigo: 'PAN-11', stock: 3, stockMinimo: 1 }),
      {}
    );

    await agent.post(`/activos/${asset.id}`).type('form').send({
      _csrf: token, codigo: 'PAN-11', nombre: 'Pantalla actualizada',
      categoria_id: '1', stock_minimo: '1', estado: 'disponible',
    }).expect(302).expect('Location', `/activos/${asset.id}`);
    expect(activos.update).toHaveBeenCalledWith(asset.id, expect.objectContaining({
      nombre: 'Pantalla actualizada',
    }));

    await agent.get(`/activos/${asset.id}`).expect(200);
    expect(activos.listMovimientos).toHaveBeenCalledWith(asset.id);
    await agent.post(`/activos/${asset.id}/baja`).type('form').send({ _csrf: token })
      .expect(302).expect('Location', `/activos/${asset.id}`);
    expect(activos.setActivo).toHaveBeenCalledWith(asset.id, false);
  });

  test('solicitudes: listado, creación, aprobación y rechazo con motivo', async () => {
    const agent = request.agent(app);
    await agent.get('/solicitudes').expect(200);
    const form = await agent.get('/solicitudes/nueva').expect(200);
    const token = extractCsrf(form.text);

    activos.findById.mockResolvedValue(tool);
    await agent.post('/solicitudes').type('form').send({
      _csrf: token, activo_id: '8', motivo: 'Reparación de placa',
    }).expect(302).expect('Location', '/solicitudes?estado=todas');
    expect(solicitudes.create).toHaveBeenCalledWith({
      activoId: 8, solicitanteId: 1, motivo: 'Reparación de placa',
    });

    await agent.post('/solicitudes/12/aprobar').type('form').send({ _csrf: token })
      .expect(302).expect('Location', '/solicitudes');
    expect(solicitudes.resolver).toHaveBeenCalledWith(
      12, { estado: 'aprobada', usuarioId: 1 }, {}
    );

    await agent.post('/solicitudes/13/rechazar').type('form').send({
      _csrf: token, motivo: 'No hay disponibilidad',
    }).expect(302).expect('Location', '/solicitudes');
    expect(solicitudes.resolver).toHaveBeenCalledWith(13, {
      estado: 'rechazada', motivoResolucion: 'No hay disponibilidad', usuarioId: 1,
    }, {});
  });

  test('asignaciones: formulario, alta, devolución y CSS estático', async () => {
    const agent = request.agent(app);
    await agent.get('/asignaciones').expect(200);
    const form = await agent.get('/asignaciones/nueva').expect(200);
    const token = extractCsrf(form.text);

    await agent.post('/asignaciones').type('form').send({
      _csrf: token, activo_id: '8', persona_id: '1',
    }).expect(302).expect('Location', '/asignaciones');
    expect(asignaciones.create).toHaveBeenCalledWith({
      activoId: 8, personaId: 1, userId: 1,
    });

    await agent.post('/asignaciones/10/devolver').type('form').send({ _csrf: token })
      .expect(302).expect('Location', '/asignaciones');
    expect(asignaciones.returnAsset).toHaveBeenCalledWith(10, 1);
    await agent.get('/css/modules.css').expect(200).expect('Content-Type', /css/);
  });
});
