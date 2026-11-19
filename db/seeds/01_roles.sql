INSERT INTO roles (nombre) VALUES
  ('admin'),
  ('supervisor'),
  ('operativo')
ON CONFLICT (nombre) DO NOTHING;
