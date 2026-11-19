// Personas: todos los roles consultan; solo admin y supervisor crean/editan/dan de baja.
const router = require('express').Router();
const controller = require('../controllers/personas.controller');
const requireAuth = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');
const asyncHandler = require('../utils/asyncHandler');

const manage = requireRole('admin', 'supervisor');

router.use(requireAuth);

router.get('/', asyncHandler(controller.index));
router.get('/nueva', manage, asyncHandler(controller.newForm)); // antes de /:id
router.post('/', manage, asyncHandler(controller.create));
router.get('/:id', asyncHandler(controller.show));
router.get('/:id/editar', manage, asyncHandler(controller.editForm));
router.post('/:id', manage, asyncHandler(controller.update));
router.post('/:id/baja', manage, asyncHandler(controller.toggle));

module.exports = router;
