// Rutas del módulo "activos": solo mapean URL + middlewares -> controlador.
const router = require('express').Router();
const controller = require('../controllers/activos.controller');
const requireAuth = require('../middlewares/auth.middleware');
const allowRoles = require('../middlewares/role.middleware');
const asyncHandler = require('../middlewares/async-handler');

router.use(requireAuth);
router.get('/', asyncHandler(controller.index));
router.get('/nuevo', allowRoles('admin', 'supervisor'), asyncHandler(controller.new));
router.post('/', allowRoles('admin', 'supervisor'), asyncHandler(controller.create));
router.get('/:id/editar', allowRoles('admin', 'supervisor'), asyncHandler(controller.edit));
router.post('/:id', allowRoles('admin', 'supervisor'), asyncHandler(controller.update));
router.post('/:id/baja', allowRoles('admin', 'supervisor'), asyncHandler(controller.deactivate));
router.get('/:id', asyncHandler(controller.show));

module.exports = router;
