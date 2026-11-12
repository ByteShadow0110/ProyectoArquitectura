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
