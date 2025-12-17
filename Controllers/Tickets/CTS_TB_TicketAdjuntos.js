/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 22 / 11 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Controladores para manejar operaciones sobre la tabla `ticket_adjuntos`
 * del sistema interno Conectate.
 *
 * Incluye:
 *  - Listado de adjuntos por ticket
 *  - Obtención de un adjunto por ID
 *  - Creación de adjuntos (con archivo subido por multer)
 *  - Eliminación de adjuntos (borra registro + archivo físico)
 *
 * Reglas de permisos:
 *  - operador_sucursal:
 *      * Sólo puede ver/crear/eliminar adjuntos de tickets que él creó,
 *        y mientras el ticket esté en estado 'abierto' o 'pendiente'.
 *  - supervisor / admin:
 *      * Pueden gestionar adjuntos de cualquier ticket.
 *
 * Tema: Controladores - Ticket Adjuntos
 * Capa: Backend
 */

import path from 'path';
import { Op } from 'sequelize';

import MD_TB_TicketAdjuntos from '../../Models/Tickets/MD_TB_TicketAdjuntos.js';
import MD_TB_Tickets from '../../Models/Tickets/MD_TB_Tickets.js';
import MD_TB_Usuarios from '../../Models/Core/MD_TB_Usuarios.js';

import {
  toRelativeFromRoot,
  deleteFileIfExists,
  deleteDirIfEmpty
} from '../../Utils/fileManager.js';

import { registrarLogActividad } from '../Logs/CTS_TB_LogsActividad.js';
import fs from 'fs';

const { TicketAdjuntosModel } = MD_TB_TicketAdjuntos;
const { TicketsModel } = MD_TB_Tickets;
const { UsuariosModel } = MD_TB_Usuarios;

const ESTADOS_EDITABLES = ['abierto', 'pendiente'];

/**
 * Util interno: limpia objetos (quita '', null, undefined).
 */
const stripEmpty = (obj) => {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    out[k] = v;
  }
  return out;
};

/**
 * Util interno: contexto del usuario autenticado.
 */
const getUserContext = (req) => {
  const user = req.user || {};
  return {
    id: user.id || null,
    rol: user.rol || null,
    sucursal_id: user.sucursal_id || null
  };
};

/**
 * Deducción básica de tipo de adjunto según mimetype.
 */
const inferTipoFromMime = (mimetype = '') => {
  const mt = String(mimetype).toLowerCase();

  if (mt.startsWith('image/')) return 'imagen';
  if (mt.includes('sheet') || mt.includes('excel')) return 'excel';
  if (mt.includes('pdf')) return 'pdf';
  return 'otro';
};

/**
 * Verifica que el usuario tenga permiso sobre un ticket
 * y opcionalmente que el ticket esté en un estado editable.
 *
 * @param {object} ticket - instancia de TicketsModel
 * @param {object} userCtx - { id, rol }
 * @param {boolean} requireEditableState - true si queremos que estado sea abierto/pendiente
 */
const assertTicketPermission = (
  ticket,
  userCtx,
  requireEditableState = false
) => {
  const { id: userId, rol } = userCtx;

  if (!ticket) {
    const err = new Error('Ticket no encontrado');
    err.statusCode = 404;
    throw err;
  }

  if (rol === 'operador_sucursal') {
    if (ticket.usuario_creador_id !== userId) {
      const err = new Error(
        'No tiene permisos para operar sobre adjuntos de este ticket'
      );
      err.statusCode = 403;
      throw err;
    }
  }

  if (requireEditableState && !ESTADOS_EDITABLES.includes(ticket.estado)) {
    const err = new Error(
      'Los adjuntos solo pueden modificarse si el ticket está en estado "abierto" o "pendiente"'
    );
    err.statusCode = 400;
    throw err;
  }
};
const BASE_UPLOAD_DIR = path.join(process.cwd(), 'uploads');

const resolveSafeUploadPath = (rutaRelativa) => {
  const rel = String(rutaRelativa || '').replace(/^\/+/, '');
  const abs = path.resolve(process.cwd(), rel);

  // Evita path traversal y asegura que quede dentro de /uploads
  if (!abs.startsWith(BASE_UPLOAD_DIR)) {
    const err = new Error('Ruta de archivo inválida');
    err.statusCode = 400;
    throw err;
  }
  return abs;
};

