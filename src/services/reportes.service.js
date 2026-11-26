// Servicio de reportes e indicadores (HU-09, HU-10; RF-13, RF-14, RF-15).
// Arma los datos del dashboard y los reportes filtrables; exporta a CSV. Sin Express.
const model = require('../models/reportes.model');
const personas = require('../models/personas.model');
const AppError = require('../utils/AppError');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PAGE_LIMIT = 500;     // filas que se muestran en pantalla
const EXPORT_LIMIT = 10000; // filas máximas al exportar
const MOV_TIPOS = ['entrada', 'salida', 'asignacion', 'devolucion', 'ajuste'];
const ESTADO_LABEL = { disponible: 'Disponible', asignado: 'Asignado', mantenimiento: 'Mantenimiento', baja: 'Baja' };
const MOV_LABEL = { entrada: 'Entrada', salida: 'Salida', asignacion: 'Asignación', devolucion: 'Devolución', ajuste: 'Ajuste' };

const TIPOS = {
  'activos-estado': { label: 'Activos por estado', usaFechas: false },
  asignaciones: { label: 'Asignaciones por persona', usaFechas: true },
  movimientos: { label: 'Movimientos por fecha', usaFechas: true },
  'stock-bajo': { label: 'Stock bajo', usaFechas: false },
};

const canReport = (user) => user.rol === 'admin' || user.rol === 'supervisor';
function assertCanReport(user) {
  if (!canReport(user)) throw AppError.forbidden();
}

