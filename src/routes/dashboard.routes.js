const router = require('express').Router();
const controller = require('../controllers/dashboard.controller');
const requireAuth = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');

router.get('/', (req, res) => res.redirect('/dashboard'));
router.get('/dashboard', requireAuth, asyncHandler(controller.index));

module.exports = router;
