/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 21 / 11 / 2025
 * Versión: 1.1
 *
 * Descripción:
 * Middleware de subida de archivos (multer) para adjuntos de tickets.
 * Crea carpetas dinámicamente si no existen y genera nombres únicos.
 *
 * Tema: Middlewares - Uploads Tickets
 * Capa: Backend
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import uploadConfig from '../config/uploadConfig.js';

const ensureDirSync = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Storage para adjuntos de tickets
const storageTickets = multer.diskStorage({
  destination: (req, file, cb) => {
    // Soportamos /tickets/:id/adjuntos o /tickets/:ticketId/adjuntos
    const ticketId =
      req.params.ticketId ||
      req.params.id ||
      req.body.ticket_id ||
      req.body.ticketId;

    const destDir = ticketId
      ? path.join(uploadConfig.TICKETS_DIR, String(ticketId))
      : path.join(uploadConfig.TICKETS_DIR, 'tmp');

    try {
      ensureDirSync(destDir);
      cb(null, destDir);
    } catch (err) {
      cb(err, destDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix =
      Date.now().toString() + '-' + Math.round(Math.random() * 1e9).toString();

    const originalName = file.originalname || 'archivo';
    const safeName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const finalName = `${uniqueSuffix}-${safeName}`;

    cb(null, finalName);
  }
});

// Instancia base de multer
const multerTickets = multer({
  storage: storageTickets,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100 MB
  },
  fileFilter: (req, file, cb) => {
    // Acá podrías filtrar por tipo/mime si querés
    cb(null, true);
  }
});

/**
 * Middleware listo para recibir múltiples archivos en el campo "files"
 * (coincide con formData.append('files', file) del frontend).
 */

export const uploadTicketFiles = multerTickets.array('files', 10);
