/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 21 / 11 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Configuración base para manejo de archivos subidos (uploads).
 * Define rutas base para almacenar adjuntos del sistema.
 *
 * Tema: Configuración - Uploads
 * Capa: Backend
 */

import path from 'path';

const UPLOADS_ROOT = path.join(process.cwd(), 'uploads');
const UPLOADS_TICKETS_DIR = path.join(UPLOADS_ROOT, 'tickets');

export const uploadConfig = {
  ROOT: UPLOADS_ROOT,
  TICKETS_DIR: UPLOADS_TICKETS_DIR
};

export default uploadConfig;
