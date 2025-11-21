/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 21 / 11 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Controladores para manejar operaciones de consulta sobre la tabla `logs_actividad`
 * y una función utilitaria para registrar eventos de auditoría en todo el sistema.
 *
 * Tema: Controladores - Logs de Actividad
 * Capa: Backend
 */

import { Op } from 'sequelize';
import MD_TB_LogsActividad from '../../Models/Logs/MD_TB_LogsActividad.js';

const { LogsActividadModel } = MD_TB_LogsActividad;

/**
 * Util interno: convierte strings vacíos en undefined, y limpia null/undefined.
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

// ===================================================
// 1) Listado de logs (paginado + filtros)
// GET /logs
// Query params:
//   page, limit, usuario_id, modulo, accion, entidad, entidad_id,
//   fecha_desde, fecha_hasta, q, orderBy, orderDir
// ===================================================

export const OBRS_LogsActividad_CTS = async (req, res) => {
  try {
    const {
      page,
      limit,
      usuario_id,
      modulo,
      accion,
      entidad,
      entidad_id,
      fecha_desde,
      fecha_hasta,
      q,
      orderBy,
      orderDir
    } = req.query || {};

    const pageNum = Math.max(parseInt(page || '1', 10), 1);
    const limitNum = Math.min(Math.max(parseInt(limit || '20', 10), 1), 100);
    const offset = (pageNum - 1) * limitNum;

    const where = {};

    // Filtros directos
    if (usuario_id) {
      const uid = Number(usuario_id);
      if (!Number.isNaN(uid)) where.usuario_id = uid;
    }

    if (modulo && modulo.trim() !== '') {
      where.modulo = modulo.trim();
    }

    if (accion && accion.trim() !== '') {
      where.accion = accion.trim();
    }

    if (entidad && entidad.trim() !== '') {
      where.entidad = entidad.trim();
    }

    if (entidad_id) {
      const eid = Number(entidad_id);
      if (!Number.isNaN(eid)) where.entidad_id = eid;
    }

    // Filtro por rango de fecha_hora
    if (fecha_desde || fecha_hasta) {
      where.fecha_hora = {};
      if (fecha_desde) {
        where.fecha_hora[Op.gte] = new Date(fecha_desde);
      }
      if (fecha_hasta) {
        // sumamos 1 día para incluir el día completo si solo viene YYYY-MM-DD
        const fin = new Date(fecha_hasta);
        if (!Number.isNaN(fin.getTime())) {
          fin.setHours(23, 59, 59, 999);
          where.fecha_hora[Op.lte] = fin;
        }
      }
    }

    // Filtro de búsqueda libre
    if (q && q.trim() !== '') {
      const like = { [Op.like]: `%${q.trim()}%` };
      where[Op.or] = [
        { modulo: like },
        { accion: like },
        { entidad: like },
        { descripcion: like }
      ];
    }

    const validColumns = [
      'id',
      'fecha_hora',
      'usuario_id',
      'modulo',
      'accion',
      'entidad',
      'entidad_id'
    ];

    const col = validColumns.includes(orderBy || '') ? orderBy : 'fecha_hora';
    const dir = ['ASC', 'DESC'].includes(String(orderDir || '').toUpperCase())
      ? String(orderDir).toUpperCase()
      : 'DESC';

    const { rows, count } = await LogsActividadModel.findAndCountAll({
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
          usuario_id,
          modulo,
          accion,
          entidad,
          entidad_id,
          fecha_desde,
          fecha_hasta,
          q
        })
      }
    });
  } catch (error) {
    console.error('[OBRS_LogsActividad_CTS] error:', error);
    res.status(500).json({ mensajeError: error.message });
  }
};

// ===================================================
// 2) Detalle de un log por ID
// GET /logs/:id
// ===================================================

export const OBR_LogActividad_CTS = async (req, res) => {
  try {
    const log = await LogsActividadModel.findByPk(req.params.id);

    if (!log) {
      return res.status(404).json({ mensajeError: 'Log no encontrado' });
    }

    res.json(log);
  } catch (error) {
    console.error('[OBR_LogActividad_CTS] error:', error);
    res.status(500).json({ mensajeError: error.message });
  }
};

// ===================================================
// 3) Función utilitaria para registrar logs
//    (NO es un handler de Express, se usa desde otros controladores)
// ===================================================

/**
 * Registra un evento en logs_actividad.
 *
 * Uso típico dentro de otros controladores:
 *
 *   import { registrarLogActividad } from '../Logs/CTS_TB_LogsActividad.js';
 *
 *   await registrarLogActividad({
 *     usuario_id: usuario_log_id,
 *     modulo: 'sucursales',
 *     accion: 'ACTUALIZAR',
 *     entidad: 'sucursal',
 *     entidad_id: id,
 *     descripcion: `El usuario ${usuario_log_id} actualizó la sucursal #${id}: ${cambios.join('; ')}`,
 *     ip: req.ip,
 *     user_agent: req.headers['user-agent']
 *   });
 */
export const registrarLogActividad = async ({
  usuario_id = null,
  modulo,
  accion,
  entidad = null,
  entidad_id = null,
  descripcion = null,
  ip = null,
  user_agent = null
}) => {
  try {
    if (!modulo || !accion) {
      console.warn(
        '[registrarLogActividad] modulo y accion son obligatorios. Payload recibido:',
        { modulo, accion, entidad, entidad_id }
      );
      return;
    }

    await LogsActividadModel.create({
      usuario_id: usuario_id ?? null,
      modulo,
      accion,
      entidad: entidad ?? null,
      entidad_id: entidad_id ?? null,
      descripcion: descripcion ?? null,
      ip: ip ?? null,
      user_agent: user_agent ?? null
    });
  } catch (error) {
    // Importante: NO romper el flujo principal por un error de log.
    console.error('[registrarLogActividad] error al guardar log:', error);
  }
};

export default {
  OBRS_LogsActividad_CTS,
  OBR_LogActividad_CTS,
  registrarLogActividad
};
