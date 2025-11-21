/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 22 / 11 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Controladores para manejar consultas sobre la tabla `ticket_estados_historial`
 * del sistema interno Conectate.
 *
 * Incluye:
 *  - Listado paginado/filtrado de historial (por ticket, usuario, estado, fechas)
 *  - Obtención de un registro puntual de historial por ID
 *
 * NOTA:
 *  La creación de registros de historial se realiza desde el controlador de Tickets
 *  (CTS_TB_Tickets.js) cada vez que se crea un ticket o se cambia su estado.
 *
 * Tema: Controladores - Ticket Estados Historial
 * Capa: Backend
 */

import { Op } from 'sequelize';

import MD_TB_TicketEstadosHistorial from '../../Models/Tickets/MD_TB_TicketEstadosHistorial.js';
import MD_TB_Tickets from '../../Models/Tickets/MD_TB_Tickets.js';
import MD_TB_Usuarios from '../../Models/Core/MD_TB_Usuarios.js';

const { TicketEstadosHistorialModel } = MD_TB_TicketEstadosHistorial;
const { TicketsModel } = MD_TB_Tickets;
const { UsuariosModel } = MD_TB_Usuarios;

const ESTADOS_VALIDOS = [
  'abierto',
  'pendiente',
  'autorizado',
  'rechazado',
  'cerrado'
];

/**
 * Util interno: elimina claves con '', null o undefined.
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
 * Devuelve info básica del usuario autenticado desde req.user.
 * (Debés tener el middleware de JWT asignando req.user)
 */
const getUserContext = (req) => {
  const user = req.user || {};
  return {
    id: user.id || null,
    rol: user.rol || null,
    sucursal_id: user.sucursal_id || null
  };
};

// ===================================================
// 1) Listado de historial de estados
// GET /tickets/historial
// GET /tickets/:ticketId/historial
//
// Query params:
//   page, limit,
//   ticket_id (opcional si no va en params),
//   usuario_id, estado_nuevo, fecha_desde, fecha_hasta,
//   orderBy, orderDir
//
// Regla de seguridad:
//   - operador_sucursal: sólo puede ver historial de tickets que él creó.
//   - supervisor/admin: pueden ver cualquiera (con filtros).
// ===================================================

export const OBRS_TicketEstadosHistorial_CTS = async (req, res) => {
  try {
    const {
      page,
      limit,
      orderBy,
      orderDir,
      ticket_id,
      estado, // 👈 viene del front como ?estado=pendiente
      estado_nuevo, // 👈 por compatibilidad si alguna vez lo usás así
      fecha_desde,
      fecha_hasta,
      usuario_id
    } = req.query;

    const pageNum = Math.max(parseInt(page || '1', 10), 1);
    const limitNum = Math.min(Math.max(parseInt(limit || '20', 10), 1), 100);
    const offset = (pageNum - 1) * limitNum;

    const where = {};

    // Filtro por ticket
    if (ticket_id) {
      where.ticket_id = Number(ticket_id);
    }

    // 🔹 Filtro por estado (usando el valor que venga)
    const estadoFiltro = estado || estado_nuevo || '';
    if (estadoFiltro && ESTADOS_VALIDOS.includes(estadoFiltro)) {
      where.estado_nuevo = estadoFiltro; // 👈 acá se aplica el filtro real
    }

    // Filtro por usuario
    if (usuario_id) {
      where.usuario_id = Number(usuario_id);
    }

    // Filtros por fecha
    if (fecha_desde || fecha_hasta) {
      where.fecha_cambio = {};
      if (fecha_desde) where.fecha_cambio[Op.gte] = new Date(fecha_desde);
      if (fecha_hasta)
        where.fecha_cambio[Op.lte] = new Date(fecha_hasta + ' 23:59:59');
    }

    const validOrderColumns = ['fecha_cambio', 'ticket_id', 'id'];
    const col = validOrderColumns.includes(orderBy || '')
      ? orderBy
      : 'fecha_cambio';
    const dir = ['ASC', 'DESC'].includes(String(orderDir || '').toUpperCase())
      ? String(orderDir).toUpperCase()
      : 'DESC';

    const { rows, count } = await TicketEstadosHistorialModel.findAndCountAll({
      where,
      include: [
        {
          model: UsuariosModel,
          as: 'usuario',
          attributes: ['id', 'nombre', 'email']
        }
      ],
      order: [
        [col, dir],
        ['id', 'DESC']
      ],
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
        filters: {
          ticket_id: ticket_id || null,
          estado: estadoFiltro || null,
          fecha_desde: fecha_desde || null,
          fecha_hasta: fecha_hasta || null,
          usuario_id: usuario_id || null
        }
      }
    });
  } catch (error) {
    console.error('[OBRS_TicketEstadosHistorial_CTS] error:', error);
    res.status(500).json({ mensajeError: error.message });
  }
};

// ===================================================
// 2) Obtener un registro puntual de historial por ID
// GET /tickets/historial/:id
//
// Regla de seguridad:
//   - operador_sucursal: sólo si el ticket asociado fue creado por él.
//   - supervisor/admin: pueden ver cualquier registro.
// ===================================================

export const OBR_TicketEstadoHistorial_CTS = async (req, res) => {
  try {
    const { id: usuarioIdCtx, rol } = getUserContext(req);

    const registro = await TicketEstadosHistorialModel.findByPk(req.params.id, {
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
        },
        {
          model: UsuariosModel,
          as: 'usuario',
          attributes: ['id', 'nombre', 'email', 'rol']
        }
      ]
    });

    if (!registro) {
      return res
        .status(404)
        .json({ mensajeError: 'Registro de historial no encontrado' });
    }

    // Reglas de visibilidad
    if (rol === 'operador_sucursal') {
      if (
        !registro.ticket ||
        registro.ticket.usuario_creador_id !== usuarioIdCtx
      ) {
        return res.status(403).json({
          mensajeError: 'No tiene permisos para ver este registro de historial'
        });
      }
    }

    return res.json(registro);
  } catch (error) {
    console.error('[OBR_TicketEstadoHistorial_CTS] error:', error);
    res.status(500).json({ mensajeError: error.message });
  }
};

export default {
  OBRS_TicketEstadosHistorial_CTS,
  OBR_TicketEstadoHistorial_CTS
};
