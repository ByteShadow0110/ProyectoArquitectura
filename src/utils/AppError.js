// Error de dominio: los servicios lo lanzan; controladores y middleware lo traducen a HTTP.
class AppError extends Error {
  constructor(message, status = 400, fields = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.fields = fields; // { campo: 'mensaje' } para formularios
  }

  static validation(fields, message = 'Revisa los datos del formulario.') {
    return new AppError(message, 400, fields);
  }
  static unauthorized(message = 'Debes iniciar sesión.') { return new AppError(message, 401); }
  static forbidden(message = 'No tienes permiso para esta acción.') { return new AppError(message, 403); }
  static notFound(message = 'Recurso no encontrado.') { return new AppError(message, 404); }
  static conflict(message, fields = {}) { return new AppError(message, 409, fields); }
}

module.exports = AppError;
