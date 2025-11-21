/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 21 / 11 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Controladores para manejar operaciones CRUD y de gestión sobre la tabla `tickets`
 * del sistema interno Conectate.
 *
 * Incluye:
 *  - Listado paginado/filtrado de tickets con reglas por rol (operador / supervisor / admin)
 *  - Obtención de un ticket con sus relaciones básicas
 *  - Creación de tickets (operador de sucursal)
 *  - Actualización (solo mientras el ticket está abierto/pendiente)
 *  - Eliminación (solo admin, y/o para casos muy controlados)
 *  - Cambio de estado con registro en `ticket_estados_historial` y `logs_actividad`
 *
 * Tema: Controladores - Tickets
 * Capa: Backend
 */

import { Op } from 'sequelize';

import MD_TB_Tickets from '../../Models/Tickets/MD_TB_Tickets.js';
import MD_TB_TicketEstadosHistorial from '../../Models/Tickets/MD_TB_TicketEstadosHistorial.js';
import MD_TB_Sucursales from '../../Models/Core/MD_TB_Sucursales.js';
import MD_TB_Usuarios from '../../Models/Core/MD_TB_Usuarios.js';
import MD_TB_Notificaciones from '../../Models/Tickets/MD_TB_Notificaciones.js';

import { registrarLogActividad } from '../Logs/CTS_TB_LogsActividad.js';

const { TicketsModel } = MD_TB_Tickets;
const { TicketEstadosHistorialModel } = MD_TB_TicketEstadosHistorial;
const { SucursalesModel } = MD_TB_Sucursales;
const { UsuariosModel } = MD_TB_Usuarios;
const { NotificacionesModel } = MD_TB_Notificaciones;

const ESTADOS_VALIDOS = [
  'abierto',
  'pendiente',
  'autorizado',
  'rechazado',
  'cerrado'
];

/**
 * Util interno: elimina claves con '', null o undefined (para filtros / payloads).
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
 * Devuelve info básica de usuario desde req.user.
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
 * Devuelve la lista de usuarios destino para notificación de un ticket nuevo:
 *   1) Supervisores activos de la misma sucursal.
 *   2) Si no hay, supervisores activos sin sucursal asignada (sucursal_id NULL).
 *   3) Si tampoco hay, admins activos (globales).
 */
const obtenerDestinatariosSupervisionPorSucursal = async (sucursalId) => {
  // 1) Supervisores de esa sucursal
  const supervisoresMismaSucursal = await UsuariosModel.findAll({
    where: {
      rol: 'supervisor',
      estado: 'activo',
      sucursal_id: sucursalId
    }
  });

  if (supervisoresMismaSucursal.length > 0) {
    return supervisoresMismaSucursal;
  }

  // 2) Supervisores sin sucursal (globales)
  const supervisoresGlobales = await UsuariosModel.findAll({
    where: {
      rol: 'supervisor',
      estado: 'activo',
      sucursal_id: { [Op.is]: null }
    }
  });

  if (supervisoresGlobales.length > 0) {
    return supervisoresGlobales;
  }

  // 3) Admins activos (último fallback)
  const admins = await UsuariosModel.findAll({
    where: {
      rol: 'admin',
      estado: 'activo'
    }
  });

  return admins;
};

/**
 * Crea notificaciones internas para los supervisores/admins correspondientes
 * cuando se crea un ticket nuevo.
 */
const crearNotificacionesTicketNuevo = async ({
  ticket,
  sucursalId,
  usuarioCreadorId,
  req
}) => {
  try {
    const destinatarios = await obtenerDestinatariosSupervisionPorSucursal(
      sucursalId
    );

    if (!destinatarios || destinatarios.length === 0) {
      // No hay nadie a quién notificar, no rompemos nada.
      console.warn(
        `[crearNotificacionesTicketNuevo] No se encontraron destinatarios para sucursal_id=${sucursalId}`
      );
      return;
    }

    const asuntoNotif = `Nuevo ticket #${ticket.id} creado`;
    const mensajeNotif = `Se ha creado el ticket #${ticket.id} en la sucursal_id=${sucursalId} con estado "abierto" y asunto: "${ticket.asunto}".`;

    await Promise.all(
      destinatarios.map(async (dest) => {
        const notif = await NotificacionesModel.create({
          ticket_id: ticket.id,
          usuario_origen_id: usuarioCreadorId || null,
          usuario_destino_id: dest.id,
          canal: 'interno',
          asunto: asuntoNotif,
          mensaje: mensajeNotif,
          estado_envio: 'pendiente',
          fecha_envio: null,
          fecha_lectura: null
        });

        // Log por cada notificación creada automáticamente
        await registrarLogActividad({
          usuario_id: usuarioCreadorId || null,
          modulo: 'notificaciones',
          accion: 'CREAR_AUTO_TICKET',
          entidad: 'notificacion',
          entidad_id: notif.id,
          descripcion: `Notificación automática #${notif.id} por creación de ticket #${ticket.id} para el usuario destino #${dest.id}.`,
          ip: req.ip,
          user_agent: req.headers['user-agent']
        });
      })
    );
  } catch (err) {
    // MUY IMPORTANTE: nunca romper la creación del ticket por culpa de las notificaciones
    console.error(
      '[crearNotificacionesTicketNuevo] Error creando notificaciones automáticas:',
      err
    );
  }
};

