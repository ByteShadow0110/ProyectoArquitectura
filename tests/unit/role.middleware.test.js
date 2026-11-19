const allowRoles = require('../../src/middlewares/role.middleware');

describe('role.middleware', () => {
  test('deniega acciones de supervisión al rol operativo', () => {
    const req = { user: { rol: 'operativo' } };
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
    const next = jest.fn();

    allowRoles('admin', 'supervisor')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('permite acciones de supervisión al rol admin', () => {
    const req = { user: { rol: 'admin' } };
    const next = jest.fn();

    allowRoles('admin', 'supervisor')(req, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
