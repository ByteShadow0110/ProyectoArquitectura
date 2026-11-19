jest.mock('../../src/models/activos.model');
jest.mock('../../src/models/personas.model');
const activos = require('../../src/models/activos.model');
const personas = require('../../src/models/personas.model');
const service = require('../../src/services/activos.service');

const admin = { id: 1, rol: 'admin', areaId: 4 };
const supervisor = { id: 2, rol: 'supervisor', areaId: 2 };
const operativo = { id: 3, rol: 'operativo', areaId: 2 };
const CATS = [{ id: 1, nombre: 'Pantallas', tipo: 'refaccion' }, { id: 4, nombre: 'Herramienta', tipo: 'herramienta' }];
const valid = { codigo: 'pan-ip11', nombre: 'Pantalla iPhone 11', categoria_id: '1', stock: '3', stock_minimo: '5', modelos_compatibles: 'iPhone 11', costo: '850.00' };
const herramienta = { id: 7, codigo: 'HER-1', nombre: 'Estación', tipo: 'herramienta', estado: 'disponible', activo: true, stock: 0 };

describe('activos.service', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    activos.listCategorias.mockResolvedValue(CATS);
    activos.findByCodigo.mockResolvedValue(null);
    activos.create.mockResolvedValue(9);
    activos.count.mockResolvedValue(0);
    activos.list.mockResolvedValue([]);
    activos.transaction.mockImplementation((fn) => fn('client'));
  });

  describe('alta (HU-05)', () => {
    test('crea una refacción, normaliza el SKU y registra el stock inicial', async () => {
      await expect(service.create(admin, valid)).resolves.toBe(9);
      expect(activos.create).toHaveBeenCalledWith(expect.objectContaining({ codigo: 'PAN-IP11', stock: 3, stockMinimo: 5, costo: 850 }), 'client');
      expect(activos.insertMovimiento).toHaveBeenCalledWith(expect.objectContaining({ activoId: 9, tipo: 'entrada', cantidad: 3 }), 'client');
    });

    test('sin stock inicial no registra movimiento', async () => {
      await service.create(admin, { ...valid, stock: '0' });
      expect(activos.insertMovimiento).not.toHaveBeenCalled();
    });

    test('valida obligatorios', async () => {
      await expect(service.create(admin, {})).rejects.toMatchObject({
        status: 400, fields: expect.objectContaining({ codigo: expect.any(String), nombre: expect.any(String), categoria_id: expect.any(String) }),
      });
      expect(activos.create).not.toHaveBeenCalled();
    });

    test('rechaza SKU duplicado, stock negativo/no entero, costo inválido y categoría inexistente', async () => {
      activos.findByCodigo.mockResolvedValue({ id: 50 });
      await expect(service.create(admin, valid)).rejects.toMatchObject({ fields: { codigo: expect.stringContaining('Ya existe') } });
      activos.findByCodigo.mockResolvedValue(null);
      await expect(service.create(admin, { ...valid, stock: '-1' })).rejects.toMatchObject({ fields: { stock: expect.any(String) } });
      await expect(service.create(admin, { ...valid, stock: '1.5' })).rejects.toMatchObject({ fields: { stock: expect.any(String) } });
      await expect(service.create(admin, { ...valid, stock_minimo: 'x' })).rejects.toMatchObject({ fields: { stock_minimo: expect.any(String) } });
      await expect(service.create(admin, { ...valid, costo: '-5' })).rejects.toMatchObject({ fields: { costo: expect.any(String) } });
      await expect(service.create(admin, { ...valid, categoria_id: '99' })).rejects.toMatchObject({ fields: { categoria_id: expect.any(String) } });
    });

    test('una herramienta ignora stock y modelos compatibles', async () => {
      await service.create(admin, { ...valid, categoria_id: '4', stock: '10' });
      expect(activos.create).toHaveBeenCalledWith(expect.objectContaining({ stock: 0, stockMinimo: 0, modelosCompatibles: null }), 'client');
    });
  });

  describe('permisos', () => {
    test('el operativo no puede crear, editar, dar de baja, asignar, devolver ni mover stock', async () => {
      await expect(service.create(operativo, valid)).rejects.toMatchObject({ status: 403 });
      await expect(service.update(operativo, 1, valid)).rejects.toMatchObject({ status: 403 });
      await expect(service.toggleActivo(operativo, 1)).rejects.toMatchObject({ status: 403 });
      await expect(service.asignar(operativo, 1, { persona_id: '1' })).rejects.toMatchObject({ status: 403 });
      await expect(service.devolver(operativo, 1)).rejects.toMatchObject({ status: 403 });
      await expect(service.moverStock(operativo, 1, { tipo: 'entrada', cantidad: '1' })).rejects.toMatchObject({ status: 403 });
    });
  });

  describe('listado y detalle', () => {
    test('combina filtros y pagina; valores inválidos usan predeterminados', async () => {
      activos.count.mockResolvedValue(45);
      const r = await service.list(admin, { q: ' pant ', tipo: 'refaccion', estado: 'asignado', vigencia: 'todos', page: '2' });
      expect(activos.count).toHaveBeenCalledWith({ q: 'pant', tipo: 'refaccion', estado: 'asignado', vigencia: 'todos' });
      expect(activos.list).toHaveBeenCalledWith(expect.anything(), { limit: 20, offset: 20 });
      expect(r).toMatchObject({ total: 45, page: 2, pages: 3 });
      await service.list(admin, { tipo: 'x', estado: 'y', vigencia: 'z', page: '-4' });
      expect(activos.count).toHaveBeenLastCalledWith({ q: '', tipo: '', estado: '', vigencia: 'activos' });
    });

    test('get lanza 404 si no existe', async () => {
      activos.findById.mockResolvedValue(null);
      await expect(service.get(5)).rejects.toMatchObject({ status: 404 });
    });

    test('detalle incluye bitácora y personas asignables solo del área del supervisor', async () => {
      activos.findById.mockResolvedValue(herramienta);
      activos.listMovimientos.mockResolvedValue([{ id: 1 }]);
      activos.findAsignacionVigente.mockResolvedValue(null);
      personas.listSimple.mockResolvedValue([{ id: 1, area_id: 1 }, { id: 2, area_id: 2 }]);
      const r = await service.getDetalle(supervisor, 7);
      expect(r.movimientos).toHaveLength(1);
      expect(r.personasOpciones).toEqual([{ id: 2, area_id: 2 }]);
      expect((await service.getDetalle(admin, 7)).personasOpciones).toHaveLength(2);
      expect((await service.getDetalle(operativo, 7)).personasOpciones).toEqual([]);
    });
  });

  describe('edición y baja lógica (RN-02)', () => {
    test('edita sin cambiar el stock y permite pasar a mantenimiento', async () => {
      activos.findById.mockResolvedValue({ ...herramienta, categoria_id: 4 });
      await service.update(admin, 7, { ...valid, categoria_id: '4', estado: 'mantenimiento' });
      expect(activos.update).toHaveBeenCalledWith(7, expect.objectContaining({ estado: 'mantenimiento' }));
    });

    test('permite que el propio activo conserve su SKU', async () => {
      activos.findById.mockResolvedValue(herramienta);
      activos.findByCodigo.mockResolvedValue({ id: 7 });
      await expect(service.update(admin, 7, { ...valid, categoria_id: '4' })).resolves.toBeUndefined();
    });

    test('rechaza un estado no editable', async () => {
      activos.findById.mockResolvedValue(herramienta);
      await expect(service.update(admin, 7, { ...valid, categoria_id: '4', estado: 'asignado' })).rejects.toMatchObject({ fields: { estado: expect.any(String) } });
    });

    test('da de baja sin borrar y reactiva', async () => {
      activos.findById.mockResolvedValue(herramienta);
      await expect(service.toggleActivo(supervisor, 7)).resolves.toBe(false);
      expect(activos.setActivo).toHaveBeenCalledWith(7, false);
      activos.findById.mockResolvedValue({ ...herramienta, activo: false, estado: 'baja' });
      await expect(service.toggleActivo(supervisor, 7)).resolves.toBe(true);
    });

    test('no permite la baja si está asignado', async () => {
      activos.findById.mockResolvedValue({ ...herramienta, estado: 'asignado' });
      await expect(service.toggleActivo(admin, 7)).rejects.toMatchObject({ status: 409 });
      expect(activos.setActivo).not.toHaveBeenCalled();
    });
  });

  describe('asignar (HU-06)', () => {
    beforeEach(() => {
      personas.findById.mockResolvedValue({ id: 2, nombre: 'Luis', apellidos: 'Ramos', area_id: 2, activo: true });
      activos.findById.mockResolvedValue(herramienta);
    });

    test('asigna un activo disponible: asignación, estado y bitácora', async () => {
      await service.asignar(supervisor, 7, { persona_id: '2', nota: ' taller ' });
      expect(activos.findById).toHaveBeenCalledWith(7, 'client', true);
      expect(activos.insertAsignacion).toHaveBeenCalledWith({ activoId: 7, personaId: 2, asignadoPor: 2 }, 'client');
      expect(activos.setEstado).toHaveBeenCalledWith(7, 'asignado', 'client');
      expect(activos.insertMovimiento).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'asignacion', nota: 'taller' }), 'client');
    });

    test('exige persona válida y activa', async () => {
      await expect(service.asignar(admin, 7, {})).rejects.toMatchObject({ status: 400 });
      personas.findById.mockResolvedValue({ id: 2, activo: false });
      await expect(service.asignar(admin, 7, { persona_id: '2' })).rejects.toMatchObject({ status: 400 });
      personas.findById.mockResolvedValue(null);
      await expect(service.asignar(admin, 7, { persona_id: '2' })).rejects.toMatchObject({ status: 400 });
    });

    test('el supervisor no asigna a personas de otra área', async () => {
      personas.findById.mockResolvedValue({ id: 2, area_id: 1, activo: true });
      await expect(service.asignar(supervisor, 7, { persona_id: '2' })).rejects.toMatchObject({ status: 403 });
    });

    test('solo activos disponibles, vigentes y no refacciones', async () => {
      activos.findById.mockResolvedValue({ ...herramienta, estado: 'asignado' });
      await expect(service.asignar(admin, 7, { persona_id: '2' })).rejects.toMatchObject({ status: 409 });
      activos.findById.mockResolvedValue({ ...herramienta, estado: 'mantenimiento' });
      await expect(service.asignar(admin, 7, { persona_id: '2' })).rejects.toMatchObject({ status: 409 });
      activos.findById.mockResolvedValue({ ...herramienta, activo: false });
      await expect(service.asignar(admin, 7, { persona_id: '2' })).rejects.toMatchObject({ status: 409 });
      activos.findById.mockResolvedValue({ ...herramienta, tipo: 'refaccion' });
      await expect(service.asignar(admin, 7, { persona_id: '2' })).rejects.toMatchObject({ status: 409 });
      activos.findById.mockResolvedValue(null);
      await expect(service.asignar(admin, 7, { persona_id: '2' })).rejects.toMatchObject({ status: 404 });
      expect(activos.insertAsignacion).not.toHaveBeenCalled();
    });
  });

  describe('devolver', () => {
    test('cierra la asignación, libera el activo y registra la devolución', async () => {
      activos.findById.mockResolvedValue({ ...herramienta, estado: 'asignado' });
      activos.findAsignacionVigente.mockResolvedValue({ id: 5, nombre: 'Luis', apellidos: 'Ramos', area_id: 2 });
      await service.devolver(supervisor, 7, {});
      expect(activos.cerrarAsignacion).toHaveBeenCalledWith(5, 'client');
      expect(activos.setEstado).toHaveBeenCalledWith(7, 'disponible', 'client');
      expect(activos.insertMovimiento).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'devolucion' }), 'client');
    });

    test('falla sin asignación vigente, sin activo o con persona de otra área', async () => {
      activos.findById.mockResolvedValue(herramienta);
      activos.findAsignacionVigente.mockResolvedValue(null);
      await expect(service.devolver(admin, 7)).rejects.toMatchObject({ status: 409 });
      activos.findAsignacionVigente.mockResolvedValue({ id: 5, area_id: 1 });
      await expect(service.devolver(supervisor, 7)).rejects.toMatchObject({ status: 403 });
      activos.findById.mockResolvedValue(null);
      await expect(service.devolver(admin, 7)).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('movimientos de stock (RF-09)', () => {
    const refaccion = { id: 1, tipo: 'refaccion', activo: true, stock: 5 };
    beforeEach(() => activos.findById.mockResolvedValue(refaccion));

    test('entrada suma, salida resta y ajuste fija el stock', async () => {
      await service.moverStock(admin, 1, { tipo: 'entrada', cantidad: '3' });
      expect(activos.setStock).toHaveBeenLastCalledWith(1, 8, 'client');
      await service.moverStock(admin, 1, { tipo: 'salida', cantidad: '2' });
      expect(activos.setStock).toHaveBeenLastCalledWith(1, 3, 'client');
      await service.moverStock(admin, 1, { tipo: 'ajuste', cantidad: '0', nota: 'conteo físico' });
      expect(activos.setStock).toHaveBeenLastCalledWith(1, 0, 'client');
      expect(activos.insertMovimiento).toHaveBeenCalledTimes(3);
    });

    test('la salida no puede dejar el stock negativo', async () => {
      await expect(service.moverStock(admin, 1, { tipo: 'salida', cantidad: '6' })).rejects.toMatchObject({ status: 409 });
      expect(activos.setStock).not.toHaveBeenCalled();
    });

    test('valida tipo, cantidad y nota obligatoria en ajustes', async () => {
      await expect(service.moverStock(admin, 1, { tipo: 'x', cantidad: '1' })).rejects.toMatchObject({ fields: { tipo: expect.any(String) } });
      await expect(service.moverStock(admin, 1, { tipo: 'entrada', cantidad: 'a' })).rejects.toMatchObject({ fields: { cantidad: expect.any(String) } });
      await expect(service.moverStock(admin, 1, { tipo: 'entrada', cantidad: '0' })).rejects.toMatchObject({ fields: { cantidad: expect.any(String) } });
      await expect(service.moverStock(admin, 1, { tipo: 'ajuste', cantidad: '4' })).rejects.toMatchObject({ fields: { nota: expect.any(String) } });
    });

    test('solo refacciones vigentes manejan stock', async () => {
      activos.findById.mockResolvedValue({ ...refaccion, tipo: 'herramienta' });
      await expect(service.moverStock(admin, 1, { tipo: 'entrada', cantidad: '1' })).rejects.toMatchObject({ status: 409 });
      activos.findById.mockResolvedValue({ ...refaccion, activo: false });
      await expect(service.moverStock(admin, 1, { tipo: 'entrada', cantidad: '1' })).rejects.toMatchObject({ status: 409 });
      activos.findById.mockResolvedValue(null);
      await expect(service.moverStock(admin, 1, { tipo: 'entrada', cantidad: '1' })).rejects.toMatchObject({ status: 404 });
    });
  });

  test('conteos del dashboard delegan en el modelo', async () => {
    activos.countActivos.mockResolvedValue(8);
    activos.countStockBajo.mockResolvedValue(2);
    await expect(service.countActivos()).resolves.toBe(8);
    await expect(service.countStockBajo()).resolves.toBe(2);
  });
});
