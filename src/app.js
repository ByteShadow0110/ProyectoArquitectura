const express = require('express');
const path = require('path');
const helmet = require('helmet');
const session = require('express-session');
const env = require('./config/env');
const csrf = require('./middlewares/csrf.middleware');
const flash = require('./middlewares/flash.middleware');
const { notFound, errorHandler } = require('./middlewares/error.middleware');

function buildSessionStore() {
  if (env.isTest) return undefined; // MemoryStore en pruebas
  const PgStore = require('connect-pg-simple')(session);
  return new PgStore({ pool: require('./config/db').pool, createTableIfMissing: true });
}

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
if (env.isProd) app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: { ...helmet.contentSecurityPolicy.getDefaultDirectives(), 'script-src': ["'self'"], 'upgrade-insecure-requests': env.isProd ? [] : null },
  },
}));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  store: buildSessionStore(),
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: env.isProd, maxAge: 8 * 60 * 60 * 1000 },
}));
app.use(flash);
app.use(csrf);

// Variables disponibles en todas las vistas
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.path = req.path;
  // Ícono del sprite (views/partials/icons.ejs). Solo recibe nombres fijos del código, nunca datos del usuario.
  res.locals.icon = (name, size = '') => `<svg class="icon ${size}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  res.locals.fmtDate = (d) => {
    if (!d) return '—';
    const [y, m, day] = String(d).slice(0, 10).split('-');
    return `${day}/${m}/${y}`;
  };
  next();
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/', require('./routes/auth.routes'));
app.use('/', require('./routes/dashboard.routes'));
app.use('/usuarios', require('./routes/usuarios.routes'));
app.use('/personas', require('./routes/personas.routes'));
// Sprint 2+: activos, solicitudes · Sprint 3: reportes

app.use(notFound);
app.use(errorHandler);

module.exports = app;
