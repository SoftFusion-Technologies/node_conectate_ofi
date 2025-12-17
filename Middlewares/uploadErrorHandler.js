import multer from 'multer';

export function uploadErrorHandler(err, req, res, next) {
  if (!err) return next();

  // Errores de Multer
  if (err instanceof multer.MulterError) {
    // LIMIT_FILE_SIZE, LIMIT_FILE_COUNT, LIMIT_UNEXPECTED_FILE, etc.
    const map = {
      LIMIT_FILE_SIZE: 'El archivo supera el tamaño máximo permitido.',
      LIMIT_FILE_COUNT: 'Se superó la cantidad máxima de archivos por subida.',
      LIMIT_UNEXPECTED_FILE: 'Campo de archivo inesperado. Debe ser "files".'
    };

    return res.status(413).json({
      mensajeError: map[err.code] || `Error de carga: ${err.code}`,
      code: err.code
    });
  }

  // Errores custom
  return res.status(400).json({
    mensajeError: err.message || 'Error al procesar la carga de archivos.'
  });
}
