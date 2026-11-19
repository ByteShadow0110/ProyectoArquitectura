jest.mock('../../src/config/db');

const db = require('../../src/config/db');
const activos = require('../../src/models/activos.model');
const asignaciones = require('../../src/models/asignaciones.model');
const solicitudes = require('../../src/models/solicitudes.model');

let client;

beforeEach(() => {
  jest.clearAllMocks();
  client = { query: jest.fn() };
  db.transaction.mockImplementation(callback => callback(client));
});

describe('transacciones de los modelos', () => {
  test('actualiza stock y registra salida y auditoría en la misma transacción', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [{ estado: 'disponible', stock: 5, categoria_id: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 5 }] })
      .mockResolvedValue({ rows: [] });

    await activos.update(5, {
      codigo: 'PAN-11',
      nombre: 'Pantalla iPhone 11',
      categoria_id: 1,
      estado: 'disponible',
      stock: 3,
      stock_minimo: 1,
      modelos_compatibles: null,
      costo: null,
    }, 1);

    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('SET codigo = $2'),
      expect.arrayContaining([5, 'PAN-11', 'Pantalla iPhone 11'])
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("'Ajuste de stock'"),
      [5, 'salida', 2, 1]
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("'Datos del activo actualizados'"),
      [5, 1]
    );
  });

  test('aprobación crea asignación, cambia estado y bitácora dentro de la transacción', async () => {
    client.query.mockImplementation(async sql => {
      if (sql.includes('SELECT id, activo_id, solicitante_id, estado')) {
        return { rows: [{ id: 12, activo_id: 8, solicitante_id: 1, estado: 'pendiente' }] };
      }
      if (sql.includes('SELECT activo FROM personas')) return { rows: [{ activo: true }] };
      if (sql.includes('SELECT a.estado, a.activo, c.tipo')) {
        return { rows: [{ estado: 'disponible', activo: true, tipo: 'herramienta' }] };
      }
      if (sql.includes('UPDATE solicitudes')) return { rows: [{ id: 12, estado: 'aprobada' }] };
      return { rows: [] };
    });

    await solicitudes.resolve(12, 1, 'aprobada', null);

    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO asignaciones'),
      [12, 1]
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("SET estado = 'asignado'"),
      [8]
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("'asignacion'"),
      [8, 1, 'Asignación por solicitud #12']
    );
  });

  test('rechazo guarda el motivo sin sustituir el motivo de solicitud', async () => {
    client.query.mockImplementation(async sql => {
      if (sql.includes('SELECT id, activo_id, solicitante_id, estado')) {
        return { rows: [{ id: 13, activo_id: 8, solicitante_id: 1, estado: 'pendiente' }] };
      }
      if (sql.includes('UPDATE solicitudes')) return { rows: [{ id: 13, estado: 'rechazada' }] };
      return { rows: [] };
    });

    await solicitudes.resolve(13, 1, 'rechazada', 'Sin disponibilidad');

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('motivo_resolucion'),
      [13, 'rechazada', 'Sin disponibilidad', 1]
    );
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('SET estado = \'asignado\''),
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
