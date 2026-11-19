jest.mock('../../src/config/db');

const db = require('../../src/config/db');
const activos = require('../../src/models/activos.model');
const asignaciones = require('../../src/models/asignaciones.model');
const serviceSolicitudes = require('../../src/services/solicitudes.service');
const serviceActivos = require('../../src/services/activos.service');

const admin = { id: 1, rol: 'admin', personaId: 1 };
let client;

beforeEach(() => {
  jest.clearAllMocks();
  client = { query: jest.fn() };
  db.withTransaction.mockImplementation((fn) => fn(client));
  db.transaction.mockImplementation((fn) => fn(client));
});

describe('transacciones de los módulos', () => {
  test('alta de activo y movimiento inicial usan el mismo cliente transaccional', async () => {
    db.query.mockImplementation(async (sql) => {
      if (sql.includes('lower(codigo)')) return { rows: [] };
      if (sql.includes('FROM categorias')) return { rows: [{ id: 1, tipo: 'refaccion' }] };
      return { rows: [] };
    });
    client.query.mockImplementation(async (sql) => (
      sql.includes('INSERT INTO activos') ? { rows: [{ id: 5 }] } : { rows: [] }
    ));

    await serviceActivos.create(admin, {
      codigo: 'PAN-11', nombre: 'Pantalla', categoria_id: '1', stock: '3',
    });

    expect(db.withTransaction).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO activos'),
      ['PAN-11', 'Pantalla', 1, 3, 0, null, null]
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO movimientos'),
      [5, 'entrada', 3, 1, 'Stock inicial']
    );
  });

  test('aprobar solicitud crea asignación, actualiza activo y bitácora en una transacción', async () => {
    client.query.mockImplementation(async (sql) => {
      if (sql.includes('FROM solicitudes s')) {
        return { rows: [{ id: 12, activo_id: 8, solicitante_id: 2, solicitante: 'Ana Torres', estado: 'pendiente' }] };
      }
      if (sql.includes('FROM activos a')) {
        return { rows: [{ id: 8, estado: 'disponible', activo: true, tipo: 'herramienta' }] };
      }
      if (sql.includes('INSERT INTO asignaciones')) return { rows: [{ id: 20 }] };
      return { rows: [] };
    });

    await serviceSolicitudes.aprobar(admin, 12);

    expect(db.withTransaction).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO asignaciones'),
      [8, 2, 12, 1]
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE activos SET estado'),
      [8, 'asignado']
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO movimientos'),
      [8, 'asignacion', 1, 1, 'Solicitud #12 aprobada (Ana Torres)']
    );
  });

  test('rechazar solicitud persiste el motivo en una transacción', async () => {
    client.query.mockImplementation(async (sql) => (
      sql.includes('FROM solicitudes s')
        ? { rows: [{ id: 13, estado: 'pendiente' }] }
        : { rows: [] }
    ));

    await serviceSolicitudes.rechazar(admin, 13, { motivo: 'Sin disponibilidad' });

    expect(db.withTransaction).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('motivo_resolucion'),
      [13, 'rechazada', 'Sin disponibilidad', 1]
    );
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE activos SET estado'),
      expect.anything()
    );
  });

  test('devolución cierra asignación y registra el movimiento en la misma transacción', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [{ id: 10, activo_id: 8 }] })
      .mockResolvedValue({ rows: [] });

    await asignaciones.returnAsset(10, 1);

    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('SET fecha_devolucion = now()'),
      [10]
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("'devolucion'"),
      [8, 1]
    );
  });
});
