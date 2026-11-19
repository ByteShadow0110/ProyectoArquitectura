jest.mock('../../src/models/solicitudes.model');
jest.mock('../../src/models/activos.model');
const solicitudes = require('../../src/models/solicitudes.model');
const activos = require('../../src/models/activos.model');
const service = require('../../src/services/solicitudes.service');

const admin = { id: 1, rol: 'admin', personaId: 1 };
const supervisor = { id: 2, rol: 'supervisor', personaId: 2 };
const operativo = { id: 3, rol: 'operativo', personaId: 3 };
const sinPersona = { id: 4, rol: 'operativo', personaId: null };
const libre = { id: 7, tipo: 'herramienta', estado: 'disponible', activo: true };
const pendiente = { id: 10, activo_id: 7, solicitante_id: 3, solicitante: 'Luis Ramos', estado: 'pendiente' };

describe('solicitudes.service', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    solicitudes.count.mockResolvedValue(0);
    solicitudes.list.mockResolvedValue([]);
    solicitudes.transaction.mockImplementation((fn) => fn('client'));
  });

  describe('crear (HU-07)', () => {
    beforeEach(() => {
      activos.findById.mockResolvedValue(libre);
      solicitudes.findPendiente.mockResolvedValue(null);
      solicitudes.create.mockResolvedValue(11);
    });

    test('crea la solicitud pendiente a nombre de la persona del usuario', async () => {
      await expect(service.create(operativo, { activo_id: '7', motivo: ' Reparación ' })).resolves.toBe(11);
      expect(solicitudes.create).toHaveBeenCalledWith({ activoId: 7, solicitanteId: 3, motivo: 'Reparación' });
    });

    test('exige persona asociada al usuario', async () => {
      await expect(service.create(sinPersona, { activo_id: '7', motivo: 'x' })).rejects.toMatchObject({ status: 409 });
    });

    test('valida activo y motivo', async () => {
      await expect(service.create(operativo, {})).rejects.toMatchObject({ fields: { activo_id: expect.any(String), motivo: expect.any(String) } });
      await expect(service.create(operativo, { activo_id: '7', motivo: 'x'.repeat(301) })).rejects.toMatchObject({ fields: { motivo: expect.any(String) } });
    });

    test('solo activos existentes, disponibles, no refacciones y sin duplicado pendiente', async () => {
      activos.findById.mockResolvedValue(null);
      await expect(service.create(operativo, { activo_id: '7', motivo: 'x' })).rejects.toMatchObject({ fields: { activo_id: expect.any(String) } });
      activos.findById.mockResolvedValue({ ...libre, tipo: 'refaccion' });
      await expect(service.create(operativo, { activo_id: '7', motivo: 'x' })).rejects.toMatchObject({ fields: { activo_id: expect.any(String) } });
      activos.findById.mockResolvedValue({ ...libre, estado: 'asignado' });
      await expect(service.create(operativo, { activo_id: '7', motivo: 'x' })).rejects.toMatchObject({ fields: { activo_id: expect.any(String) } });
      activos.findById.mockResolvedValue(libre);
      solicitudes.findPendiente.mockResolvedValue({ id: 1 });
      await expect(service.create(operativo, { activo_id: '7', motivo: 'x' })).rejects.toMatchObject({ fields: { activo_id: expect.stringContaining('pendiente') } });
      expect(solicitudes.create).not.toHaveBeenCalled();
    });
  });

  describe('listado', () => {
    test('el operativo solo ve las suyas; admin y supervisor ven todas', async () => {
      await service.list(operativo, {});
      expect(solicitudes.count).toHaveBeenLastCalledWith({ estado: 'pendiente', solicitanteId: 3 });
      await service.list(sinPersona, { estado: 'todas' });
      expect(solicitudes.count).toHaveBeenLastCalledWith({ estado: null, solicitanteId: -1 });
      await service.list(supervisor, { estado: 'aprobada', page: '2' });
      expect(solicitudes.count).toHaveBeenLastCalledWith({ estado: 'aprobada', solicitanteId: null });
      expect(solicitudes.list).toHaveBeenLastCalledWith(expect.anything(), { limit: 20, offset: 20 });
    });

    test('estado inválido usa pendiente', async () => {
      const r = await service.list(admin, { estado: 'zzz' });
      expect(r.filters.estado).toBe('pendiente');
    });
  });

  describe('aprobar (HU-08)', () => {
    beforeEach(() => {
      solicitudes.findById.mockResolvedValue(pendiente);
      activos.findById.mockResolvedValue(libre);
    });

    test('crea la asignación, pasa el activo a asignado y resuelve la solicitud', async () => {
      await service.aprobar(supervisor, 10);
      expect(activos.insertAsignacion).toHaveBeenCalledWith({ activoId: 7, personaId: 3, solicitudId: 10, asignadoPor: 2 }, 'client');
      expect(activos.setEstado).toHaveBeenCalledWith(7, 'asignado', 'client');
      expect(activos.insertMovimiento).toHaveBeenCalledWith(expect.objectContaining({ activoId: 7, tipo: 'asignacion' }), 'client');
      expect(solicitudes.resolver).toHaveBeenCalledWith(10, { estado: 'aprobada', usuarioId: 2 }, 'client');
    });

    test('el operativo no puede aprobar ni rechazar', async () => {
      await expect(service.aprobar(operativo, 10)).rejects.toMatchObject({ status: 403 });
      await expect(service.rechazar(operativo, 10, { motivo: 'x' })).rejects.toMatchObject({ status: 403 });
    });

    test('falla si no existe, ya fue resuelta o el activo ya no está disponible', async () => {
      solicitudes.findById.mockResolvedValue(null);
      await expect(service.aprobar(admin, 10)).rejects.toMatchObject({ status: 404 });
      solicitudes.findById.mockResolvedValue({ ...pendiente, estado: 'aprobada' });
      await expect(service.aprobar(admin, 10)).rejects.toMatchObject({ status: 409 });
      solicitudes.findById.mockResolvedValue(pendiente);
      activos.findById.mockResolvedValue({ ...libre, estado: 'asignado' });
      await expect(service.aprobar(admin, 10)).rejects.toMatchObject({ status: 409 });
      expect(activos.insertAsignacion).not.toHaveBeenCalled();
      expect(solicitudes.resolver).not.toHaveBeenCalled();
    });
  });

  describe('rechazar', () => {
    beforeEach(() => solicitudes.findById.mockResolvedValue(pendiente));

    test('guarda el motivo del rechazo', async () => {
      await service.rechazar(admin, 10, { motivo: ' No hay disponibilidad ' });
      expect(solicitudes.resolver).toHaveBeenCalledWith(10, { estado: 'rechazada', motivoResolucion: 'No hay disponibilidad', usuarioId: 1 }, 'client');
    });

    test('exige motivo y respeta el límite', async () => {
      await expect(service.rechazar(admin, 10, { motivo: '  ' })).rejects.toMatchObject({ status: 400, fields: { motivo: expect.any(String) } });
      await expect(service.rechazar(admin, 10, { motivo: 'x'.repeat(301) })).rejects.toMatchObject({ status: 400 });
      expect(solicitudes.resolver).not.toHaveBeenCalled();
    });

    test('falla si no existe o ya fue resuelta', async () => {
      solicitudes.findById.mockResolvedValue(null);
      await expect(service.rechazar(admin, 10, { motivo: 'x' })).rejects.toMatchObject({ status: 404 });
      solicitudes.findById.mockResolvedValue({ ...pendiente, estado: 'rechazada' });
      await expect(service.rechazar(admin, 10, { motivo: 'x' })).rejects.toMatchObject({ status: 409 });
    });
  });

  test('utilidades delegan en los modelos', async () => {
    solicitudes.countPendientes.mockResolvedValue(3);
    activos.listSolicitables.mockResolvedValue([libre]);
    await expect(service.countPendientes()).resolves.toBe(3);
    await expect(service.listActivosSolicitables()).resolves.toEqual([libre]);
  });
});
