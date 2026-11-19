// Activos: todos los roles consultan; solo admin y supervisor crean/editan/asignan/mueven stock.
const router = require('express').Router();
const controller = require('../controllers/activos.controller');
const requireAuth = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');
const asyncHandler = require('../utils/asyncHandler');

const manage = requireRole('admin', 'supervisor');

router.use(requireAuth);

router.get('/', asyncHandler(controller.index));
router.get('/nuevo', manage, asyncHandler(controller.newForm)); // antes de /:id
router.post('/', manage, asyncHandler(controller.create));
router.get('/:id', asyncHandler(controller.show));
router.get('/:id/editar', manage, asyncHandler(controller.editForm));
router.post('/:id', manage, asyncHandler(controller.update));
router.post('/:id/baja', manage, asyncHandler(controller.toggle));
router.post('/:id/asignar', manage, asyncHandler(controller.asignar));
router.post('/:id/devolver', manage, asyncHandler(controller.devolver));
router.post('/:id/movimiento', manage, asyncHandler(controller.movimiento));

module.exports = router;
