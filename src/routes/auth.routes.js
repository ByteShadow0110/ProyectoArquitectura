const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/auth.controller');
const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');

// RNF-02 / HU-01: bloqueo temporal tras varios intentos fallidos desde la misma IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  skip: () => env.isTest,
  handler: (req, res) => res.status(429).render('pages/auth/login', {
    title: 'Iniciar sesión',
    errorMessage: 'Demasiados intentos fallidos. Intenta de nuevo en 15 minutos.',
    correo: '',
  }),
});

router.get('/login', controller.showLogin);
router.post('/login', loginLimiter, asyncHandler(controller.login));
router.post('/logout', asyncHandler(controller.logout));

module.exports = router;
