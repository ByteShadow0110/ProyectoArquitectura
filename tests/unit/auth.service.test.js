const bcrypt = require('bcryptjs');

jest.mock('../../src/models/usuarios.model');
const usuarios = require('../../src/models/usuarios.model');
const authService = require('../../src/services/auth.service');

const HASH = bcrypt.hashSync('Secreta123', 4);
const baseUser = { id: 1, correo: 'a@b.com', password_hash: HASH, activo: true, rol: 'admin', persona_id: 7, persona_nombre: 'Ana Torres', area_id: 2 };

describe('auth.service.authenticate', () => {
  beforeEach(() => jest.resetAllMocks());

  test('credenciales válidas devuelven el usuario de sesión', async () => {
    usuarios.findByCorreo.mockResolvedValue(baseUser);
    const u = await authService.authenticate('a@b.com', 'Secreta123');
    expect(u).toEqual({ id: 1, correo: 'a@b.com', rol: 'admin', nombre: 'Ana Torres', personaId: 7, areaId: 2 });
  });

  test('contraseña incorrecta: mensaje genérico 401', async () => {
    usuarios.findByCorreo.mockResolvedValue(baseUser);
    await expect(authService.authenticate('a@b.com', 'otra')).rejects.toMatchObject({ status: 401, message: 'Credenciales incorrectas.' });
  });

  test('correo inexistente: mismo mensaje que contraseña incorrecta', async () => {
    usuarios.findByCorreo.mockResolvedValue(null);
    await expect(authService.authenticate('x@y.com', 'Secreta123')).rejects.toMatchObject({ status: 401, message: 'Credenciales incorrectas.' });
  });

  test('usuario desactivado no puede entrar aunque la contraseña sea correcta', async () => {
    usuarios.findByCorreo.mockResolvedValue({ ...baseUser, activo: false });
    await expect(authService.authenticate('a@b.com', 'Secreta123')).rejects.toMatchObject({ status: 401 });
  });

  test('campos vacíos no consultan la base de datos', async () => {
    await expect(authService.authenticate('', '')).rejects.toMatchObject({ status: 400 });
    expect(usuarios.findByCorreo).not.toHaveBeenCalled();
  });
});
