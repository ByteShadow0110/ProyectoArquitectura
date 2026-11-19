// Servicio de activos (HU-05, HU-06; RF-08…RF-12). Reglas: validación, código único, baja lógica,
// stock de refacciones, asignación/devolución y bitácora. Sin Express: recibe usuario y datos.
const activos = require('../models/activos.model');
const personas = require('../models/personas.model');
const AppError = require('../utils/AppError');

const PAGE_SIZE = 20;
const TIPOS = ['refaccion', 'herramienta', 'equipo'];
const ESTADOS = ['disponible', 'asignado', 'mantenimiento', 'baja'];
const ESTADOS_EDITABLES = ['disponible', 'mantenimiento'];
const MOVIMIENTOS_STOCK = ['entrada', 'salida', 'ajuste'];

const canManage = (user) => user.rol === 'admin' || user.rol === 'supervisor';
function assertCanManage(user) {
  if (!canManage(user)) throw AppError.forbidden();
}

const isInt = (v) => /^\d+$/.test(String(v).trim());

function clean(input = {}) {
  const t = (v) => String(v == null ? '' : v).trim();
  return {
    codigo: t(input.codigo).toUpperCase(),
    nombre: t(input.nombre),
    categoriaId: input.categoria_id ? Number(input.categoria_id) : null,
    estado: t(input.estado),
    stock: t(input.stock),
    stockMinimo: t(input.stock_minimo),
    modelosCompatibles: t(input.modelos_compatibles) || null,
    costo: t(input.costo),
  };
}

// Valida y devuelve los datos normalizados listos para el modelo.
async function validate(raw, { id = null, current = null } = {}) {
  const errors = {};
  if (!raw.codigo) errors.codigo = 'El código (SKU) es obligatorio.';
  else if (raw.codigo.length > 40) errors.codigo = 'Máximo 40 caracteres.';
  else {
    const dup = await activos.findByCodigo(raw.codigo);
    if (dup && dup.id !== id) errors.codigo = 'Ya existe un activo con ese código.';
  }
  if (!raw.nombre) errors.nombre = 'El nombre es obligatorio.';
  else if (raw.nombre.length > 120) errors.nombre = 'Máximo 120 caracteres.';

  let categoria = null;
  if (!raw.categoriaId) errors.categoria_id = 'Selecciona una categoría.';
  else {
    const cats = await activos.listCategorias();
    categoria = cats.find((c) => c.id === raw.categoriaId) || null;
    if (!categoria) errors.categoria_id = 'La categoría seleccionada no existe.';
  }
  const esRefaccion = !!categoria && categoria.tipo === 'refaccion';

  let stock = 0;
  let stockMinimo = 0;
  if (esRefaccion) {
    if (!id) { // el stock inicial solo se captura al crear; después se mueve con entradas/salidas
      if (raw.stock !== '' && !isInt(raw.stock)) errors.stock = 'El stock debe ser un entero mayor o igual a 0.';
      else stock = raw.stock === '' ? 0 : Number(raw.stock);
    }
    if (raw.stockMinimo !== '' && !isInt(raw.stockMinimo)) errors.stock_minimo = 'El stock mínimo debe ser un entero mayor o igual a 0.';
    else stockMinimo = raw.stockMinimo === '' ? 0 : Number(raw.stockMinimo);
    if (raw.modelosCompatibles && raw.modelosCompatibles.length > 500) errors.modelos_compatibles = 'Máximo 500 caracteres.';
  }

  let costo = null;
  if (raw.costo !== '') {
    if (!/^\d{1,8}(\.\d{1,2})?$/.test(raw.costo)) errors.costo = 'Costo no válido (ej. 850.00).';
    else costo = Number(raw.costo);
  }

  let estado = current ? current.estado : 'disponible';
  if (current && ESTADOS_EDITABLES.includes(current.estado) && raw.estado) {
    if (!ESTADOS_EDITABLES.includes(raw.estado)) errors.estado = 'Estado no válido.';
    else estado = raw.estado;
  }

  if (Object.keys(errors).length) throw AppError.validation(errors);
  return {
    codigo: raw.codigo, nombre: raw.nombre, categoriaId: raw.categoriaId, estado,
    stock, stockMinimo, costo,
    modelosCompatibles: esRefaccion ? raw.modelosCompatibles : null,
    tipo: categoria.tipo,
  };
}

