// Reportes: lectura y exportación disponibles para administrador y supervisor.
const router = require('express').Router();
const controller = require('../controllers/reportes.controller');
const requireAuth = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');
const asyncHandler = require('../utils/asyncHandler');

router.use(requireAuth, requireRole('admin', 'supervisor'));

router.get('/', asyncHandler(controller.index));
router.get('/exportar.csv', asyncHandler(controller.exportCsv));
router.get('/imprimir', asyncHandler(controller.print));

module.exports = router;
