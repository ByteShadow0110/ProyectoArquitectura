const requireAuth = require('../../src/middlewares/auth.middleware');

describe('auth.middleware', () => {
  test('copia el usuario de la sesión a req.user', () => {
    const user = { id: 1, persona_id: 1, rol: 'admin' };
    const req = { session: { user } };
    const next = jest.fn();

    requireAuth(req, {}, next);

    expect(req.user).toBe(user);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('rechaza solicitudes sin sesión de usuario', () => {
    const req = { session: {} };
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith('Inicia sesión para continuar.');
    expect(next).not.toHaveBeenCalled();
  });
});
