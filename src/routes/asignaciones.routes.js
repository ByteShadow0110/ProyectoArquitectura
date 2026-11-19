const router = require('express').Router();
const controller = require('../controllers/asignaciones.controller');
const requireAuth = require('../middlewares/auth.middleware');
const allowRoles = require('../middlewares/role.middleware');
const asyncHandler = require('../middlewares/async-handler');

router.use(requireAuth);
router.get('/', asyncHandler(controller.index));
router.get('/nueva', allowRoles('admin', 'supervisor'), asyncHandler(controller.new));
router.post('/', allowRoles('admin', 'supervisor'), asyncHandler(controller.create));
router.post('/:id/devolver', allowRoles('admin', 'supervisor'), asyncHandler(controller.returnAsset));

module.exports = router;
