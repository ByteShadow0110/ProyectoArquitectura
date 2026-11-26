// Controlador de reportes: traduce HTTP <-> servicio. Sin reglas de negocio.
const service = require('../services/reportes.service');
const AppError = require('../utils/AppError');

module.exports = {
  async index(req, res) {
    const personas = await service.personasOpciones(req.session.user);
    let report = null;
    let errorMessage = null;
    let errors = {};
    try {
      report = await service.run(req.session.user, req.query);
    } catch (err) {
      if (!(err instanceof AppError) || err.status !== 400) throw err;
      errorMessage = err.message;
      errors = err.fields;
      report = await service.run(req.session.user, { tipo: req.query.tipo });
    }
    const qs = new URLSearchParams();
    ['tipo', 'desde', 'hasta', 'persona', 'mov'].forEach((k) => { if (!errorMessage && report.filters[k]) qs.set(k, report.filters[k]); });
    if (!qs.has('tipo')) qs.set('tipo', report.tipo);
    res.status(errorMessage ? 400 : 200).render('pages/reportes/index', {
      title: 'Reportes', active: 'reportes', report, personas, errors, errorMessage,
      tipos: service.TIPOS, movTipos: service.MOV_TIPOS, movLabel: service.MOV_LABEL, csvQuery: qs.toString(),
    });
  },

  async csv(req, res) {
    try {
      const { filename, content } = await service.exportCsv(req.session.user, req.query);
      res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"` });
      return res.send(content);
    } catch (err) {
      if (err instanceof AppError && err.status === 400) {
        req.flash('error', err.message);
        return res.redirect('/reportes');
      }
      throw err;
    }
  },
};
