jest.mock('../../src/models/personas.model');
const personas = require('../../src/models/personas.model');
const service = require('../../src/services/personas.service');

const admin = { id: 1, rol: 'admin', areaId: 4 };
const supervisor = { id: 2, rol: 'supervisor', areaId: 2 };
const operativo = { id: 3, rol: 'operativo', areaId: 2 };
const AREAS = [{ id: 1, nombre: 'Ventas' }, { id: 2, nombre: 'Taller' }];
const valid = { nombre: 'Luis', apellidos: 'Ramos', correo: 'luis@tienda.com', telefono: '55 1234 5678', puesto: 'Técnico', area_id: '2', fecha_ingreso: '2025-01-15' };

describe('personas.service', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    personas.listAreas.mockResolvedValue(AREAS);
    personas.findByCorreo.mockResolvedValue(null);
    personas.create.mockResolvedValue(9);
    personas.count.mockResolvedValue(0);
    personas.list.mockResolvedValue([]);
  });

  describe('alta (HU-03)', () => {
    test('crea una persona válida', async () => {
      await expect(service.create(admin, valid)).resolves.toBe(9);
      expect(personas.create).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Luis', areaId: 2, fechaIngreso: '2025-01-15' }));
    });

    test('valida campos obligatorios antes de guardar', async () => {
      await expect(service.create(admin, {})).rejects.toMatchObject({
        status: 400, fields: expect.objectContaining({ nombre: expect.any(String), apellidos: expect.any(String), area_id: expect.any(String), fecha_ingreso: expect.any(String) }),
      });
      expect(personas.create).not.toHaveBeenCalled();
    });

    test('rechaza correo duplicado', async () => {
      personas.findByCorreo.mockResolvedValue({ id: 50 });
      await expect(service.create(admin, valid)).rejects.toMatchObject({ fields: { correo: expect.stringContaining('Ya existe') } });
    });

    test('rechaza fecha futura, fecha inválida, teléfono y correo inválidos', async () => {
      await expect(service.create(admin, { ...valid, fecha_ingreso: '2999-01-01' })).rejects.toMatchObject({ fields: { fecha_ingreso: expect.any(String) } });
      await expect(service.create(admin, { ...valid, fecha_ingreso: '2025-02-31' })).rejects.toMatchObject({ fields: { fecha_ingreso: expect.any(String) } });
      await expect(service.create(admin, { ...valid, telefono: 'abc' })).rejects.toMatchObject({ fields: { telefono: expect.any(String) } });
      await expect(service.create(admin, { ...valid, correo: 'mal' })).rejects.toMatchObject({ fields: { correo: expect.any(String) } });
    });

    test('rechaza un área que no existe', async () => {
      await expect(service.create(admin, { ...valid, area_id: '99' })).rejects.toMatchObject({ fields: { area_id: expect.any(String) } });
    });

    test('correo y teléfono son opcionales', async () => {
      await expect(service.create(admin, { ...valid, correo: '', telefono: '' })).resolves.toBe(9);
      expect(personas.create).toHaveBeenCalledWith(expect.objectContaining({ correo: null, telefono: null }));
    });
  });

  describe('permisos y alcance por área (RN-04)', () => {
    test('el operativo no puede crear, editar ni dar de baja', async () => {
      await expect(service.create(operativo, valid)).rejects.toMatchObject({ status: 403 });
      await expect(service.update(operativo, 1, valid)).rejects.toMatchObject({ status: 403 });
      await expect(service.toggleActivo(operativo, 1)).rejects.toMatchObject({ status: 403 });
    });

    test('el supervisor solo crea personas de su área', async () => {
      await expect(service.create(supervisor, { ...valid, area_id: '1' })).rejects.toMatchObject({ fields: { area_id: expect.any(String) } });
      await expect(service.create(supervisor, valid)).resolves.toBe(9);
    });

    test('el supervisor no ve personas de otra área', async () => {
      personas.findById.mockResolvedValue({ id: 5, area_id: 1, activo: true });
      await expect(service.get(supervisor, 5)).rejects.toMatchObject({ status: 403 });
      await expect(service.get(admin, 5)).resolves.toMatchObject({ id: 5 });
      await expect(service.get(operativo, 5)).resolves.toMatchObject({ id: 5 });
    });

    test('el listado del supervisor se fuerza a su área aunque pida otra', async () => {
      await service.list(supervisor, { area: '1' });
      expect(personas.count).toHaveBeenCalledWith(expect.objectContaining({ areaId: 2 }));
    });

    test('un supervisor sin área no ve nada', async () => {
      await service.list({ rol: 'supervisor', areaId: null }, {});
      expect(personas.count).toHaveBeenCalledWith(expect.objectContaining({ areaId: -1 }));
    });
  });

  describe('búsqueda y filtros (HU-04)', () => {
    test('combina texto, área y estado y pagina', async () => {
      personas.count.mockResolvedValue(45);
      const r = await service.list(admin, { q: ' ana ', area: '2', estado: 'inactivos', page: '2' });
      expect(personas.count).toHaveBeenCalledWith({ q: 'ana', areaId: 2, estado: 'inactivos' });
      expect(personas.list).toHaveBeenCalledWith({ q: 'ana', areaId: 2, estado: 'inactivos' }, { limit: 20, offset: 20 });
      expect(r).toMatchObject({ total: 45, page: 2, pages: 3 });
    });

    test('valores inválidos usan los predeterminados', async () => {
      await service.list(admin, { estado: 'x', page: '-4' });
      expect(personas.count).toHaveBeenCalledWith({ q: '', areaId: null, estado: 'activos' });
    });
  });

  describe('baja lógica (RN-02)', () => {
    test('da de baja sin borrar el registro', async () => {
      personas.findById.mockResolvedValue({ id: 5, area_id: 2, activo: true });
      personas.countAsignacionesActivas.mockResolvedValue(0);
      await expect(service.toggleActivo(supervisor, 5)).resolves.toBe(false);
      expect(personas.setActivo).toHaveBeenCalledWith(5, false);
    });

    test('no permite la baja si tiene activos asignados', async () => {
      personas.findById.mockResolvedValue({ id: 5, area_id: 2, activo: true });
      personas.countAsignacionesActivas.mockResolvedValue(2);
      await expect(service.toggleActivo(admin, 5)).rejects.toMatchObject({ status: 409 });
      expect(personas.setActivo).not.toHaveBeenCalled();
    });

    test('reactivar no revisa asignaciones', async () => {
      personas.findById.mockResolvedValue({ id: 5, area_id: 2, activo: false });
      await expect(service.toggleActivo(admin, 5)).resolves.toBe(true);
      expect(personas.countAsignacionesActivas).not.toHaveBeenCalled();
    });
  });

  test('expediente incluye los activos asignados (HU-05)', async () => {
    personas.findById.mockResolvedValue({ id: 5, area_id: 2 });
    personas.listAsignaciones.mockResolvedValue([{ codigo: 'HER-014' }]);
    await expect(service.getExpediente(admin, 5)).resolves.toMatchObject({ asignaciones: [{ codigo: 'HER-014' }] });
  });

  test('persona inexistente responde 404', async () => {
    personas.findById.mockResolvedValue(null);
    await expect(service.get(admin, 404)).rejects.toMatchObject({ status: 404 });
  });
});
