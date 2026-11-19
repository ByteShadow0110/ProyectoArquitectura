// Rutas del módulo "solicitudes": solo mapean URL + middlewares -> controlador.
const router = require('express').Router();
const controller = require('../controllers/solicitudes.controller');
const requireAuth = require('../middlewares/auth.middleware');
const allowRoles = require('../middlewares/role.middleware');
const asyncHandler = require('../middlewares/async-handler');

router.use(requireAuth);
router.get('/', asyncHandler(controller.index));
router.post('/', asyncHandler(controller.create));
router.post('/:id/resolver', allowRoles('admin', 'supervisor'), asyncHandler(controller.resolve));

module.exports = router;
