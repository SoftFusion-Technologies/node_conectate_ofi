/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 22 / 11 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Controladores para manejar operaciones sobre la tabla `notificaciones`
 * del sistema interno Conectate.
 *
 * Incluye:
 *  - Listado paginado/filtrado de notificaciones (por usuario_destino, estado, canal, ticket, etc.)
 *  - Obtención de una notificación puntual
 *  - Creación de notificaciones (manual o desde otros módulos)
 *  - Marcado de notificación como leída
 *  - Eliminación opcional de notificaciones (solo admin)
 *
 * Reglas de permisos (sugeridas):
 *  - operador_sucursal:
 *      * Sólo puede ver sus propias notificaciones (usuario_destino_id = req.user.id)
 *      * Sólo puede marcar como leídas sus propias notificaciones
 *  - supervisor/admin:
 *      * Pueden ver sus propias notificaciones
 *      * Opcional: pueden consultar notificaciones de otros usuarios vía filtros
 *
 * Tema: Controladores - Notificaciones
 * Capa: Backend
 */

import { Op } from 'sequelize';

import MD_TB_Notificaciones from '../../Models/Tickets/MD_TB_Notificaciones.js';
import MD_TB_Tickets from '../../Models/Tickets/MD_TB_Tickets.js';
import MD_TB_Usuarios from '../../Models/Core/MD_TB_Usuarios.js';

import { registrarLogActividad } from '../Logs/CTS_TB_LogsActividad.js';

const { NotificacionesModel } = MD_TB_Notificaciones;
const { TicketsModel } = MD_TB_Tickets;
const { UsuariosModel } = MD_TB_Usuarios;

const CANALES_VALIDOS = ['interno', 'email', 'whatsapp', 'otro'];
const ESTADOS_ENVIO_VALIDOS = ['pendiente', 'enviado', 'error'];

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
 * Convierte valores variados en booleano.
 */
const toBool = (v) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1;
  if (typeof v === 'string') {
    return ['1', 'true', 'si', 'sí', 'yes'].includes(v.toLowerCase());
  }
  return false;
};

// ===================================================
// 1) Listado de notificaciones
// GET /notificaciones
//
// Query params:
//   page, limit
//   usuario_destino_id (solo tiene efecto para supervisor/admin)
//   ticket_id
//   canal (interno/email/whatsapp/otro)
//   estado_envio (pendiente/enviado/error)
//   solo_no_leidas (true/false)
//   fecha_desde, fecha_hasta (fecha_creacion)
//   orderBy, orderDir
//
// Reglas de visibilidad:
//   - operador_sucursal -> usuario_destino_id = req.user.id (forzado)
//   - supervisor/admin -> por defecto ve sus propias notificaciones,
//     pero puede filtrar por usuario_destino_id si se indica.
// ===================================================

