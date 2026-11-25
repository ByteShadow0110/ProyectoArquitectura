// Controlador de reportes: traduce HTTP a vistas y formatos de descarga.
const service = require('../services/reportes.service');

async function renderReport(req, res, isPrint = false) {
  const data = await service.getReport(req.session.user, req.query);
  const params = new URLSearchParams({ tipo: data.filters.tipo });
  if (data.filters.desde) params.set('desde', data.filters.desde);
  if (data.filters.hasta) params.set('hasta', data.filters.hasta);
  if (data.filters.categoriaId) params.set('categoria_id', data.filters.categoriaId);
  if (data.filters.estado) params.set('estado', data.filters.estado);
  if (data.filters.personaId) params.set('persona_id', data.filters.personaId);
  if (data.filters.areaId) params.set('area_id', data.filters.areaId);
  const query = params.toString();
  return res.render('pages/reportes/index', {
    title: isPrint ? `Imprimir · ${data.report.label}` : 'Reportes',
    active: 'reportes',
    ...data,
    exportUrl: `/reportes/exportar.csv?${query}`,
    printUrl: `/reportes/imprimir?${query}`,
    isPrint,
  });
}

module.exports = {
  index: (req, res) => renderReport(req, res),
  print: (req, res) => renderReport(req, res, true),

  async exportCsv(req, res) {
    const data = await service.getReport(req.session.user, req.query);
    const filename = `refaccionesmx-${data.report.type}.csv`;
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    return res.send(service.toCsv(data.report));
  },
};
