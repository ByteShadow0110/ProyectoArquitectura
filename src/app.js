const express = require('express');
const path = require('path');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Montaje de rutas por módulo (Sprint 1+):
// app.use('/auth', require('./routes/auth.routes'));
// app.use('/usuarios', require('./routes/usuarios.routes'));
// app.use('/personas', require('./routes/personas.routes'));
// app.use('/activos', require('./routes/activos.routes'));
// app.use('/solicitudes', require('./routes/solicitudes.routes'));
// app.use('/reportes', require('./routes/reportes.routes'));

module.exports = app;