export const OBRS_Notificaciones_CTS = async (req, res) => {
  try {
    const {
      page,
      limit,
      usuario_destino_id,
      ticket_id,
      canal,
      estado_envio,
      solo_no_leidas,
      fecha_desde,
      fecha_hasta,
      orderBy,
      orderDir
    } = req.query || {};

    const { id: usuarioIdCtx, rol } = getUserContext(req);

    const pageNum = Math.max(parseInt(page || '1', 10), 1);
    const limitNum = Math.min(Math.max(parseInt(limit || '20', 10), 1), 100);
    const offset = (pageNum - 1) * limitNum;

    const where = {};

    // Usuario destino según rol
    if (rol === 'operador_sucursal') {
      // Solo ve sus propias notificaciones
      where.usuario_destino_id = usuarioIdCtx || 0;
    } else {
      // supervisor/admin
      if (usuario_destino_id) {
        const uid = Number(usuario_destino_id);
        if (!Number.isNaN(uid)) {
          where.usuario_destino_id = uid;
        }
      } else {
        // por defecto, también ve sus propias notificaciones
        where.usuario_destino_id = usuarioIdCtx || 0;
      }
    }

    // ticket asociado
    if (ticket_id) {
      const tid = Number(ticket_id);
      if (!Number.isNaN(tid)) {
        where.ticket_id = tid;
      }
    }

    // canal
    if (canal && CANALES_VALIDOS.includes(canal)) {
      where.canal = canal;
    }

    // estado_envio
    if (estado_envio && ESTADOS_ENVIO_VALIDOS.includes(estado_envio)) {
      where.estado_envio = estado_envio;
    }

    // Solo no leídas
    if (solo_no_leidas !== undefined && toBool(solo_no_leidas)) {
      where.fecha_lectura = { [Op.is]: null };
    }

    // Rango de fecha_creacion
    if (fecha_desde || fecha_hasta) {
      where.fecha_creacion = {};
      if (fecha_desde) {
        where.fecha_creacion[Op.gte] = new Date(fecha_desde);
      }
      if (fecha_hasta) {
        const fin = new Date(fecha_hasta);
        if (!Number.isNaN(fin.getTime())) {
          fin.setHours(23, 59, 59, 999);
          where.fecha_creacion[Op.lte] = fin;
        }
      }
    }

    const validColumns = [
      'id',
      'fecha_creacion',
      'fecha_envio',
      'fecha_lectura',
      'canal',
      'estado_envio'
    ];
    const col = validColumns.includes(orderBy || '')
      ? orderBy
      : 'fecha_creacion';
    const dir = ['ASC', 'DESC'].includes(String(orderDir || '').toUpperCase())
      ? String(orderDir).toUpperCase()
      : 'DESC';

    const { rows, count } = await NotificacionesModel.findAndCountAll({
      where,
      order: [[col, dir]],
      limit: limitNum,
      offset,
      include: [
        {
          model: UsuariosModel,
          as: 'origen',
          attributes: ['id', 'nombre', 'email', 'rol']
        },
        {
          model: UsuariosModel,
          as: 'destino',
          attributes: ['id', 'nombre', 'email', 'rol']
        },
        {
          model: TicketsModel,
          as: 'ticket',
          attributes: ['id', 'estado', 'fecha_ticket', 'sucursal_id']
        }
      ]
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
          usuario_destino_id: where.usuario_destino_id,
          ticket_id,
          canal,
          estado_envio,
          solo_no_leidas,
          fecha_desde,
          fecha_hasta
        })
      }
    });
  } catch (error) {
    console.error('[OBRS_Notificaciones_CTS] error:', error);
    res.status(500).json({ mensajeError: error.message });
  }
};

// ===================================================
// 2) Obtener una notificación puntual
// GET /notificaciones/:id
//
// Regla de seguridad:
//   - operador_sucursal: sólo si es el usuario_destino.
//   - supervisor/admin: si es usuario_destino o (opcional) podría
//     permitirse ver cualquier notificación. Aquí limitamos a destino.
// ===================================================

export const OBR_Notificacion_CTS = async (req, res) => {
  try {
    const { id: usuarioIdCtx, rol } = getUserContext(req);

    const notif = await NotificacionesModel.findByPk(req.params.id, {
      include: [
        {
          model: UsuariosModel,
          as: 'origen',
          attributes: ['id', 'nombre', 'email', 'rol']
        },
        {
          model: UsuariosModel,
          as: 'destino',
          attributes: ['id', 'nombre', 'email', 'rol']
        },
        {
          model: TicketsModel,
          as: 'ticket',
          attributes: ['id', 'estado', 'fecha_ticket', 'sucursal_id']
        }
      ]
    });

    if (!notif) {
      return res
        .status(404)
        .json({ mensajeError: 'Notificación no encontrada' });
    }

    // Permisos: cualquiera debe ser destino de la notificación
    if (notif.usuario_destino_id !== usuarioIdCtx) {
      // Si quisieras permitir que supervisor/admin pueda ver cualquier notificación,
      // podrías quitar este if o relajarlo. Por ahora lo mantenemos estricto.
      return res.status(403).json({
        mensajeError: 'No tiene permisos para ver esta notificación'
      });
    }

    return res.json(notif);
  } catch (error) {
    console.error('[OBR_Notificacion_CTS] error:', error);
    res.status(500).json({ mensajeError: error.message });
  }
};

// ===================================================
// 3) Crear una notificación
// POST /notificaciones
//
// Body:
//   ticket_id (opcional)
//   usuario_destino_id (obligatorio)
//   canal (interno/email/whatsapp/otro) - default: interno
//   asunto (obligatorio)
//   mensaje (obligatorio)
//
// usuario_origen_id se toma de req.user.id (si existe) o de body.usuario_origen_id.
// ===================================================

