process.env.SESSION_SECRET = 'test-session-secret';
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';

jest.mock('../../src/models/reportes.model');
jest.mock('../../src/middlewares/auth.middleware', () => (req, res, next) => {
  const rol = req.get('x-test-role') || 'admin';
  req.session.user = { id: 1, personaId: 1, areaId: 2, nombre: 'Admin Prueba', rol };
  req.user = req.session.user;
  res.locals.user = req.session.user;
  next();
});

const request = require('supertest');
const app = require('../../src/app');
const model = require('../../src/models/reportes.model');

beforeEach(() => {
  jest.resetAllMocks();
  model.getDashboardMetrics.mockResolvedValue({
    disponibles: 8, asignados: 3, unidades_stock: 1248,
    alertas_stock: 2, solicitudes_pendientes: 4,
  });
  model.listStockBajo.mockResolvedValue([{
    id: 6, codigo: 'PAN-IP11', nombre: 'Pantalla iPhone 11', stock: 2, stock_minimo: 5,
  }]);
  model.listSolicitudesRecientes.mockResolvedValue([{
    id: 9, estado: 'pendiente', creado_en: '2026-03-01T10:00:00Z',
    solicitante: 'Luis Ramos', activo_id: 3, activo: 'Estación de calor',
  }]);
  model.listMovimientosRecientes.mockResolvedValue([{
    id: 10, tipo: 'asignacion', cantidad: 1, creado_en: '2026-03-02T10:00:00Z',
    activo_id: 3, codigo: 'HER-1', activo: 'Estación de calor', usuario: 'Ana Torres', nota: null,
  }]);
  model.listCategorias.mockResolvedValue([{ id: 1, nombre: 'Refacciones', tipo: 'refaccion' }]);
  model.listPersonasYAreas.mockResolvedValue({
    personas: [{ id: 1, nombre: 'Luis Ramos', area_id: 2 }],
    areas: [{ id: 2, nombre: 'Taller' }],
  });
  model.listActivosPorEstado.mockResolvedValue([
    { estado: 'disponible', cantidad: 8, porcentaje: 72.7 },
    { estado: 'asignado', cantidad: 3, porcentaje: 27.3 },
  ]);
  model.listAsignaciones.mockResolvedValue([]);
  model.listMovimientos.mockResolvedValue([]);
  model.listStockBajoReporte.mockResolvedValue([]);
});

describe('reportes (HTTP)', () => {
  test('dashboard renderiza métricas, alertas, solicitudes y bitácora recientes', async () => {
    const response = await request(app).get('/dashboard').expect(200);
    expect(response.text).toContain('1,248');
    expect(response.text).toContain('Activos disponibles');
    expect(response.text).toContain('Pantalla iPhone 11');
    expect(response.text).toContain('Luis Ramos');
    expect(response.text).toContain('Movimientos recientes de bitácora');
  });

  test('el dashboard operativo muestra el resumen básico y oculta los detalles administrativos', async () => {
    const response = await request(app).get('/dashboard').set('x-test-role', 'operativo').expect(200);
    expect(response.text).toContain('Activos disponibles');
    expect(response.text).not.toContain('Movimientos recientes de bitácora');
    expect(response.text).not.toContain('Accesos rápidos');
  });

  test('aplica filtros enviados al reporte y renderiza filas agrupadas', async () => {
    const response = await request(app)
      .get('/reportes?tipo=activos&desde=2026-01-01&hasta=2026-01-31&categoria_id=1&estado=asignado')
      .expect(200);
    expect(model.listActivosPorEstado).toHaveBeenCalledWith({
      tipo: 'activos', desde: '2026-01-01', hasta: '2026-01-31',
      categoriaId: 1, estado: 'asignado', personaId: null, areaId: null,
    });
    expect(response.text).toContain('Activos por estado');
    expect(response.text).toContain('72.7%');
  });

  test('permite CSV y una vista de impresión a roles autorizados', async () => {
    const csv = await request(app).get('/reportes/exportar.csv?tipo=activos').expect(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.headers['content-disposition']).toContain('refaccionesmx-activos.csv');
    expect(csv.text).toContain('Estado');

    const print = await request(app).get('/reportes/imprimir?tipo=activos').expect(200);
    expect(print.text).toContain('Activos por estado');
    expect(print.text).not.toContain('Descargar CSV');
  });

  test.each([
    ['asignaciones', 'Asignaciones por persona'],
    ['movimientos', 'Movimientos por fecha'],
    ['stock_bajo', 'Stock bajo'],
  ])('renderiza correctamente el reporte de %s', async (tipo, heading) => {
    const response = await request(app).get(`/reportes?tipo=${tipo}`).expect(200);
    expect(response.text).toContain(heading);
  });

  test('rechaza reportes para operativo y muestra errores de filtros inválidos', async () => {
    await request(app).get('/reportes').set('x-test-role', 'operativo').expect(403);
    const invalid = await request(app).get('/reportes?desde=2026-02-30').expect(400);
    expect(invalid.text).toContain('Error');
    expect(model.listActivosPorEstado).not.toHaveBeenCalled();
  });
});
