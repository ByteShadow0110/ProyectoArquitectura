// Usuarios y roles: solo administrador (matriz rol x permiso).
const router = require('express').Router();
const controller = require('../controllers/usuarios.controller');
const requireAuth = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');
const asyncHandler = require('../utils/asyncHandler');

router.use(requireAuth, requireRole('admin'));

router.get('/', asyncHandler(controller.index));
router.get('/nuevo', asyncHandler(controller.newForm));
router.post('/', asyncHandler(controller.create));
router.get('/:id/editar', asyncHandler(controller.editForm));
router.post('/:id', asyncHandler(controller.update));
router.post('/:id/estado', asyncHandler(controller.toggle));

module.exports = router;