export const CR_Notificacion_CTS = async (req, res) => {
  try {
    const {
      ticket_id,
      usuario_destino_id,
      canal,
      asunto,
      mensaje,
      usuario_origen_id: usuarioOrigenBody,
      usuario_log_id // opcional para logs
    } = req.body;

    const { id: usuarioIdCtx } = getUserContext(req);

    if (!usuario_destino_id) {
      return res
        .status(400)
        .json({ mensajeError: 'El campo usuario_destino_id es obligatorio' });
    }

    if (!asunto || !mensaje) {
      return res.status(400).json({
        mensajeError: 'Los campos asunto y mensaje son obligatorios'
      });
    }

    const usuarioDestinoIdNum = Number(usuario_destino_id);
    if (Number.isNaN(usuarioDestinoIdNum)) {
      return res.status(400).json({
        mensajeError: 'usuario_destino_id debe ser numérico'
      });
    }

    const destino = await UsuariosModel.findByPk(usuarioDestinoIdNum);
    if (!destino) {
      return res
        .status(400)
        .json({ mensajeError: 'El usuario destino no existe' });
    }

    let ticketIdNum = null;
    if (ticket_id) {
      ticketIdNum = Number(ticket_id);
      if (Number.isNaN(ticketIdNum)) {
        return res
          .status(400)
          .json({ mensajeError: 'ticket_id debe ser numérico' });
      }
      const ticket = await TicketsModel.findByPk(ticketIdNum);
      if (!ticket) {
        return res
          .status(400)
          .json({ mensajeError: `No existe ticket con id=${ticketIdNum}` });
      }
    }

    const canalFinal =
      canal && CANALES_VALIDOS.includes(canal) ? canal : 'interno';

    const usuarioOrigenFinal = usuarioOrigenBody || usuarioIdCtx || null; // puede ser NULL si es "sistema"

    const nuevaNotif = await NotificacionesModel.create({
      ticket_id: ticketIdNum,
      usuario_origen_id: usuarioOrigenFinal,
      usuario_destino_id: usuarioDestinoIdNum,
      canal: canalFinal,
      asunto: asunto.trim(),
      mensaje,
      estado_envio: 'pendiente',
      // fecha_creacion se setea por default en la DB
      fecha_envio: null,
      fecha_lectura: null
    });

    // Log de actividad
    const usuarioLog = usuario_log_id || usuarioIdCtx || null;
    await registrarLogActividad({
      usuario_id: usuarioLog,
      modulo: 'notificaciones',
      accion: 'CREAR',
      entidad: 'notificacion',
      entidad_id: nuevaNotif.id,
      descripcion: `El usuario ${usuarioLog} creó una notificación #${
        nuevaNotif.id
      } para el usuario destino #${usuarioDestinoIdNum} (ticket_id=${
        ticketIdNum || 'NULL'
      }, canal=${canalFinal}).`,
      ip: req.ip,
      user_agent: req.headers['user-agent']
    });

    return res.json({
      message: 'Notificación creada correctamente',
      notificacion: nuevaNotif
    });
  } catch (error) {
    console.error('[CR_Notificacion_CTS] error:', error);
    res.status(500).json({ mensajeError: error.message });
  }
};

// ===================================================
// 4) Marcar notificación como leída
// POST /notificaciones/:id/marcar-leida
//
// Regla de seguridad:
//   - Solo el usuario_destino puede marcarla como leída.
//
// Efecto:
//   - fecha_lectura = NOW()
// ===================================================

export const UR_Notificacion_MarcarLeida_CTS = async (req, res) => {
  try {
    const { id: usuarioIdCtx } = getUserContext(req);

    const notif = await NotificacionesModel.findByPk(req.params.id);

    if (!notif) {
      return res
        .status(404)
        .json({ mensajeError: 'Notificación no encontrada' });
    }

    if (notif.usuario_destino_id !== usuarioIdCtx) {
      return res.status(403).json({
        mensajeError:
          'Solo el usuario destino puede marcar esta notificación como leída'
      });
    }

    if (notif.fecha_lectura) {
      // Ya está leída, no pasa nada pero respondemos OK
      return res.json({
        message: 'La notificación ya estaba marcada como leída',
        notificacion: notif
      });
    }

    const ahora = new Date();

    await NotificacionesModel.update(
      { fecha_lectura: ahora },
      { where: { id: notif.id } }
    );

    const actualizada = await NotificacionesModel.findByPk(notif.id);

    await registrarLogActividad({
      usuario_id: usuarioIdCtx,
      modulo: 'notificaciones',
      accion: 'MARCAR_LEIDA',
      entidad: 'notificacion',
      entidad_id: notif.id,
      descripcion: `El usuario ${usuarioIdCtx} marcó como leída la notificación #${notif.id}.`,
      ip: req.ip,
      user_agent: req.headers['user-agent']
    });

    return res.json({
      message: 'Notificación marcada como leída correctamente',
      notificacion: actualizada
    });
  } catch (error) {
    console.error('[UR_Notificacion_MarcarLeida_CTS] error:', error);
    res.status(500).json({ mensajeError: error.message });
  }
};

