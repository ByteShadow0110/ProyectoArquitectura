jest.mock('../../src/models/usuarios.model');
jest.mock('../../src/models/personas.model');
const usuarios = require('../../src/models/usuarios.model');
const personas = require('../../src/models/personas.model');
const service = require('../../src/services/usuarios.service');

const ROLES = [{ id: 1, nombre: 'admin' }, { id: 2, nombre: 'supervisor' }, { id: 3, nombre: 'operativo' }];
const valid = { correo: 'nuevo@tienda.com', password: 'Segura1234', rol_id: '3', persona_id: '', activo: 'on' };

describe('usuarios.service', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    usuarios.listRoles.mockResolvedValue(ROLES);
    usuarios.findByCorreo.mockResolvedValue(null);
    usuarios.findByPersonaId.mockResolvedValue(null);
    usuarios.create.mockResolvedValue(10);
  });

  test('crea un usuario guardando la contraseña con hash', async () => {
    await service.create(valid);
    const arg = usuarios.create.mock.calls[0][0];
    expect(arg.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(arg.passwordHash).not.toContain('Segura1234');
    expect(arg).toMatchObject({ correo: 'nuevo@tienda.com', rolId: 3, personaId: null, activo: true });
  });

  test('rechaza correo duplicado', async () => {
    usuarios.findByCorreo.mockResolvedValue({ id: 99 });
    await expect(service.create(valid)).rejects.toMatchObject({ status: 400, fields: { correo: expect.stringContaining('Ya existe') } });
    expect(usuarios.create).not.toHaveBeenCalled();
  });

  test('rechaza contraseña de menos de 8 caracteres', async () => {
    await expect(service.create({ ...valid, password: 'corta' })).rejects.toMatchObject({ fields: { password: expect.any(String) } });
  });

  test('rechaza correo con formato inválido y rol inexistente', async () => {
    await expect(service.create({ ...valid, correo: 'no-es-correo', rol_id: '99' }))
      .rejects.toMatchObject({ fields: { correo: expect.any(String), rol_id: expect.any(String) } });
  });

  test('un supervisor exige persona con área', async () => {
    await expect(service.create({ ...valid, rol_id: '2' })).rejects.toMatchObject({ fields: { persona_id: expect.any(String) } });
    personas.findById.mockResolvedValue({ id: 5, area_id: null });
    await expect(service.create({ ...valid, rol_id: '2', persona_id: '5' })).rejects.toMatchObject({ fields: { persona_id: expect.any(String) } });
    personas.findById.mockResolvedValue({ id: 5, area_id: 2 });
    await expect(service.create({ ...valid, rol_id: '2', persona_id: '5' })).resolves.toBe(10);
  });

  test('una persona no puede tener dos usuarios', async () => {
    personas.findById.mockResolvedValue({ id: 5, area_id: 2 });
    usuarios.findByPersonaId.mockResolvedValue({ id: 77 });
    await expect(service.create({ ...valid, persona_id: '5' })).rejects.toMatchObject({ fields: { persona_id: expect.stringContaining('ya tiene') } });
  });

  test('un administrador no puede desactivar su propia cuenta', async () => {
    usuarios.findById.mockResolvedValue({ id: 1, activo: true, correo: 'admin@tienda.com' });
    await expect(service.toggleActivo(1, { id: 1 })).rejects.toMatchObject({ message: 'No puedes desactivar tu propia cuenta.' });
    await expect(service.update(1, { ...valid, activo: undefined }, { id: 1 })).rejects.toMatchObject({ message: 'No puedes desactivar tu propia cuenta.' });
  });

  test('toggleActivo invierte el estado de otro usuario', async () => {
    usuarios.findById.mockResolvedValue({ id: 2, activo: true });
    await expect(service.toggleActivo(2, { id: 1 })).resolves.toBe(false);
    expect(usuarios.setActivo).toHaveBeenCalledWith(2, false);
  });

  test('editar sin contraseña conserva la actual', async () => {
    usuarios.findById.mockResolvedValue({ id: 2, activo: true });
    await service.update(2, { ...valid, password: '' }, { id: 1 });
    expect(usuarios.update.mock.calls[0][1].passwordHash).toBeNull();
  });

  test('usuario inexistente responde 404', async () => {
    usuarios.findById.mockResolvedValue(null);
    await expect(service.get(404)).rejects.toMatchObject({ status: 404 });
  });
});