// ===================================================
// 1) Listado de adjuntos por ticket
// GET /tickets/:ticketId/adjuntos
//
// Query params opcionales:
//   page, limit, tipo, es_principal, orderBy, orderDir
// ===================================================

export const OBRS_TicketAdjuntos_CTS = async (req, res) => {
  try {
    const ticketIdParam = req.params.ticketId;
    if (!ticketIdParam) {
      return res
        .status(400)
        .json({ mensajeError: 'Debe indicar un ticketId en la ruta' });
    }

    const ticketId = Number(ticketIdParam);
    if (Number.isNaN(ticketId)) {
      return res
        .status(400)
        .json({ mensajeError: 'ticketId debe ser numérico' });
    }

    const { page, limit, tipo, es_principal, orderBy, orderDir } =
      req.query || {};

    const { id: usuarioIdCtx, rol } = getUserContext(req);

    // Verificar ticket y permisos (solo lectura: no necesita estado editable)
    const ticket = await TicketsModel.findByPk(ticketId);
    assertTicketPermission(ticket, { id: usuarioIdCtx, rol }, false);

    const pageNum = Math.max(parseInt(page || '1', 10), 1);
    const limitNum = Math.min(Math.max(parseInt(limit || '20', 10), 1), 100);
    const offset = (pageNum - 1) * limitNum;

    const where = { ticket_id: ticketId };

    if (tipo && ['imagen', 'excel', 'pdf', 'otro'].includes(tipo)) {
      where.tipo = tipo;
    }

    if (es_principal !== undefined) {
      // "1", "true", etc
      const val =
        typeof es_principal === 'string'
          ? ['1', 'true', 'si', 'sí', 'yes'].includes(
              es_principal.toLowerCase()
            )
          : Boolean(es_principal);
      where.es_principal = val ? 1 : 0;
    }

    const validColumns = [
      'id',
      'created_at',
      'tipo',
      'es_principal',
      'nombre_original'
    ];
    const col = validColumns.includes(orderBy || '') ? orderBy : 'created_at';
    const dir = ['ASC', 'DESC'].includes(String(orderDir || '').toUpperCase())
      ? String(orderDir).toUpperCase()
      : 'ASC';

    const { rows, count } = await TicketAdjuntosModel.findAndCountAll({
      where,
      order: [[col, dir]],
      limit: limitNum,
      offset
    });

    const totalPages = Math.max(Math.ceil(count / limitNum), 1);

    return res.json({
      data: rows,
      meta: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
        orderBy: col,
        orderDir: dir,
        filters: stripEmpty({
          ticket_id: ticketId,
          tipo,
          es_principal
        })
      }
    });
  } catch (error) {
    console.error('[OBRS_TicketAdjuntos_CTS] error:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ mensajeError: error.message });
  }
};

// ===================================================
// 2) Obtener un adjunto por ID
// GET /tickets/adjuntos/:id
// ===================================================

export const OBR_TicketAdjunto_CTS = async (req, res) => {
  try {
    const { id: usuarioIdCtx, rol } = getUserContext(req);

    const adjunto = await TicketAdjuntosModel.findByPk(req.params.id, {
      include: [
        {
          model: TicketsModel,
          as: 'ticket',
          attributes: [
            'id',
            'usuario_creador_id',
            'sucursal_id',
            'estado',
            'fecha_ticket'
          ]
        }
      ]
    });

    if (!adjunto) {
      return res
        .status(404)
        .json({ mensajeError: 'Adjunto de ticket no encontrado' });
    }

    // Verificar permisos sobre el ticket asociado
    assertTicketPermission(adjunto.ticket, { id: usuarioIdCtx, rol }, false);

    res.json(adjunto);
  } catch (error) {
    console.error('[OBR_TicketAdjunto_CTS] error:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ mensajeError: error.message });
  }
};

// ===================================================
// 2.1) Ver/Descargar archivo de un adjunto
// GET /tickets/adjuntos/:id/file?download=1
// - inline: default
// - download=1 => attachment
// ===================================================

export const FILE_TicketAdjunto_CTS = async (req, res) => {
  try {
    const { id: usuarioIdCtx, rol } = getUserContext(req);

    const adjunto = await TicketAdjuntosModel.findByPk(req.params.id, {
      include: [
        {
          model: TicketsModel,
          as: 'ticket',
          attributes: ['id', 'usuario_creador_id', 'estado', 'sucursal_id']
        }
      ]
    });

    if (!adjunto) {
      return res.status(404).json({ mensajeError: 'Adjunto no encontrado' });
    }

    // Permisos sobre el ticket
    assertTicketPermission(adjunto.ticket, { id: usuarioIdCtx, rol }, false);

    const absPath = resolveSafeUploadPath(adjunto.ruta_archivo);
    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ mensajeError: 'Archivo no existe en disco' });
    }

    const download = String(req.query.download || '0') === '1';
    const filename = (adjunto.nombre_original || path.basename(absPath)).replace(/"/g, '');

    res.setHeader(
      'Content-Disposition',
      `${download ? 'attachment' : 'inline'}; filename="${filename}"`
    );

    if (adjunto.mime_type) {
      res.setHeader('Content-Type', adjunto.mime_type);
    }

    return res.sendFile(absPath);
  } catch (error) {
    console.error('[FILE_TicketAdjunto_CTS] error:', error);
    res.status(error.statusCode || 500).json({ mensajeError: error.message });
  }
};

