const requireRole = require('../../src/middlewares/role.middleware');

const run = (mw, session) => {
  const next = jest.fn();
  mw({ session }, {}, next);
  return next.mock.calls[0][0];
};

describe('role.middleware', () => {
  const mw = requireRole('admin', 'supervisor');

  test('deja pasar a un rol permitido', () => {
    expect(run(mw, { user: { rol: 'supervisor' } })).toBeUndefined();
  });

  test('rechaza con 403 a un rol no permitido', () => {
    expect(run(mw, { user: { rol: 'operativo' } })).toMatchObject({ status: 403 });
  });

  test('rechaza con 401 sin sesión', () => {
    expect(run(mw, {})).toMatchObject({ status: 401 });
    expect(run(mw, undefined)).toMatchObject({ status: 401 });
  });
});