module.exports = {
  PAGE_SIZE, TIPOS, ESTADOS, MOVIMIENTOS_STOCK,
  clean,
  canManage,
  listCategorias: () => activos.listCategorias(),
  countActivos: () => activos.countActivos(),
  countStockBajo: () => activos.countStockBajo(),

  async list(user, query = {}) {
    const q = String(query.q || '').trim().slice(0, 80);
    const tipo = TIPOS.includes(query.tipo) ? query.tipo : '';
    const estado = ESTADOS.includes(query.estado) ? query.estado : '';
    const vigencia = ['activos', 'inactivos', 'todos'].includes(query.vigencia) ? query.vigencia : 'activos';
    const page = Math.max(1, Number(query.page) || 1);

    const filters = { q, tipo, estado, vigencia };
    const [total, rows] = await Promise.all([
      activos.count(filters),
      activos.list(filters, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    ]);
    return { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), filters };
  },

  async get(id) {
    const activo = await activos.findById(id);
    if (!activo) throw AppError.notFound('Activo no encontrado.');
    return activo;
  },

  // Detalle con bitácora (RF-12), asignación vigente y personas elegibles para asignar.
  async getDetalle(user, id) {
    const activo = await this.get(id);
    const [movimientos, asignacion] = await Promise.all([
      activos.listMovimientos(id),
      activos.findAsignacionVigente(id),
    ]);
    let personasOpciones = [];
    if (canManage(user) && activo.activo && activo.tipo !== 'refaccion' && activo.estado === 'disponible') {
      personasOpciones = await this.listPersonasAsignables(user);
    }
    return { activo, movimientos, asignacion, personasOpciones };
  },

  // Personas activas a las que el usuario puede asignar (el supervisor solo su área, RN-04).
  async listPersonasAsignables(user) {
    const todas = await personas.listSimple();
    return user.rol === 'supervisor' ? todas.filter((p) => p.area_id === user.areaId) : todas;
  },

  async create(user, input) {
    assertCanManage(user);
    const data = await validate(clean(input));
    return activos.transaction(async (client) => {
      const id = await activos.create(data, client);
      if (data.stock > 0) {
        await activos.insertMovimiento({ activoId: id, tipo: 'entrada', cantidad: data.stock, usuarioId: user.id, nota: 'Stock inicial' }, client);
      }
      return id;
    });
  },

  async update(user, id, input) {
    assertCanManage(user);
    const current = await this.get(id);
    const data = await validate(clean(input), { id: current.id, current });
    await activos.update(id, data);
  },

  // Baja/alta lógica (RN-02): nunca se borra el registro. Un activo asignado debe devolverse antes.
  async toggleActivo(user, id) {
    assertCanManage(user);
    const current = await this.get(id);
    if (current.activo && current.estado === 'asignado') {
      throw AppError.conflict('No se puede dar de baja: el activo está asignado. Regístralo como devuelto primero.');
    }
    await activos.setActivo(id, !current.activo);
    return !current.activo;
  },

  // Asignar un activo individual a una persona (HU-06): solo disponibles; queda en bitácora.
  async asignar(user, id, input = {}) {
    assertCanManage(user);
    const personaId = Number(input.persona_id);
    if (!personaId) throw AppError.validation({ persona_id: 'Selecciona una persona.' }, 'Selecciona una persona.');
    const persona = await personas.findById(personaId);
    if (!persona || !persona.activo) throw AppError.validation({ persona_id: 'La persona no existe o está inactiva.' }, 'La persona no existe o está inactiva.');
    if (user.rol === 'supervisor' && persona.area_id !== user.areaId) throw AppError.forbidden('Solo puedes asignar a personas de tu área.');
    const nota = String(input.nota || '').trim().slice(0, 300) || null;

    await activos.transaction(async (client) => {
      const activo = await activos.findById(id, client, true);
      if (!activo) throw AppError.notFound('Activo no encontrado.');
      if (!activo.activo) throw AppError.conflict('El activo está dado de baja.');
      if (activo.tipo === 'refaccion') throw AppError.conflict('Las refacciones se controlan por stock, no por asignación.');
      if (activo.estado !== 'disponible') throw AppError.conflict(`El activo no está disponible (estado: ${activo.estado}).`);
      await activos.insertAsignacion({ activoId: id, personaId, asignadoPor: user.id }, client);
      await activos.setEstado(id, 'asignado', client);
      await activos.insertMovimiento({ activoId: id, tipo: 'asignacion', usuarioId: user.id, nota: nota || `Asignado a ${persona.nombre} ${persona.apellidos}` }, client);
    });
  },

  async devolver(user, id, input = {}) {
    assertCanManage(user);
    const nota = String(input.nota || '').trim().slice(0, 300) || null;
    await activos.transaction(async (client) => {
      const activo = await activos.findById(id, client, true);
      if (!activo) throw AppError.notFound('Activo no encontrado.');
      const vigente = await activos.findAsignacionVigente(id, client);
      if (!vigente) throw AppError.conflict('El activo no tiene una asignación vigente.');
      if (user.rol === 'supervisor' && vigente.area_id !== user.areaId) throw AppError.forbidden('El activo está asignado a una persona de otra área.');
      await activos.cerrarAsignacion(vigente.id, client);
      await activos.setEstado(id, 'disponible', client);
      await activos.insertMovimiento({ activoId: id, tipo: 'devolucion', usuarioId: user.id, nota: nota || `Devuelto por ${vigente.nombre} ${vigente.apellidos}` }, client);
    });
  },

  // Entradas, salidas y ajustes de stock de refacciones (RF-09, RF-12). El stock nunca queda negativo.
  async moverStock(user, id, input = {}) {
    assertCanManage(user);
    const tipo = String(input.tipo || '');
    const errors = {};
    if (!MOVIMIENTOS_STOCK.includes(tipo)) errors.tipo = 'Selecciona el tipo de movimiento.';
    const rawCant = String(input.cantidad == null ? '' : input.cantidad).trim();
    if (!isInt(rawCant)) errors.cantidad = 'La cantidad debe ser un entero mayor o igual a 0.';
    const cantidad = isInt(rawCant) ? Number(rawCant) : 0;
    if (tipo !== 'ajuste' && isInt(rawCant) && cantidad < 1) errors.cantidad = 'La cantidad debe ser al menos 1.';
    const nota = String(input.nota || '').trim().slice(0, 300) || null;
    if (tipo === 'ajuste' && !nota) errors.nota = 'Explica el motivo del ajuste.';
    if (Object.keys(errors).length) throw AppError.validation(errors);

    await activos.transaction(async (client) => {
      const activo = await activos.findById(id, client, true);
      if (!activo) throw AppError.notFound('Activo no encontrado.');
      if (!activo.activo) throw AppError.conflict('El activo está dado de baja.');
      if (activo.tipo !== 'refaccion') throw AppError.conflict('Solo las refacciones manejan stock.');
      let nuevo;
      if (tipo === 'entrada') nuevo = activo.stock + cantidad;
      else if (tipo === 'salida') nuevo = activo.stock - cantidad;
      else nuevo = cantidad; // ajuste: la cantidad es el nuevo stock total
      if (nuevo < 0) throw AppError.conflict(`Stock insuficiente: hay ${activo.stock} y se piden ${cantidad}.`);
      await activos.setStock(id, nuevo, client);
      await activos.insertMovimiento({ activoId: id, tipo, cantidad, usuarioId: user.id, nota }, client);
    });
  },
};