// ===================================================
// 1) Listado de tickets (paginado + filtros + permisos)
// GET /tickets
// Query params:
//   page, limit, estado, sucursal_id, creador_id,
//   fecha_desde, fecha_hasta, q, orderBy, orderDir
// ===================================================

export const OBRS_Tickets_CTS = async (req, res) => {
  try {
    const {
      page,
      limit,
      estado,
      sucursal_id,
      creador_id,
      fecha_desde,
      fecha_hasta,
      q,
      orderBy,
      orderDir
    } = req.query || {};

    const {
      id: usuarioIdCtx,
      rol,
      sucursal_id: sucursalCtx
    } = getUserContext(req);

    const pageNum = Math.max(parseInt(page || '1', 10), 1);
    const limitNum = Math.min(Math.max(parseInt(limit || '20', 10), 1), 100);
    const offset = (pageNum - 1) * limitNum;

    const where = {};

    // Filtros funcionales
    if (estado && ESTADOS_VALIDOS.includes(estado)) {
      where.estado = estado;
    }

    if (sucursal_id) {
      const sid = Number(sucursal_id);
      if (!Number.isNaN(sid)) where.sucursal_id = sid;
    }

    if (creador_id) {
      const cid = Number(creador_id);
      if (!Number.isNaN(cid)) where.usuario_creador_id = cid;
    }

    // Filtro por fecha_ticket
    if (fecha_desde || fecha_hasta) {
      where.fecha_ticket = {};
      if (fecha_desde) {
        where.fecha_ticket[Op.gte] = fecha_desde;
      }
      if (fecha_hasta) {
        where.fecha_ticket[Op.lte] = fecha_hasta;
      }
    }

    // Filtro de búsqueda libre (asunto / descripcion)
    if (q && q.trim() !== '') {
      const like = { [Op.like]: `%${q.trim()}%` };
      where[Op.or] = [{ asunto: like }, { descripcion: like }];
    }

    // REGLAS DE VISIBILIDAD POR ROL
    // operador_sucursal -> solo sus tickets (o de su sucursal, si se define así)
    // supervisor/admin -> ven todos, con filtros opcionales por sucursal_id/estado/etc.
    if (rol === 'operador_sucursal') {
      // Opción A (más estricta): solo tickets creados por él
      where.usuario_creador_id = usuarioIdCtx || 0;

      // Si quisieras: ver todos los de su sucursal, podés hacer:
      // where.sucursal_id = sucursalCtx || 0;
    }

    const validColumns = [
      'id',
      'fecha_ticket',
      'estado',
      'sucursal_id',
      'usuario_creador_id',
      'created_at',
      'updated_at'
    ];
    const col = validColumns.includes(orderBy || '') ? orderBy : 'fecha_ticket';
    const dir = ['ASC', 'DESC'].includes(String(orderDir || '').toUpperCase())
      ? String(orderDir).toUpperCase()
      : 'DESC';

    const { rows, count } = await TicketsModel.findAndCountAll({
      where,
      order: [[col, dir]],
      limit: limitNum,
      offset,
      include: [
        {
          model: SucursalesModel,
          as: 'sucursal',
          attributes: ['id', 'nombre', 'codigo', 'ciudad']
        },
        {
          model: UsuariosModel,
          as: 'creador',
          attributes: ['id', 'nombre', 'email', 'rol']
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
          estado,
          sucursal_id,
          creador_id,
          fecha_desde,
          fecha_hasta,
          q
        })
      }
    });
  } catch (error) {
    console.error('[OBRS_Tickets_CTS] error:', error);
    res.status(500).json({ mensajeError: error.message });
  }
};

// ===================================================
// 2) Obtener un ticket por ID (con sucursal + creador)
// GET /tickets/:id
// ===================================================

