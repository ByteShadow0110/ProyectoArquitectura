const express = require('express');
const session = require('express-session');
const path = require('path');
const env = require('./config/env');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  },
}));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/activos', require('./routes/activos.routes'));
app.use('/asignaciones', require('./routes/asignaciones.routes'));
app.use('/solicitudes', require('./routes/solicitudes.routes'));
app.use(require('./middlewares/error.middleware'));

module.exports = app;
