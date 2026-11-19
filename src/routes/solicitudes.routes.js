// Solicitudes: cualquier rol solicita y consulta las suyas; solo admin y supervisor aprueban/rechazan.
const router = require('express').Router();
const controller = require('../controllers/solicitudes.controller');
const requireAuth = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');
const asyncHandler = require('../utils/asyncHandler');

const manage = requireRole('admin', 'supervisor');

router.use(requireAuth);

router.get('/', asyncHandler(controller.index));
router.get('/nueva', asyncHandler(controller.newForm));
router.post('/', asyncHandler(controller.create));
router.post('/:id/aprobar', manage, asyncHandler(controller.aprobar));
router.post('/:id/rechazar', manage, asyncHandler(controller.rechazar));

module.exports = router;