export const OBR_Ticket_CTS = async (req, res) => {
  try {
    const ticket = await TicketsModel.findByPk(req.params.id, {
      include: [
        {
          model: SucursalesModel,
          as: 'sucursal',
          attributes: ['id', 'nombre', 'codigo', 'ciudad', 'provincia']
        },
        {
          model: UsuariosModel,
          as: 'creador',
          attributes: ['id', 'nombre', 'email', 'rol']
        }
      ]
    });

    if (!ticket) {
      return res.status(404).json({ mensajeError: 'Ticket no encontrado' });
    }

    const {
      id: usuarioIdCtx,
      rol,
      sucursal_id: sucursalCtx
    } = getUserContext(req);

    // Reglas de visibilidad
    if (rol === 'operador_sucursal') {
      // Solo ve tickets creados por él (o de su sucursal si lo definís así)
      if (ticket.usuario_creador_id !== usuarioIdCtx) {
        return res
          .status(403)
          .json({ mensajeError: 'No tiene permisos para ver este ticket' });
      }
    }

    res.json(ticket);
  } catch (error) {
    console.error('[OBR_Ticket_CTS] error:', error);
    res.status(500).json({ mensajeError: error.message });
  }
};

// ===================================================
// 3) Crear un ticket
// POST /tickets
// Body:
//   fecha_ticket (YYYY-MM-DD), hora_ticket (opcional),
//   sucursal_id (opcional, normalmente viene del usuario),
//   asunto, descripcion
// ===================================================

export const CR_Ticket_CTS = async (req, res) => {
  const {
    fecha_ticket,
    hora_ticket,
    sucursal_id,
    asunto,
    descripcion,
    usuario_log_id // opcional, por compatibilidad para logs
  } = req.body;

  const {
    id: usuarioIdCtx,
    rol,
    sucursal_id: sucursalCtx
  } = getUserContext(req);

  const usuarioLog = usuario_log_id || usuarioIdCtx || null;

  if (!fecha_ticket || !asunto) {
    return res.status(400).json({
      mensajeError: 'Los campos fecha_ticket y asunto son obligatorios'
    });
  }

  try {
    // Determinar sucursal: si viene en body la validamos, si no tomamos la del usuario
    let sucursalFinalId = null;
    if (sucursal_id) {
      const sid = Number(sucursal_id);
      if (Number.isNaN(sid)) {
        return res
          .status(400)
          .json({ mensajeError: 'El campo sucursal_id debe ser numérico' });
      }
      const sucursal = await SucursalesModel.findByPk(sid);
      if (!sucursal) {
        return res
          .status(400)
          .json({ mensajeError: `No existe la sucursal con id=${sid}` });
      }
      sucursalFinalId = sid;
    } else {
      // Si no se envía sucursal_id, tomamos la sucursal del usuario (si la tiene)
      if (!sucursalCtx) {
        return res.status(400).json({
          mensajeError:
            'No se pudo determinar la sucursal. Envíe sucursal_id o asigne sucursal al usuario.'
        });
      }
      sucursalFinalId = sucursalCtx;
    }

    // El creador del ticket es el usuario logueado
    if (!usuarioIdCtx) {
      return res.status(400).json({
        mensajeError:
          'No se pudo determinar el usuario creador (req.user.id nulo)'
      });
    }

    const nuevo = await TicketsModel.create({
      fecha_ticket,
      hora_ticket: hora_ticket || null,
      sucursal_id: sucursalFinalId,
      usuario_creador_id: usuarioIdCtx,
      estado: 'pendiente',
      asunto: asunto.trim(),
      descripcion: descripcion || null,
      observaciones_supervisor: null
    });

    // Registrar primer historial de estado
    await TicketEstadosHistorialModel.create({
      ticket_id: nuevo.id,
      estado_anterior: null,
      estado_nuevo: 'pendiente',
      usuario_id: usuarioIdCtx,
      comentario: 'Ticket creado'
    });

    // Registrar log de creación de ticket
    await registrarLogActividad({
      usuario_id: usuarioLog,
      modulo: 'tickets',
      accion: 'CREAR',
      entidad: 'ticket',
      entidad_id: nuevo.id,
      descripcion: `El usuario ${usuarioLog} creó el ticket #${nuevo.id} (sucursal_id=${sucursalFinalId}, asunto="${nuevo.asunto}")`,
      ip: req.ip,
      user_agent: req.headers['user-agent']
    });

    // ----------------------------------------------------
    // 🔔 Notificaciones automáticas al supervisor por sucursal
    // ----------------------------------------------------
    await crearNotificacionesTicketNuevo({
      ticket: nuevo,
      sucursalId: sucursalFinalId,
      usuarioCreadorId: usuarioIdCtx,
      req
    });

    res.json({ message: 'Ticket creado correctamente', ticket: nuevo });
  } catch (error) {
    console.error('[CR_Ticket_CTS] error:', error);
    res.status(500).json({ mensajeError: error.message });
  }
};