// ===================================================
// 3) Crear uno o varios adjuntos para un ticket
// POST /tickets/:ticketId/adjuntos
//
// Debe usarse con multer:
//   uploadTicketFiles.array('files', 10)
//
// Frontend:
//   formData.append('files', file)
//
// Soporta también el modo legacy .single('archivo') (req.file)
// ===================================================

export const CR_TicketAdjunto_CTS = async (req, res) => {
  try {
    const ticketIdParam = req.params.ticketId || req.body.ticket_id;
    if (!ticketIdParam) {
      return res
        .status(400)
        .json({ mensajeError: 'Debe indicar ticketId en ruta o body' });
    }

    const ticketId = Number(ticketIdParam);
    if (Number.isNaN(ticketId)) {
      return res
        .status(400)
        .json({ mensajeError: 'ticketId debe ser numérico' });
    }

    const { id: usuarioIdCtx, rol } = getUserContext(req);
    const usuarioLog = usuarioIdCtx || req.body.usuario_log_id || null;

    // 🔹 Normalizar archivos: soportar array('files') y single('archivo')
    let files = [];
    if (Array.isArray(req.files) && req.files.length > 0) {
      files = req.files; // caso moderno: array('files')
    } else if (req.file) {
      files = [req.file]; // caso legacy: single('archivo')
    }

    if (!files || files.length === 0) {
      return res.status(400).json({
        mensajeError:
          'No se recibió ningún archivo. Enviar archivos en el campo "files" (o "archivo").'
      });
    }

    // Buscar ticket y validar permisos + estado editable
    const ticket = await TicketsModel.findByPk(ticketId);
    assertTicketPermission(ticket, { id: usuarioIdCtx, rol }, true);

    let { tipo, es_principal } = req.body;

    // 🔹 Normalizar es_principal (desde body)
    let esPrincipalGlobal = false;
    if (es_principal !== undefined) {
      if (typeof es_principal === 'string') {
        esPrincipalGlobal = ['1', 'true', 'si', 'sí', 'yes'].includes(
          es_principal.toLowerCase()
        );
      } else {
        esPrincipalGlobal = Boolean(es_principal);
      }
    } else {
      // Si no se mandó es_principal y aún no hay ninguno, ponemos true al primero
      const countPrincipal = await TicketAdjuntosModel.count({
        where: { ticket_id: ticketId, es_principal: 1 }
      });
      if (countPrincipal === 0) {
        esPrincipalGlobal = true;
      }
    }

    // Si se marcó como principal, desmarcamos otros del mismo ticket
    if (esPrincipalGlobal) {
      await TicketAdjuntosModel.update(
        { es_principal: 0 },
        { where: { ticket_id: ticketId } }
      );
    }

    const nuevosAdjuntos = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const { originalname, mimetype, size, path: absolutePath } = file;
      const rutaRelativa = toRelativeFromRoot(absolutePath);

      // Determinar tipo final
      let tipoFinal = tipo;
      if (!tipoFinal || !['imagen', 'excel', 'pdf', 'otro'].includes(tipoFinal)) {
        tipoFinal = inferTipoFromMime(mimetype);
      }

      // Solo el primer archivo se marca como principal (si corresponde)
      const esPrincipalAdj = esPrincipalGlobal && i === 0;

      const nuevoAdjunto = await TicketAdjuntosModel.create({
        ticket_id: ticketId,
        tipo: tipoFinal,
        nombre_original: originalname,
        ruta_archivo: rutaRelativa,
        mime_type: mimetype,
        tamano_bytes: size,
        es_principal: esPrincipalAdj ? 1 : 0
      });

      nuevosAdjuntos.push(nuevoAdjunto);

      // Log de actividad por cada adjunto
      await registrarLogActividad({
        usuario_id: usuarioLog,
        modulo: 'ticket_adjuntos',
        accion: 'CREAR',
        entidad: 'ticket_adjunto',
        entidad_id: nuevoAdjunto.id,
        descripcion: `El usuario ${usuarioLog} agregó un adjunto al ticket #${ticketId} (adjunto #${nuevoAdjunto.id}, tipo=${tipoFinal}, nombre="${originalname}").`,
        ip: req.ip,
        user_agent: req.headers['user-agent']
      });
    }

    res.json({
      message:
        nuevosAdjuntos.length === 1
          ? 'Adjunto creado correctamente'
          : `${nuevosAdjuntos.length} adjuntos creados correctamente`,
      adjuntos: nuevosAdjuntos
    });
  } catch (error) {
    console.error('[CR_TicketAdjunto_CTS] error:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ mensajeError: error.message });
  }
};