// ===================================================
// 5) Eliminar notificación (opcional)
// DELETE /notificaciones/:id
//
// Regla sugerida:
//   - Solo admin puede eliminar notificaciones, para mantener
//     trazabilidad en producción.
// ===================================================

export const ER_Notificacion_CTS = async (req, res) => {
  try {
    const { id: usuarioIdCtx, rol } = getUserContext(req);

    if (rol !== 'admin') {
      return res.status(403).json({
        mensajeError:
          'Solo un usuario con rol admin puede eliminar notificaciones'
      });
    }

    const notif = await NotificacionesModel.findByPk(req.params.id);

    if (!notif) {
      return res
        .status(404)
        .json({ mensajeError: 'Notificación no encontrada' });
    }

    await NotificacionesModel.destroy({ where: { id: notif.id } });

    await registrarLogActividad({
      usuario_id: usuarioIdCtx,
      modulo: 'notificaciones',
      accion: 'ELIMINAR',
      entidad: 'notificacion',
      entidad_id: notif.id,
      descripcion: `El usuario ${usuarioIdCtx} eliminó la notificación #${notif.id}.`,
      ip: req.ip,
      user_agent: req.headers['user-agent']
    });

    return res.json({ message: 'Notificación eliminada correctamente' });
  } catch (error) {
    console.error('[ER_Notificacion_CTS] error:', error);
    res.status(500).json({ mensajeError: error.message });
  }
};

// ===================================================
// 6) Resumen de notificaciones para el usuario logueado
// GET /notificaciones/resumen
//
// Devuelve:
// {
//   totalNoLeidas: number,
//   ultimas: Notificacion[] // últimas 5 (por defecto) ordenadas por fecha_creacion desc
// }
//
// Reglas:
//   - Solo usuario autenticado (obvio).
//   - Siempre filtra por usuario_destino_id = req.user.id
// ===================================================

export const OBR_Notificaciones_Resumen_CTS = async (req, res) => {
  try {
    const { id: usuarioIdCtx } = getUserContext(req);

    if (!usuarioIdCtx) {
      return res
        .status(401)
        .json({ mensajeError: 'Usuario no autenticado.' });
    }

    // Total de no leídas
    const totalNoLeidas = await NotificacionesModel.count({
      where: {
        usuario_destino_id: usuarioIdCtx,
        fecha_lectura: { [Op.is]: null }
      }
    });

    // Últimas 5 notificaciones (leídas o no), para previsualizar
    const ultimas = await NotificacionesModel.findAll({
      where: {
        usuario_destino_id: usuarioIdCtx
      },
      order: [['fecha_creacion', 'DESC']],
      limit: 5,
      include: [
        {
          model: UsuariosModel,
          as: 'origen',
          attributes: ['id', 'nombre', 'email', 'rol']
        },
        {
          model: TicketsModel,
          as: 'ticket',
          attributes: ['id', 'estado', 'fecha_ticket', 'sucursal_id']
        }
      ]
    });

    return res.json({
      totalNoLeidas,
      ultimas
    });
  } catch (error) {
    console.error('[OBR_Notificaciones_Resumen_CTS] error:', error);
    res.status(500).json({ mensajeError: error.message });
  }
};

export default {
  OBRS_Notificaciones_CTS,
  OBR_Notificacion_CTS,
  CR_Notificacion_CTS,
  UR_Notificacion_MarcarLeida_CTS,
  ER_Notificacion_CTS,
  OBR_Notificaciones_Resumen_CTS
};