// ===================================================
// 4) Actualizar ticket (datos básicos, NO estado)
// PUT /tickets/:id
// Solo si el ticket está en estado abierto/pendiente.
// operador_sucursal: solo puede editar sus propios tickets.
// supervisor/admin: pueden editar cualquier ticket abierto/pendiente.
// ===================================================

export const UR_Ticket_CTS = async (req, res) => {
  const { id } = req.params;
  const {
    fecha_ticket,
    hora_ticket,
    sucursal_id,
    asunto,
    descripcion,
    usuario_log_id
  } = req.body;

  const { id: usuarioIdCtx, rol } = getUserContext(req);
  const usuarioLog = usuario_log_id || usuarioIdCtx || null;

  try {
    const ticket = await TicketsModel.findByPk(id);
    if (!ticket) {
      return res.status(404).json({ mensajeError: 'Ticket no encontrado' });
    }

    // Solo se puede editar si está abierto o pendiente
    if (!['abierto', 'pendiente'].includes(ticket.estado)) {
      return res.status(400).json({
        mensajeError:
          'El ticket solo puede editarse si está en estado "abierto" o "pendiente"'
      });
    }

    // Permisos según rol
    if (rol === 'operador_sucursal') {
      if (ticket.usuario_creador_id !== usuarioIdCtx) {
        return res.status(403).json({
          mensajeError:
            'No tiene permisos para editar este ticket (no es el creador)'
        });
      }
    }

    const updates = {};

    if (fecha_ticket) updates.fecha_ticket = fecha_ticket;
    if (hora_ticket !== undefined) updates.hora_ticket = hora_ticket || null;

    if (sucursal_id) {
      const sid = Number(sucursal_id);
      if (Number.isNaN(sid)) {
        return res
          .status(400)
          .json({ mensajeError: 'El campo sucursal_id debe ser numérico' });
      }
      const sucursal = await SucursalesModel.findByPk(sid);
      if (!sucursal) {
        return res
          .status(400)
          .json({ mensajeError: `No existe la sucursal con id=${sid}` });
      }
      updates.sucursal_id = sid;
    }

    if (asunto !== undefined) updates.asunto = asunto.trim();
    if (descripcion !== undefined) updates.descripcion = descripcion || null;

    const [updated] = await TicketsModel.update(updates, {
      where: { id }
    });

    if (updated !== 1) {
      return res
        .status(500)
        .json({ mensajeError: 'No se pudo actualizar el ticket' });
    }

    const actualizado = await TicketsModel.findByPk(id);

    // Log de actualización (datos, no estado)
    await registrarLogActividad({
      usuario_id: usuarioLog,
      modulo: 'tickets',
      accion: 'ACTUALIZAR',
      entidad: 'ticket',
      entidad_id: Number(id),
      descripcion: `El usuario ${usuarioLog} actualizó datos del ticket #${id} (sin cambio de estado).`,
      ip: req.ip,
      user_agent: req.headers['user-agent']
    });

    res.json({
      message: 'Ticket actualizado correctamente',
      ticket: actualizado
    });
  } catch (error) {
    console.error('[UR_Ticket_CTS] error:', error);
    res.status(500).json({ mensajeError: error.message });
  }
};

// ===================================================
// 5) Eliminar ticket
// DELETE /tickets/:id
// Recomendación: solo admin, y usar con mucho cuidado.
// (ticket_adjuntos tiene ON DELETE CASCADE, igual que historial)
// ===================================================

export const ER_Ticket_CTS = async (req, res) => {
  const { usuario_log_id } = req.body;
  const { id: usuarioIdCtx, rol } = getUserContext(req);
  const usuarioLog = usuario_log_id || usuarioIdCtx || null;

  try {
    const ticket = await TicketsModel.findByPk(req.params.id);

    if (!ticket) {
      return res.status(404).json({ mensajeError: 'Ticket no encontrado' });
    }

    // Solo admin puede eliminar (por ahora)
    if (rol !== 'admin') {
      return res.status(403).json({
        mensajeError: 'Solo un usuario con rol admin puede eliminar tickets'
      });
    }

    await TicketsModel.destroy({ where: { id: req.params.id } });

    await registrarLogActividad({
      usuario_id: usuarioLog,
      modulo: 'tickets',
      accion: 'ELIMINAR',
      entidad: 'ticket',
      entidad_id: ticket.id,
      descripcion: `El usuario ${usuarioLog} eliminó el ticket #${ticket.id}.`,
      ip: req.ip,
      user_agent: req.headers['user-agent']
    });

    res.json({ message: 'Ticket eliminado correctamente' });
  } catch (error) {
    console.error('[ER_Ticket_CTS] error:', error);
    res.status(500).json({ mensajeError: error.message });
  }
};

