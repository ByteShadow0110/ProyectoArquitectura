// Servicio de autenticación (HU-01). Sin Express: recibe datos y devuelve el usuario de sesión.
const bcrypt = require('bcryptjs');
const usuarios = require('../models/usuarios.model');
const AppError = require('../utils/AppError');

const INVALID = 'Credenciales incorrectas.';
// Hash falso: se compara aunque el usuario no exista, para que el tiempo de respuesta no revele qué correos existen.
const DUMMY_HASH = '$2b$10$h4qfHvsNPaiPWLhKxWoQd.mDekZlDOwfzjldVh9mbuc/Wh0tOnP7a';

function toSessionUser(u) {
  return {
    id: u.id,
    correo: u.correo,
    rol: u.rol,
    nombre: u.persona_nombre || u.correo,
    personaId: u.persona_id,
    areaId: u.area_id,
  };
}

async function authenticate(correo, password) {
  const email = String(correo || '').trim();
  const pass = String(password || '');
  if (!email || !pass) throw AppError.validation({}, INVALID);

  const user = await usuarios.findByCorreo(email);
  const ok = await bcrypt.compare(pass, user ? user.password_hash : DUMMY_HASH);
  // Mismo mensaje para correo inexistente, contraseña errónea o usuario desactivado.
  if (!user || !ok || !user.activo) throw new AppError(INVALID, 401);
  return toSessionUser(user);
}

module.exports = { authenticate, toSessionUser };