// ===================================================
// 4) Eliminar un adjunto
// DELETE /tickets/adjuntos/:id
//
// Reglas:
//   - operador_sucursal: sólo si es de un ticket creado por él
//     y el ticket está en estado editable.
//   - supervisor/admin: pueden eliminar adjuntos de cualquier ticket.
//   Además de borrar el registro, intentamos borrar el archivo físico
//   y, si la carpeta queda vacía, también la carpeta.
// ===================================================

export const ER_TicketAdjunto_CTS = async (req, res) => {
  try {
    const { id: usuarioIdCtx, rol } = getUserContext(req);
    const usuarioLog = usuarioIdCtx || req.body.usuario_log_id || null;

    const adjunto = await TicketAdjuntosModel.findByPk(req.params.id, {
      include: [
        {
          model: TicketsModel,
          as: 'ticket',
          attributes: [
            'id',
            'usuario_creador_id',
            'sucursal_id',
            'estado',
            'fecha_ticket'
          ]
        }
      ]
    });

    if (!adjunto) {
      return res
        .status(404)
        .json({ mensajeError: 'Adjunto de ticket no encontrado' });
    }

    // Verificar permisos y estado editable del ticket
    assertTicketPermission(
      adjunto.ticket,
      { id: usuarioIdCtx, rol },
      true // requireEditableState
    );

    // Guardar path relativo antes de eliminar
    const rutaRelativa = adjunto.ruta_archivo;

    // Eliminar registro de DB
    await TicketAdjuntosModel.destroy({ where: { id: adjunto.id } });

    // Eliminar archivo físico
    await deleteFileIfExists(rutaRelativa);

    // Intentar eliminar carpeta si queda vacía
    if (rutaRelativa) {
      const absolutePath = path.join(process.cwd(), rutaRelativa);
      const dir = path.dirname(absolutePath);
      await deleteDirIfEmpty(dir);
    }

    // Log de actividad
    await registrarLogActividad({
      usuario_id: usuarioLog,
      modulo: 'ticket_adjuntos',
      accion: 'ELIMINAR',
      entidad: 'ticket_adjunto',
      entidad_id: adjunto.id,
      descripcion: `El usuario ${usuarioLog} eliminó el adjunto #${adjunto.id} del ticket #${adjunto.ticket_id}.`,
      ip: req.ip,
      user_agent: req.headers['user-agent']
    });

    res.json({ message: 'Adjunto eliminado correctamente' });
  } catch (error) {
    console.error('[ER_TicketAdjunto_CTS] error:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ mensajeError: error.message });
  }
};

export default {
  OBRS_TicketAdjuntos_CTS,
  OBR_TicketAdjunto_CTS,
  FILE_TicketAdjunto_CTS,
  CR_TicketAdjunto_CTS,
  ER_TicketAdjunto_CTS
};
