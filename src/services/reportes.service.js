// Servicio de dashboard y reportes: normaliza filtros y aplica permisos.
const model = require('../models/reportes.model');
const AppError = require('../utils/AppError');

const REPORTS = {
  activos: {
    label: 'Activos por estado',
    columns: [
      ['estado', 'Estado'], ['cantidad', 'Cantidad'], ['porcentaje', 'Porcentaje'],
    ],
    states: ['disponible', 'asignado', 'mantenimiento', 'baja'],
  },
  asignaciones: {
    label: 'Asignaciones por persona',
    columns: [
      ['fecha_asignacion', 'Fecha de asignación'], ['fecha_devolucion', 'Fecha de devolución'],
      ['codigo', 'Código'], ['activo', 'Activo'], ['categoria', 'Categoría'],
      ['persona', 'Persona'], ['area', 'Área'], ['estado', 'Estado'],
    ],
    states: ['vigente', 'devuelta'],
  },
  movimientos: {
    label: 'Movimientos por fecha',
    columns: [
      ['creado_en', 'Fecha'], ['codigo', 'Código'], ['activo', 'Activo'],
      ['categoria', 'Categoría'], ['tipo', 'Movimiento'], ['cantidad', 'Cantidad'],
      ['usuario', 'Usuario'], ['area', 'Área'], ['nota', 'Nota'],
    ],
    states: ['entrada', 'salida', 'asignacion', 'devolucion', 'ajuste'],
  },
  stock_bajo: {
    label: 'Stock bajo',
    columns: [
      ['codigo', 'SKU'], ['nombre', 'Refacción'], ['categoria', 'Categoría'],
      ['stock', 'Stock'], ['stock_minimo', 'Mínimo'],
    ],
    states: [],
  },
};

const REPORT_ROLES = ['admin', 'supervisor'];
const DASHBOARD_ROLES = ['admin', 'supervisor', 'operativo'];
const ASSET_STATES = ['disponible', 'asignado', 'mantenimiento', 'baja'];
const MOVEMENT_STATES = ['entrada', 'salida', 'asignacion', 'devolucion', 'ajuste'];

function assertRole(user, roles) {
  if (!user || !roles.includes(user.rol)) throw AppError.forbidden();
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function optionalId(value, field, errors) {
  if (value === '' || value == null) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    errors[field] = 'Selecciona un valor válido.';
    return null;
  }
  return parsed;
}

function cleanFilters(query = {}) {
  const errors = {};
  const tipo = String(query.tipo || 'activos');
  if (!Object.prototype.hasOwnProperty.call(REPORTS, tipo)) errors.tipo = 'Selecciona un tipo de reporte válido.';
  const report = REPORTS[tipo] ? tipo : 'activos';
  const desde = String(query.desde || '').trim();
  const hasta = String(query.hasta || '').trim();
  if (desde && !validDate(desde)) errors.desde = 'Indica una fecha válida.';
  if (hasta && !validDate(hasta)) errors.hasta = 'Indica una fecha válida.';
  if (desde && hasta && validDate(desde) && validDate(hasta) && desde > hasta) {
    errors.hasta = 'La fecha final debe ser igual o posterior a la inicial.';
  }
  const categoriaId = optionalId(query.categoria_id, 'categoria_id', errors);
  const personaId = optionalId(query.persona_id, 'persona_id', errors);
  const areaId = optionalId(query.area_id, 'area_id', errors);
  const estado = String(query.estado || '');
  if (estado && !REPORTS[report].states.includes(estado)) errors.estado = 'El estado no corresponde a este reporte.';
  if (Object.keys(errors).length) throw AppError.validation(errors);
  return { tipo: report, desde, hasta, categoriaId, personaId, areaId, estado };
}

function csvCell(value) {
  if (value == null) return '';
  let text = String(value);
  if (/^\s*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

module.exports = {
  REPORTS,
  canReport: (user) => !!user && REPORT_ROLES.includes(user.rol),

  async getDashboard(user) {
    assertRole(user, DASHBOARD_ROLES);
    const [metrics, stockBajo, solicitudes, movimientos] = await Promise.all([
      model.getDashboardMetrics(),
      model.listStockBajo(),
      model.listSolicitudesRecientes(),
      model.listMovimientosRecientes(),
    ]);
    return {
      metrics: {
        disponibles: Number(metrics.disponibles) || 0,
        asignados: Number(metrics.asignados) || 0,
        unidadesStock: Number(metrics.unidades_stock) || 0,
        alertasStock: Number(metrics.alertas_stock) || 0,
        solicitudesPendientes: Number(metrics.solicitudes_pendientes) || 0,
      },
      stockBajo,
      solicitudes,
      movimientos,
      canReport: this.canReport(user),
    };
  },

  async getReport(user, query = {}) {
    assertRole(user, REPORT_ROLES);
    const filters = cleanFilters(query);
    const [categories, options, rows] = await Promise.all([
      model.listCategorias(),
      model.listPersonasYAreas(),
      model[{
        activos: 'listActivosPorEstado',
        asignaciones: 'listAsignaciones',
        movimientos: 'listMovimientos',
        stock_bajo: 'listStockBajoReporte',
      }[filters.tipo]](filters),
    ]);
    const report = REPORTS[filters.tipo];
    return {
      report: { type: filters.tipo, label: report.label, columns: report.columns, states: report.states, rows },
      filters,
      categories,
      personas: options.personas,
      areas: options.areas,
    };
  },

  toCsv(report) {
    const lines = [
      report.columns.map(([, label]) => csvCell(label)).join(','),
      ...report.rows.map((row) => report.columns.map(([key]) => csvCell(row[key])).join(',')),
    ];
    return `\uFEFF${lines.join('\r\n')}\r\n`;
  },
};
