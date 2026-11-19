// Servicio de solicitudes (HU-07, HU-08; RF-11). Crear solicitud, aprobar (crea la asignación) o rechazar con motivo.
const solicitudes = require('../models/solicitudes.model');
const activos = require('../models/activos.model');
const AppError = require('../utils/AppError');

const PAGE_SIZE = 20;
const ESTADOS = ['pendiente', 'aprobada', 'rechazada', 'todas'];

const canManage = (user) => user.rol === 'admin' || user.rol === 'supervisor';
function assertCanManage(user) {
  if (!canManage(user)) throw AppError.forbidden();
}

module.exports = {
  PAGE_SIZE, ESTADOS, canManage,
  countPendientes: () => solicitudes.countPendientes(),
  listActivosSolicitables: () => activos.listSolicitables(),

  // El operativo solo ve las suyas; admin y supervisor ven todas.
  async list(user, query = {}) {
    const estadoSel = ESTADOS.includes(query.estado) ? query.estado : 'pendiente';
    const page = Math.max(1, Number(query.page) || 1);
    const filters = {
      estado: estadoSel === 'todas' ? null : estadoSel,
      solicitanteId: canManage(user) ? null : (user.personaId || -1),
    };
    const [total, rows] = await Promise.all([
      solicitudes.count(filters),
      solicitudes.list(filters, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    ]);
    return { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), filters: { estado: estadoSel } };
  },

  async create(user, input = {}) {
    if (!user.personaId) {
      throw AppError.conflict('Tu usuario no está asociado a una persona; pide al administrador que lo vincule para solicitar activos.');
    }
    const errors = {};
    const activoId = Number(input.activo_id) || null;
    const motivo = String(input.motivo || '').trim();
    if (!activoId) errors.activo_id = 'Selecciona un activo.';
    if (!motivo) errors.motivo = 'Indica el motivo de la solicitud.';
    else if (motivo.length > 300) errors.motivo = 'Máximo 300 caracteres.';
    if (Object.keys(errors).length) throw AppError.validation(errors);

    const activo = await activos.findById(activoId);
    if (!activo || !activo.activo) throw AppError.validation({ activo_id: 'El activo no existe.' });
    if (activo.tipo === 'refaccion') throw AppError.validation({ activo_id: 'Las refacciones no se solicitan; se controlan por stock.' });
    if (activo.estado !== 'disponible') throw AppError.validation({ activo_id: 'El activo no está disponible.' });
    if (await solicitudes.findPendiente(activoId, user.personaId)) {
      throw AppError.validation({ activo_id: 'Ya tienes una solicitud pendiente para este activo.' });
    }
    return solicitudes.create({ activoId, solicitanteId: user.personaId, motivo });
  },

  // Aprobar = crear la asignación, pasar el activo a 'asignado' y registrar el movimiento (todo en una transacción).
  async aprobar(user, id) {
    assertCanManage(user);
    await solicitudes.transaction(async (client) => {
      const sol = await solicitudes.findById(id, client, true);
      if (!sol) throw AppError.notFound('Solicitud no encontrada.');
      if (sol.estado !== 'pendiente') throw AppError.conflict('La solicitud ya fue resuelta.');
      const activo = await activos.findById(sol.activo_id, client, true);
      if (!activo || !activo.activo || activo.estado !== 'disponible') {
        throw AppError.conflict('El activo ya no está disponible; rechaza la solicitud indicando el motivo.');
      }
      await activos.insertAsignacion({ activoId: sol.activo_id, personaId: sol.solicitante_id, solicitudId: sol.id, asignadoPor: user.id }, client);
      await activos.setEstado(sol.activo_id, 'asignado', client);
      await activos.insertMovimiento({ activoId: sol.activo_id, tipo: 'asignacion', usuarioId: user.id, nota: `Solicitud #${sol.id} aprobada (${sol.solicitante})` }, client);
      await solicitudes.resolver(id, { estado: 'aprobada', usuarioId: user.id }, client);
    });
  },

  async rechazar(user, id, input = {}) {
    assertCanManage(user);
    const motivo = String(input.motivo || '').trim();
    if (!motivo) throw AppError.validation({ motivo: 'El motivo del rechazo es obligatorio.' }, 'El motivo del rechazo es obligatorio.');
    if (motivo.length > 300) throw AppError.validation({ motivo: 'Máximo 300 caracteres.' }, 'El motivo admite máximo 300 caracteres.');
    await solicitudes.transaction(async (client) => {
      const sol = await solicitudes.findById(id, client, true);
      if (!sol) throw AppError.notFound('Solicitud no encontrada.');
      if (sol.estado !== 'pendiente') throw AppError.conflict('La solicitud ya fue resuelta.');
      await solicitudes.resolver(id, { estado: 'rechazada', motivoResolucion: motivo, usuarioId: user.id }, client);
    });
  },
};
