-- Datos iniciales de DESARROLLO (catálogos + usuarios de prueba).
-- Contraseña de los usuarios de prueba: ver README (sección "Credenciales de desarrollo").
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO roles (nombre) VALUES ('admin'), ('supervisor'), ('operativo');

INSERT INTO areas (nombre) VALUES ('Ventas'), ('Taller'), ('Almacén'), ('Administración');

INSERT INTO categorias (nombre, tipo) VALUES
  ('Pantallas', 'refaccion'),
  ('Baterías', 'refaccion'),
  ('Flex y conectores', 'refaccion'),
  ('Herramienta de taller', 'herramienta'),
  ('Equipo de cómputo', 'equipo');

INSERT INTO personas (nombre, apellidos, correo, telefono, puesto, area_id, fecha_ingreso, activo) VALUES
  ('Carlos', 'Méndez Ríos',  'admin@tienda.com',        '55 1000 0001', 'Gerente general',       (SELECT id FROM areas WHERE nombre='Administración'), '2023-01-10', TRUE),
  ('Ana',    'Torres Díaz',  'ana.torres@tienda.com',   '55 1234 5678', 'Encargada de taller',   (SELECT id FROM areas WHERE nombre='Taller'),         '2024-03-12', TRUE),
  ('Luis',   'Ramos Soto',   'luis.ramos@tienda.com',   '55 1000 0003', 'Técnico junior',        (SELECT id FROM areas WHERE nombre='Taller'),         '2025-02-03', TRUE),
  ('María',  'Pérez Luna',   'maria.perez@tienda.com',  '55 1000 0004', 'Vendedora',             (SELECT id FROM areas WHERE nombre='Ventas'),         '2024-08-19', TRUE),
  ('Pedro',  'Ruiz Vega',    'pedro.ruiz@tienda.com',   '55 1000 0005', 'Encargado de almacén',  (SELECT id FROM areas WHERE nombre='Almacén'),        '2023-11-06', TRUE),
  ('Sofía',  'León Mora',    'sofia.leon@tienda.com',   '55 1000 0006', 'Contadora',             (SELECT id FROM areas WHERE nombre='Administración'), '2022-05-23', FALSE);

INSERT INTO usuarios (persona_id, correo, password_hash, rol_id) VALUES
  ((SELECT id FROM personas WHERE correo='admin@tienda.com'),      'admin@tienda.com',      crypt('Refacciones2026!', gen_salt('bf', 10)), (SELECT id FROM roles WHERE nombre='admin')),
  ((SELECT id FROM personas WHERE correo='ana.torres@tienda.com'), 'ana.torres@tienda.com', crypt('Refacciones2026!', gen_salt('bf', 10)), (SELECT id FROM roles WHERE nombre='supervisor')),
  ((SELECT id FROM personas WHERE correo='luis.ramos@tienda.com'), 'luis.ramos@tienda.com', crypt('Refacciones2026!', gen_salt('bf', 10)), (SELECT id FROM roles WHERE nombre='operativo'));

-- Sprint 2: activos de ejemplo
INSERT INTO activos (codigo, nombre, categoria_id, estado, stock, stock_minimo, modelos_compatibles, costo) VALUES
  ('PAN-IP11', 'Pantalla iPhone 11',     (SELECT id FROM categorias WHERE nombre='Pantallas'),            'disponible', 2, 5, 'iPhone 11', 850.00),
  ('BAT-A32',  'Batería Galaxy A32',     (SELECT id FROM categorias WHERE nombre='Baterías'),             'disponible', 1, 4, 'Galaxy A32', 280.00),
  ('PAN-A54',  'Pantalla Galaxy A54',    (SELECT id FROM categorias WHERE nombre='Pantallas'),            'disponible', 12, 5, 'Galaxy A54', 1100.00),
  ('FLX-IP12', 'Flex de carga iPhone 12', (SELECT id FROM categorias WHERE nombre='Flex y conectores'),   'disponible', 9, 3, 'iPhone 12, iPhone 12 Pro', 190.00);
INSERT INTO activos (codigo, nombre, categoria_id, estado, costo) VALUES
  ('HER-014', 'Estación de calor',    (SELECT id FROM categorias WHERE nombre='Herramienta de taller'), 'asignado',      3200.00),
  ('HER-021', 'Microscopio',          (SELECT id FROM categorias WHERE nombre='Herramienta de taller'), 'mantenimiento', 5400.00),
  ('HER-030', 'Kit de destornilladores', (SELECT id FROM categorias WHERE nombre='Herramienta de taller'), 'disponible',  450.00),
  ('EQ-003',  'Laptop de taller',     (SELECT id FROM categorias WHERE nombre='Equipo de cómputo'),     'disponible',    12500.00);

-- Una asignación vigente (HER-014 -> Ana Torres) y su bitácora
INSERT INTO asignaciones (activo_id, persona_id, asignado_por) VALUES
  ((SELECT id FROM activos WHERE codigo='HER-014'), (SELECT id FROM personas WHERE correo='ana.torres@tienda.com'),
   (SELECT id FROM usuarios WHERE correo='ana.torres@tienda.com'));
INSERT INTO movimientos (activo_id, tipo, cantidad, usuario_id, nota) VALUES
  ((SELECT id FROM activos WHERE codigo='PAN-IP11'), 'entrada', 2, (SELECT id FROM usuarios WHERE correo='admin@tienda.com'), 'Stock inicial'),
  ((SELECT id FROM activos WHERE codigo='HER-014'), 'asignacion', 1, (SELECT id FROM usuarios WHERE correo='ana.torres@tienda.com'), 'Asignado a Ana Torres Díaz');

-- Solicitudes de ejemplo: pendiente, aprobada y rechazada
INSERT INTO solicitudes (activo_id, solicitante_id, estado, motivo, motivo_resolucion, resuelta_por, resuelta_en) VALUES
  ((SELECT id FROM activos WHERE codigo='HER-030'), (SELECT id FROM personas WHERE correo='luis.ramos@tienda.com'), 'pendiente',
   'Reparación de placa', NULL, NULL, NULL),
  ((SELECT id FROM activos WHERE codigo='HER-021'), (SELECT id FROM personas WHERE correo='pedro.ruiz@tienda.com'), 'rechazada',
   'Inventario', 'El microscopio está en mantenimiento', (SELECT id FROM usuarios WHERE correo='ana.torres@tienda.com'), now());
