jest.mock('../../src/models/reportes.model');
const model = require('../../src/models/reportes.model');
const service = require('../../src/services/reportes.service');

const admin = { id: 1, rol: 'admin' };
const supervisor = { id: 2, rol: 'supervisor' };
const operativo = { id: 3, rol: 'operativo' };

beforeEach(() => {
  jest.resetAllMocks();
  model.getDashboardMetrics.mockResolvedValue({
    disponibles: 10, asignados: 3, unidades_stock: 1248,
    alertas_stock: 7, solicitudes_pendientes: 4,
  });
  model.listStockBajo.mockResolvedValue([{ id: 1 }, { id: 2 }]);
  model.listSolicitudesRecientes.mockResolvedValue([{ estado: 'pendiente' }]);
  model.listMovimientosRecientes.mockResolvedValue([{ id: 5 }]);
  model.listCategorias.mockResolvedValue([{ id: 1, nombre: 'Pantallas', tipo: 'refaccion' }]);
  model.listPersonasYAreas.mockResolvedValue({
    personas: [{ id: 4, nombre: 'Ana Torres', area_id: 2 }],
    areas: [{ id: 2, nombre: 'Taller' }],
  });
  model.listActivosPorEstado.mockResolvedValue([{ estado: 'disponible', cantidad: 10, porcentaje: 100 }]);
  model.listAsignaciones.mockResolvedValue([]);
  model.listMovimientos.mockResolvedValue([]);
  model.listStockBajoReporte.mockResolvedValue([]);
});

describe('reportes.service dashboard', () => {
  test('arma KPIs exactos con alertas y listados recientes', async () => {
    await expect(service.getDashboard(admin)).resolves.toMatchObject({
      metrics: {
        disponibles: 10, asignados: 3, unidadesStock: 1248,
        alertasStock: 7, solicitudesPendientes: 4,
      },
      stockBajo: [{ id: 1 }, { id: 2 }],
      solicitudes: [{ estado: 'pendiente' }],
      movimientos: [{ id: 5 }],
      canReport: true,
    });
    expect(model.getDashboardMetrics).toHaveBeenCalledTimes(1);
    expect(model.listMovimientosRecientes).toHaveBeenCalledTimes(1);
  });

  test('permite dashboard básico al operativo pero no reportes', async () => {
    await expect(service.getDashboard(operativo)).resolves.toMatchObject({ canReport: false });
    await expect(service.getReport(operativo)).rejects.toMatchObject({ status: 403 });
  });

  test('propaga errores del modelo del dashboard', async () => {
    model.getDashboardMetrics.mockRejectedValue(new Error('database unavailable'));
    await expect(service.getDashboard(supervisor)).rejects.toThrow('database unavailable');
  });
});

describe('reportes.service filtros y permisos', () => {
  test('normaliza filtros y genera el reporte de activos para supervisor', async () => {
    const result = await service.getReport(supervisor, {
      tipo: 'activos', desde: '2026-01-02', hasta: '2026-01-31',
      categoria_id: '1', estado: 'asignado', persona_id: '4', area_id: '2',
    });
    expect(model.listActivosPorEstado).toHaveBeenCalledWith({
      tipo: 'activos', desde: '2026-01-02', hasta: '2026-01-31',
      categoriaId: 1, estado: 'asignado', personaId: 4, areaId: 2,
    });
    expect(result.report).toMatchObject({
      type: 'activos', label: 'Activos por estado',
      columns: [['estado', 'Estado'], ['cantidad', 'Cantidad'], ['porcentaje', 'Porcentaje']],
    });
    expect(result.categories).toHaveLength(1);
    expect(result.personas).toHaveLength(1);
    expect(result.areas).toHaveLength(1);
  });

  test.each([
    ['asignaciones', 'listAsignaciones'],
    ['movimientos', 'listMovimientos'],
    ['stock_bajo', 'listStockBajoReporte'],
  ])('selecciona la consulta correspondiente para %s', async (tipo, method) => {
    await service.getReport(admin, { tipo });
    expect(model[method]).toHaveBeenCalledWith(expect.objectContaining({ tipo, estado: '' }));
  });

  test('rechaza filtros inválidos en vez de ignorarlos', async () => {
    await expect(service.getReport(admin, { tipo: 'otro' })).rejects.toMatchObject({
      status: 400, fields: { tipo: expect.any(String) },
    });
    await expect(service.getReport(admin, { desde: '2026-02-30' })).rejects.toMatchObject({
      fields: { desde: expect.any(String) },
    });
    await expect(service.getReport(admin, { desde: '2026-02-02', hasta: '2026-02-01' })).rejects.toMatchObject({
      fields: { hasta: expect.any(String) },
    });
    await expect(service.getReport(admin, { categoria_id: '-1' })).rejects.toMatchObject({
      fields: { categoria_id: expect.any(String) },
    });
    await expect(service.getReport(admin, { tipo: 'stock_bajo', estado: 'disponible' })).rejects.toMatchObject({
      fields: { estado: expect.any(String) },
    });
  });

  test('CSV cita valores y neutraliza fórmulas de hoja de cálculo', () => {
    const csv = service.toCsv({
      columns: [['codigo', 'Código'], ['nombre', 'Nombre']],
      rows: [{ codigo: 'A-1', nombre: '=HYPERLINK("https://example.test")' }],
    });
    expect(csv).toContain('"Código","Nombre"');
    expect(csv).toContain(`"'=HYPERLINK(""https://example.test"")"`);
  });

  test('niega reportes a usuarios sin rol de supervisor o administrador', async () => {
    await expect(service.getReport(operativo, { tipo: 'activos' })).rejects.toMatchObject({ status: 403 });
    await expect(service.getReport(null, { tipo: 'activos' })).rejects.toMatchObject({ status: 403 });
    expect(model.listActivosPorEstado).not.toHaveBeenCalled();
  });
});
