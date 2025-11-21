/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 21 / 11 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Util para manejo de archivos y directorios:
 *  - Crear carpetas recursivamente
 *  - Eliminar archivos de forma segura
 *  - Eliminar carpetas si quedan vacías
 *
 * Tema: Utils - Archivos
 * Capa: Backend
 */

import fsp from 'fs/promises';
import path from 'path';
import uploadConfig from '../config/uploadConfig.js';

const PROJECT_ROOT = process.cwd();

/**
 * AseguraR que un directorio exista (lo crea recursivamente si no existe).
 */
export const ensureDirExists = async (dirPath) => {
  return fsp.mkdir(dirPath, { recursive: true });
};

/**
 * Elimina un archivo si existe. No lanza error si no existe.
 * @param {string} relativePath - ruta relativa desde el root del proyecto (ej: 'uploads/tickets/1/img.jpg')
 */
export const deleteFileIfExists = async (relativePath) => {
  if (!relativePath) return;

  const absolutePath = path.isAbsolute(relativePath)
    ? relativePath
    : path.join(PROJECT_ROOT, relativePath);

  try {
    await fsp.unlink(absolutePath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('[deleteFileIfExists] Error eliminando archivo:', err);
    }
  }
};

/**
 * Intenta eliminar un directorio si está vacío. Si no existe o no está vacío, no rompe.
 */
export const deleteDirIfEmpty = async (dirPath) => {
  try {
    const files = await fsp.readdir(dirPath);
    if (files.length === 0) {
      await fsp.rmdir(dirPath);
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('[deleteDirIfEmpty] Error eliminando directorio:', err);
    }
  }
};

/**
 * Convierte un path absoluto a relativo desde el root del proyecto.
 * Útil para guardar en la DB algo como 'uploads/tickets/123/archivo.jpg'
 */
export const toRelativeFromRoot = (absolutePath) => {
  return path.relative(PROJECT_ROOT, absolutePath);
};

/**
 * Inicializa estructura mínima de uploads al arrancar la app.
 * (ej: /uploads y /uploads/tickets)
 */
export const initUploadDirs = async () => {
  try {
    await ensureDirExists(uploadConfig.ROOT);
    await ensureDirExists(uploadConfig.TICKETS_DIR);
  } catch (err) {
    console.error('[initUploadDirs] Error creando carpetas de uploads:', err);
  }
};

export default {
  ensureDirExists,
  deleteFileIfExists,
  deleteDirIfEmpty,
  toRelativeFromRoot,
  initUploadDirs
};
