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

  test('redirige al login y recuerda la ruta solicitada cuando no hay sesión', () => {
    const req = { session: {}, method: 'GET', originalUrl: '/activos' };
    const res = { redirect: jest.fn() };
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(req.session.returnTo).toBe('/activos');
    expect(res.redirect).toHaveBeenCalledWith('/login');
    expect(next).not.toHaveBeenCalled();
  });
});
