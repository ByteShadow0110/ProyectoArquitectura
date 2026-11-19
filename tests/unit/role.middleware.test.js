const allowRoles = require('../../src/middlewares/role.middleware');

describe('role.middleware', () => {
  test('deniega acciones de supervisión al rol operativo', () => {
    const req = { session: { user: { rol: 'operativo' } } };
    const next = jest.fn();

    allowRoles('admin', 'supervisor')(req, {}, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });

  test('permite acciones de supervisión al rol admin', () => {
    const req = { session: { user: { rol: 'admin' } } };
    const next = jest.fn();

    allowRoles('admin', 'supervisor')(req, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
