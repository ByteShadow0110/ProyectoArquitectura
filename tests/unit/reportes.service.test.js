jest.mock('../../src/models/reportes.model');
jest.mock('../../src/models/personas.model');
const model = require('../../src/models/reportes.model');
const personas = require('../../src/models/personas.model');
const service = require('../../src/services/reportes.service');

const admin = { id: 1, rol: 'admin' };
const supervisor = { id: 2, rol: 'supervisor', areaId: 2 };
const operativo = { id: 3, rol: 'operativo', personaId: 3 };

describe('reportes.service', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    model.asignaciones.mockResolvedValue([]);
    model.movimientos.mockResolvedValue([]);
    model.activosPorEstado.mockResolvedValue([]);
    model.stockBajo.mockResolvedValue([]);
    personas.listSimple.mockResolvedValue([{ id: 2, area_id: 2 }, { id: 4, area_id: 1 }]);
  });

  describe('dashboard (HU-09, RF-13)', () => {
    test('admin y supervisor ven KPIs completos y la lista de stock bajo', async () => {
      model.totalStockRefacciones.mockResolvedValue(120);
      model.stockBajo.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]).mockResolvedValueOnce([{ id: 1 }]);
      model.countAsignados.mockResolvedValue(4);
      model.countSolicitudesPendientes.mockResolvedValue(2);
      model.solicitudesRecientes.mockResolvedValue([{ id: 9 }]);
      const r = await service.dashboard(supervisor);
      expect(r).toMatchObject({ basico: false, kpis: { stockTotal: 120, stockBajo: 2, asignados: 4, pendientes: 2 }, bajos: [{ id: 1 }], recientes: [{ id: 9 }] });
      expect(model.solicitudesRecientes).toHaveBeenCalledWith(5);
    });

    test('el operativo ve una versión básica con solo lo suyo', async () => {
      model.countDisponibles.mockResolvedValue(6);
      model.countAsignadosA.mockResolvedValue(1);
      model.countSolicitudesPendientes.mockResolvedValue(1);
      model.solicitudesRecientes.mockResolvedValue([]);
      const r = await service.dashboard(operativo);
      expect(r).toMatchObject({ basico: true, kpis: { disponibles: 6, misAsignados: 1, misPendientes: 1 }, bajos: [] });
      expect(model.countAsignadosA).toHaveBeenCalledWith(3);
      expect(model.solicitudesRecientes).toHaveBeenCalledWith(5, 3);
    });

    test('operativo sin persona asociada no ve datos ajenos', async () => {
      model.countDisponibles.mockResolvedValue(0);
      model.countAsignadosA.mockResolvedValue(0);
      model.countSolicitudesPendientes.mockResolvedValue(0);
      model.solicitudesRecientes.mockResolvedValue([]);
      await service.dashboard({ rol: 'operativo', personaId: null });
      expect(model.countAsignadosA).toHaveBeenCalledWith(-1);
    });
  });

  describe('reportes (HU-10, RF-14)', () => {
    test('el operativo no puede ver ni exportar reportes', async () => {
      await expect(service.run(operativo, {})).rejects.toMatchObject({ status: 403 });
      await expect(service.exportCsv(operativo, {})).rejects.toMatchObject({ status: 403 });
    });

    test('activos por estado calcula porcentajes', async () => {
      model.activosPorEstado.mockResolvedValue([{ estado: 'disponible', cantidad: 3 }, { estado: 'asignado', cantidad: 1 }]);
      const r = await service.run(admin, { tipo: 'activos-estado' });
      expect(r.total).toBe(4);
      expect(r.rows).toEqual([{ estado: 'Disponible', cantidad: 3, porcentaje: 75 }, { estado: 'Asignado', cantidad: 1, porcentaje: 25 }]);
    });

    test('sin activos no divide entre cero', async () => {
      const r = await service.run(admin, {});
      expect(r.rows).toEqual([]);
      expect(r.tipo).toBe('activos-estado');
    });

    test('tipo inválido usa el reporte por omisión', async () => {
      expect((await service.run(admin, { tipo: 'zzz' })).tipo).toBe('activos-estado');
    });

    test('asignaciones: aplica filtros y formatea fechas', async () => {
      model.asignaciones.mockResolvedValue([
        { persona: 'Ana Torres', area: 'Taller', codigo: 'HER-1', activo: 'Estación', fecha_asignacion: '2026-11-03T10:00:00Z', fecha_devolucion: null },
        { persona: 'Ana Torres', area: null, codigo: 'HER-2', activo: 'Kit', fecha_asignacion: '2026-10-01T10:00:00Z', fecha_devolucion: '2026-10-05T10:00:00Z' },
      ]);
      const r = await service.run(admin, { tipo: 'asignaciones', persona: '2', desde: '2026-10-01', hasta: '2026-11-30' });
      expect(model.asignaciones).toHaveBeenCalledWith({ personaId: 2, areaId: null, desde: '2026-10-01', hasta: '2026-11-30' }, 500);
      expect(r.rows[0]).toMatchObject({ persona: 'Ana Torres', devuelto: 'Vigente' });
      expect(r.rows[1]).toMatchObject({ area: '', devuelto: '05/10/2026' });
    });

    test('el supervisor queda limitado a su área y a personas de su área (RN-04)', async () => {
      await service.run(supervisor, { tipo: 'asignaciones', persona: '4' });
      expect(model.asignaciones).toHaveBeenLastCalledWith(expect.objectContaining({ areaId: 2, personaId: -1 }), 500);
      await service.run(supervisor, { tipo: 'asignaciones', persona: '2' });
      expect(model.asignaciones).toHaveBeenLastCalledWith(expect.objectContaining({ areaId: 2, personaId: 2 }), 500);
      await service.run({ rol: 'supervisor', areaId: null }, { tipo: 'asignaciones' });
      expect(model.asignaciones).toHaveBeenLastCalledWith(expect.objectContaining({ areaId: -1 }), 500);
    });

    test('movimientos: filtra por tipo y fechas', async () => {
      model.movimientos.mockResolvedValue([{ creado_en: '2026-11-03T10:00:00Z', codigo: 'A', activo: 'X', tipo: 'salida', cantidad: 2, usuario: null, nota: null }]);
      const r = await service.run(admin, { tipo: 'movimientos', mov: 'salida', desde: '2026-11-01' });
      expect(model.movimientos).toHaveBeenCalledWith({ tipo: 'salida', desde: '2026-11-01', hasta: null }, 500);
      expect(r.rows[0]).toMatchObject({ tipo: 'Salida', usuario: '', nota: '' });
      await service.run(admin, { tipo: 'movimientos', mov: 'xxx' });
      expect(model.movimientos).toHaveBeenLastCalledWith({ tipo: null, desde: null, hasta: null }, 500);
    });

    test('stock bajo lista las refacciones', async () => {
      model.stockBajo.mockResolvedValue([{ codigo: 'P', nombre: 'Pantalla', stock: 1, stock_minimo: 5 }]);
      expect((await service.run(admin, { tipo: 'stock-bajo' })).rows).toEqual([{ codigo: 'P', nombre: 'Pantalla', stock: 1, minimo: 5 }]);
    });

    test('valida fechas', async () => {
      await expect(service.run(admin, { tipo: 'movimientos', desde: '2026-02-31' })).rejects.toMatchObject({ status: 400, fields: { desde: expect.any(String) } });
      await expect(service.run(admin, { tipo: 'movimientos', hasta: 'hoy' })).rejects.toMatchObject({ fields: { hasta: expect.any(String) } });
      await expect(service.run(admin, { tipo: 'movimientos', desde: '2026-12-01', hasta: '2026-11-01' })).rejects.toMatchObject({ fields: { hasta: expect.any(String) } });
      expect(model.movimientos).not.toHaveBeenCalled();
    });

    test('marca el resultado como truncado al llegar al límite', async () => {
      model.movimientos.mockResolvedValue(Array.from({ length: 500 }, () => ({ creado_en: '2026-11-03T10:00:00Z', tipo: 'entrada' })));
      expect((await service.run(admin, { tipo: 'movimientos' })).truncated).toBe(true);
    });
  });

  describe('exportar CSV (RF-15)', () => {
    test('genera encabezados, BOM, nombre de archivo y escapa valores', async () => {
      model.movimientos.mockResolvedValue([
        { creado_en: '2026-11-03T10:00:00Z', codigo: 'A', activo: 'Pantalla, 6"', tipo: 'entrada', cantidad: 2, usuario: 'Ana', nota: 'línea1\nlínea2' },
      ]);
      const { filename, content } = await service.exportCsv(admin, { tipo: 'movimientos' });
      expect(filename).toMatch(/^reporte-movimientos-\d{4}-\d{2}-\d{2}\.csv$/);
      expect(content.charCodeAt(0)).toBe(0xfeff);
      const lines = content.slice(1).split('\r\n');
      expect(lines[0]).toBe('Fecha,Código,Activo,Tipo,Cant.,Usuario,Nota');
      expect(lines[1]).toContain('"Pantalla, 6"""');
      expect(model.movimientos).toHaveBeenCalledWith(expect.anything(), 10000);
    });

    test('neutraliza fórmulas de hoja de cálculo', () => {
      expect(service.csvCell('=SUMA(A1)')).toBe("'=SUMA(A1)");
      expect(service.csvCell('+52 55')).toBe("'+52 55");
      expect(service.csvCell('@x')).toBe("'@x");
      expect(service.csvCell(null)).toBe('');
      expect(service.csvCell(0)).toBe('0');
    });

    test('el supervisor también queda limitado por área al exportar', async () => {
      await service.exportCsv(supervisor, { tipo: 'asignaciones', persona: '4' });
      expect(model.asignaciones).toHaveBeenCalledWith(expect.objectContaining({ areaId: 2, personaId: -1 }), 10000);
    });

    test('rechaza fechas inválidas', async () => {
      await expect(service.exportCsv(admin, { desde: 'x' })).rejects.toMatchObject({ status: 400 });
    });
  });

  test('opciones de personas: el supervisor solo ve su área', async () => {
    expect(await service.personasOpciones(supervisor)).toEqual([{ id: 2, area_id: 2 }]);
    expect(await service.personasOpciones(admin)).toHaveLength(2);
  });
});
