// Pruebas HTTP que no necesitan base de datos (sesión en memoria, NODE_ENV=test).
const request = require('supertest');
const app = require('../../src/app');

function extractCsrf(html) {
  const m = html.match(/name="_csrf" value="([a-f0-9]+)"/);
  return m && m[1];
}

describe('app (HTTP)', () => {
  test('GET /health responde ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('rutas protegidas redirigen al login sin sesión', async () => {
    for (const url of ['/dashboard', '/personas', '/personas/nueva', '/usuarios']) {
      const res = await request(app).get(url);
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/login');
    }
  });

  test('el login muestra el formulario con token CSRF', async () => {
    const res = await request(app).get('/login');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Iniciar sesión');
    expect(extractCsrf(res.text)).toBeTruthy();
  });

  test('POST sin token CSRF es rechazado (403)', async () => {
    const res = await request(app).post('/login').type('form').send({ correo: 'a@b.com', password: 'x' });
    expect(res.status).toBe(403);
  });

  test('POST /logout sin token CSRF es rechazado', async () => {
    const res = await request(app).post('/logout');
    expect(res.status).toBe(403);
  });

  test('ruta inexistente responde 404 con página de error', async () => {
    const res = await request(app).get('/no-existe');
    expect(res.status).toBe(404);
    expect(res.text).toContain('404');
  });

  test('las cabeceras de seguridad están presentes', async () => {
    const res = await request(app).get('/login');
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  test('el login con campos vacíos muestra el mensaje genérico (sin BD)', async () => {
    const agent = request.agent(app);
    const page = await agent.get('/login');
    const res = await agent.post('/login').type('form').send({ _csrf: extractCsrf(page.text), correo: '', password: '' });
    expect(res.status).toBe(400);
    expect(res.text).toContain('Credenciales incorrectas.');
  });
});
