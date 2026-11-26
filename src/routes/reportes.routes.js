// Reportes: solo admin y supervisor (matriz rol × permiso).
const router = require('express').Router();
const controller = require('../controllers/reportes.controller');
const requireAuth = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');
const asyncHandler = require('../utils/asyncHandler');

router.use(requireAuth, requireRole('admin', 'supervisor'));

router.get('/', asyncHandler(controller.index));
router.get('/csv', asyncHandler(controller.csv));

module.exports = router;