function isValidDate(value) {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function fmtDate(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// Neutraliza fórmulas ("=", "+", "-", "@") para que Excel no las ejecute, y escapa comillas/comas/saltos.
function csvCell(value) {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function parseFilters(user, query = {}) {
  const tipo = TIPOS[query.tipo] ? query.tipo : 'activos-estado';
  const errors = {};
  const desde = String(query.desde || '').trim();
  const hasta = String(query.hasta || '').trim();
  if (desde && !isValidDate(desde)) errors.desde = 'Fecha no válida.';
  if (hasta && !isValidDate(hasta)) errors.hasta = 'Fecha no válida.';
  if (!errors.desde && !errors.hasta && desde && hasta && desde > hasta) errors.hasta = 'La fecha final no puede ser anterior a la inicial.';
  if (Object.keys(errors).length) throw AppError.validation(errors, 'Revisa las fechas del reporte.');
  const persona = Number(query.persona) || null;
  const movTipo = MOV_TIPOS.includes(query.mov) ? query.mov : '';
  return { tipo, desde, hasta, persona, mov: movTipo };
}

async function build(user, filters, limit) {
  const { tipo, desde, hasta, persona, mov } = filters;
  const base = { tipo, label: TIPOS[tipo].label, filters };

  if (tipo === 'activos-estado') {
    const data = await model.activosPorEstado();
    const total = data.reduce((s, r) => s + r.cantidad, 0);
    const rows = data.map((r) => ({
      estado: ESTADO_LABEL[r.estado] || r.estado,
      cantidad: r.cantidad,
      porcentaje: total ? Math.round((r.cantidad / total) * 1000) / 10 : 0,
    }));
    return { ...base, bar: true, total, rows, columns: [
      { key: 'estado', label: 'Estado' }, { key: 'cantidad', label: 'Cantidad' }, { key: 'porcentaje', label: 'Porcentaje (%)' }] };
  }

  if (tipo === 'asignaciones') {
    const data = await model.asignaciones({
      personaId: persona, areaId: user.rol === 'supervisor' ? (user.areaId || -1) : null,
      desde: desde || null, hasta: hasta || null,
    }, limit);
    const rows = data.map((r) => ({
      persona: r.persona, area: r.area || '', codigo: r.codigo, activo: r.activo,
      asignado: fmtDate(r.fecha_asignacion), devuelto: r.fecha_devolucion ? fmtDate(r.fecha_devolucion) : 'Vigente',
    }));
    return { ...base, total: rows.length, rows, columns: [
      { key: 'persona', label: 'Persona' }, { key: 'area', label: 'Área' }, { key: 'codigo', label: 'Código' },
      { key: 'activo', label: 'Activo' }, { key: 'asignado', label: 'Asignado' }, { key: 'devuelto', label: 'Devuelto' }] };
  }

  if (tipo === 'movimientos') {
    const data = await model.movimientos({ tipo: mov || null, desde: desde || null, hasta: hasta || null }, limit);
    const rows = data.map((r) => ({
      fecha: fmtDate(r.creado_en), codigo: r.codigo, activo: r.activo, tipo: MOV_LABEL[r.tipo] || r.tipo,
      cantidad: r.cantidad, usuario: r.usuario || '', nota: r.nota || '',
    }));
    return { ...base, total: rows.length, rows, columns: [
      { key: 'fecha', label: 'Fecha' }, { key: 'codigo', label: 'Código' }, { key: 'activo', label: 'Activo' },
      { key: 'tipo', label: 'Tipo' }, { key: 'cantidad', label: 'Cant.' }, { key: 'usuario', label: 'Usuario' }, { key: 'nota', label: 'Nota' }] };
  }

  const data = await model.stockBajo();
  const rows = data.map((r) => ({ codigo: r.codigo, nombre: r.nombre, stock: r.stock, minimo: r.stock_minimo }));
  return { ...base, total: rows.length, rows, columns: [
    { key: 'codigo', label: 'SKU' }, { key: 'nombre', label: 'Refacción' }, { key: 'stock', label: 'Stock' }, { key: 'minimo', label: 'Mínimo' }] };
}

module.exports = {
  TIPOS, MOV_TIPOS, MOV_LABEL, PAGE_LIMIT, EXPORT_LIMIT,
  canReport, csvCell, isValidDate,

  // Indicadores del dashboard (RF-13). El operativo ve una versión básica y solo lo suyo.
  async dashboard(user) {
    if (canReport(user)) {
      const [stockTotal, stockBajo, asignados, pendientes, bajos, recientes] = await Promise.all([
        model.totalStockRefacciones(), model.stockBajo().then((r) => r.length), model.countAsignados(),
        model.countSolicitudesPendientes(), model.stockBajo(5), model.solicitudesRecientes(5),
      ]);
      return { basico: false, kpis: { stockTotal, stockBajo, asignados, pendientes }, bajos, recientes };
    }
    const personaId = user.personaId || -1;
    const [disponibles, misAsignados, misPendientes, recientes] = await Promise.all([
      model.countDisponibles(), model.countAsignadosA(personaId),
      model.countSolicitudesPendientes(personaId), model.solicitudesRecientes(5, personaId),
    ]);
    return { basico: true, kpis: { disponibles, misAsignados, misPendientes }, bajos: [], recientes };
  },

  async personasOpciones(user) {
    const todas = await personas.listSimple();
    return user.rol === 'supervisor' ? todas.filter((p) => p.area_id === user.areaId) : todas;
  },

  async run(user, query) {
    assertCanReport(user);
    const filters = parseFilters(user, query);
    // El supervisor solo puede filtrar por personas de su área (RN-04).
    if (filters.persona && user.rol === 'supervisor') {
      const permitidas = await this.personasOpciones(user);
      if (!permitidas.some((p) => p.id === filters.persona)) filters.persona = -1;
    }
    const report = await build(user, filters, PAGE_LIMIT);
    return { ...report, truncated: report.rows.length >= PAGE_LIMIT && report.tipo !== 'activos-estado' };
  },

  async exportCsv(user, query) {
    assertCanReport(user);
    const filters = parseFilters(user, query);
    if (filters.persona && user.rol === 'supervisor') {
      const permitidas = await this.personasOpciones(user);
      if (!permitidas.some((p) => p.id === filters.persona)) filters.persona = -1;
    }
    const report = await build(user, filters, EXPORT_LIMIT);
    const lines = [report.columns.map((c) => csvCell(c.label)).join(',')];
    report.rows.forEach((r) => lines.push(report.columns.map((c) => csvCell(r[c.key])).join(',')));
    const stamp = new Date().toISOString().slice(0, 10);
    // BOM para que Excel abra bien los acentos
    return { filename: `reporte-${report.tipo}-${stamp}.csv`, content: `﻿${lines.join('\r\n')}\r\n` };
  },
};
