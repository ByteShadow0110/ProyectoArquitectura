-- RefaccionesMX · esquema borrador (PostgreSQL) · Sprint 0
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(30) UNIQUE NOT NULL            -- admin, supervisor, operativo
);

CREATE TABLE areas (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(60) UNIQUE NOT NULL            -- Ventas, Taller, Almacén, Administración
);

CREATE TABLE personas (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  apellidos VARCHAR(100) NOT NULL,
  correo VARCHAR(120) UNIQUE,
  telefono VARCHAR(20),
  puesto VARCHAR(60),
  area_id INT REFERENCES areas(id),
  fecha_ingreso DATE NOT NULL DEFAULT CURRENT_DATE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE usuarios (
  id SERIAL PRIMARY KEY,
  persona_id INT UNIQUE REFERENCES personas(id),
  correo VARCHAR(120) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  rol_id INT NOT NULL REFERENCES roles(id),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE categorias (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(60) UNIQUE NOT NULL,           -- Pantallas, Baterías, Herramienta, Equipo...
  tipo VARCHAR(15) NOT NULL CHECK (tipo IN ('refaccion','herramienta','equipo'))
);

CREATE TABLE activos (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(40) UNIQUE NOT NULL,           -- SKU o etiqueta
  nombre VARCHAR(120) NOT NULL,
  categoria_id INT NOT NULL REFERENCES categorias(id),
  estado VARCHAR(15) NOT NULL DEFAULT 'disponible'
    CHECK (estado IN ('disponible','asignado','mantenimiento','baja')),
  stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),          -- solo refacciones
  stock_minimo INT NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
  modelos_compatibles TEXT,                      -- ej. "iPhone 11, Galaxy A32"
  costo NUMERIC(10,2),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE solicitudes (
  id SERIAL PRIMARY KEY,
  activo_id INT NOT NULL REFERENCES activos(id),
  solicitante_id INT NOT NULL REFERENCES personas(id),
  estado VARCHAR(12) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','aprobada','rechazada')),
  motivo TEXT,
  resuelta_por INT REFERENCES usuarios(id),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  resuelta_en TIMESTAMPTZ
);

CREATE TABLE asignaciones (
  id SERIAL PRIMARY KEY,
  activo_id INT NOT NULL REFERENCES activos(id),
  persona_id INT NOT NULL REFERENCES personas(id),
  solicitud_id INT REFERENCES solicitudes(id),
  fecha_asignacion TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_devolucion TIMESTAMPTZ,
  asignado_por INT REFERENCES usuarios(id)
);

CREATE TABLE movimientos (
  id SERIAL PRIMARY KEY,
  activo_id INT NOT NULL REFERENCES activos(id),
  tipo VARCHAR(15) NOT NULL CHECK (tipo IN ('entrada','salida','asignacion','devolucion','ajuste')),
  cantidad INT NOT NULL DEFAULT 1,
  usuario_id INT REFERENCES usuarios(id),
  nota TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_personas_area ON personas(area_id);
CREATE INDEX idx_activos_estado ON activos(estado);
CREATE INDEX idx_activos_nombre ON activos(lower(nombre));
CREATE INDEX idx_asignaciones_persona ON asignaciones(persona_id) WHERE fecha_devolucion IS NULL;