// ===================================================
// 6) Cambio de estado del ticket
// POST /tickets/:id/cambiar-estado
// Body:
//   nuevo_estado (abierto/pendiente/autorizado/rechazado/cerrado)
//   comentario (opcional, se guarda en historial y puede agregarse a observaciones_supervisor)
//   usuario_log_id (opcional)
// Reglas:
//   - Solo supervisor/admin pueden cambiar estado (por ahora).
//   - Registra en ticket_estados_historial.
//   - Actualiza tickets.estado y fecha_cierre si corresponde.
//   - Registra log_actividad.
// ===================================================

export const CR_Ticket_CambiarEstado_CTS = async (req, res) => {
  const { id } = req.params;
  const { nuevo_estado, comentario, usuario_log_id } = req.body;

  const { id: usuarioIdCtx, rol } = getUserContext(req);
  const usuarioLog = usuario_log_id || usuarioIdCtx || null;

  // 🔹 Normalizar
  const estadoNormalizado = String(nuevo_estado || '')
    .trim()
    .toLowerCase();

  if (!estadoNormalizado || !ESTADOS_VALIDOS.includes(estadoNormalizado)) {
    return res.status(400).json({
      mensajeError: `Estado inválido. Debe ser uno de: ${ESTADOS_VALIDOS.join(
        ', '
      )}`
    });
  }

  try {
    const ticket = await TicketsModel.findByPk(id);
    if (!ticket) {
      return res.status(404).json({ mensajeError: 'Ticket no encontrado' });
    }

    if (rol !== 'supervisor' && rol !== 'admin') {
      return res.status(403).json({
        mensajeError:
          'No tiene permisos para cambiar el estado del ticket (requiere supervisor o admin)'
      });
    }

    const estadoAnterior = ticket.estado;

    if (estadoAnterior === estadoNormalizado) {
      return res.status(400).json({
        mensajeError:
          'El ticket ya se encuentra en el estado solicitado (no hay cambio)'
      });
    }

    if (estadoAnterior === 'cerrado') {
      return res.status(400).json({
        mensajeError:
          'No se puede cambiar el estado de un ticket ya cerrado. Debe gestionarse por excepción.'
      });
    }

    await TicketEstadosHistorialModel.create({
      ticket_id: ticket.id,
      estado_anterior: estadoAnterior,
      estado_nuevo: estadoNormalizado,
      usuario_id: usuarioIdCtx,
      comentario: comentario || null
    });

    const updates = { estado: estadoNormalizado };

    if (estadoNormalizado === 'cerrado') {
      updates.fecha_cierre = new Date();
    }

    if (
      comentario &&
      ['autorizado', 'rechazado', 'cerrado'].includes(estadoNormalizado)
    ) {
      const prevObs = ticket.observaciones_supervisor || '';
      const sep = prevObs ? '\n---\n' : '';
      updates.observaciones_supervisor = `${prevObs}${sep}${comentario}`;
    }

    await TicketsModel.update(updates, { where: { id } });

    const actualizado = await TicketsModel.findByPk(id);

    await registrarLogActividad({
      usuario_id: usuarioLog,
      modulo: 'tickets',
      accion: 'CAMBIAR_ESTADO',
      entidad: 'ticket',
      entidad_id: ticket.id,
      descripcion: `El usuario ${usuarioLog} cambió el estado del ticket #${
        ticket.id
      } de "${estadoAnterior}" a "${estadoNormalizado}". Comentario: ${
        comentario || 'sin comentario'
      }`,
      ip: req.ip,
      user_agent: req.headers['user-agent']
    });

    res.json({
      message: 'Estado de ticket actualizado correctamente',
      ticket: actualizado
    });
  } catch (error) {
    console.error('[CR_Ticket_CambiarEstado_CTS] error:', error);
    res.status(500).json({ mensajeError: error.message });
  }
};

export default {
  OBRS_Tickets_CTS,
  OBR_Ticket_CTS,
  CR_Ticket_CTS,
  UR_Ticket_CTS,
  ER_Ticket_CTS,
  CR_Ticket_CambiarEstado_CTS
};
