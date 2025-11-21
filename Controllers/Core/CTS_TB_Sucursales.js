/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 19 / 11 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Controladores para manejar operaciones CRUD sobre la tabla `sucursales`
 * del sistema interno de tickets Conectate.
 *
 * Tema: Controladores - Sucursales
 *
 * Capa: Backend
 *
 * Nomenclatura:
 *   OBR_  obtenerRegistro
 *   OBRS_ obtenerRegistros
 *   CR_   crearRegistro
 *   ER_   eliminarRegistro
 *   UR_   actualizarRegistro
 */

import { Op } from 'sequelize';
import MD_TB_Sucursales from '../../Models/Core/MD_TB_Sucursales.js';
import { registrarLogActividad } from '../Logs/CTS_TB_LogsActividad.js';

const SucursalesModel = MD_TB_Sucursales.SucursalesModel;

// ===============================================
// Obtener todas las sucursales (con o sin paginado)
// ===============================================

export const OBRS_Sucursales_CTS = async (req, res) => {
  try {
    const { page, limit, q, orderBy, orderDir, estado } = req.query || {};

    // ⚠️ Retrocompat: SIN params => array plano (como antes)
    const hasParams =
      Object.prototype.hasOwnProperty.call(req.query, 'page') ||
      Object.prototype.hasOwnProperty.call(req.query, 'limit') ||
      Object.prototype.hasOwnProperty.call(req.query, 'q') ||
      Object.prototype.hasOwnProperty.call(req.query, 'orderBy') ||
      Object.prototype.hasOwnProperty.call(req.query, 'orderDir') ||
      Object.prototype.hasOwnProperty.call(req.query, 'estado');

    if (!hasParams) {
      const sucursales = await SucursalesModel.findAll({
        order: [['id', 'ASC']]
      });
      return res.json(sucursales);
    }

    // ✅ Paginado + filtros + orden
    const pageNum = Math.max(parseInt(page || '1', 10), 1);
    const limitNum = Math.min(Math.max(parseInt(limit || '20', 10), 1), 100);
    const offset = (pageNum - 1) * limitNum;

    const where = {};

    // Filtro por texto libre
    if (q && q.trim() !== '') {
      const like = { [Op.like]: `%${q.trim()}%` };
      where[Op.or] = [
        { nombre: like },
        { codigo: like },
        { ciudad: like },
        { provincia: like },
        { direccion: like },
        { telefono: like },
        { email: like },
        { responsable_nombre: like },
        { responsable_dni: like }
      ];
    }

    // Filtro por estado (activo/inactivo)
    if (estado && ['activo', 'inactivo'].includes(estado)) {
      where.estado = estado;
    }

    const validColumns = [
      'id',
      'nombre',
      'codigo',
      'ciudad',
      'provincia',
      'estado',
      'created_at',
      'updated_at'
    ];

    const col = validColumns.includes(orderBy || '') ? orderBy : 'id';
    const dir = ['ASC', 'DESC'].includes(String(orderDir || '').toUpperCase())
      ? String(orderDir).toUpperCase()
      : 'ASC';

    const { rows, count } = await SucursalesModel.findAndCountAll({
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
        q: q || '',
        estado: estado || null
      }
    });
  } catch (error) {
    console.error('[OBRS_Sucursales_CTS] error:', error);
    res.status(500).json({ mensajeError: error.message });
  }
};

// ===============================================
// Obtener una sucursal por ID
// ===============================================

export const OBR_Sucursal_CTS = async (req, res) => {
  try {
    const sucursal = await SucursalesModel.findByPk(req.params.id);
    if (!sucursal) {
      return res.status(404).json({ mensajeError: 'Sucursal no encontrada' });
    }
    res.json(sucursal);
  } catch (error) {
    console.error('[OBR_Sucursal_CTS] error:', error);
    res.status(500).json({ mensajeError: error.message });
  }
};

// ===============================================
// Crear una nueva sucursal
// ===============================================

export const CR_Sucursal_CTS = async (req, res) => {
  const {
    nombre,
    codigo,
    direccion,
    ciudad,
    provincia,
    telefono,
    email,
    responsable_nombre,
    responsable_dni,
    horario_apertura,
    horario_cierre,
    estado,
    usuario_log_id // reservado para logs futuros
  } = req.body;

  if (!nombre || nombre.trim() === '') {
    return res
      .status(400)
      .json({ mensajeError: 'El nombre de la sucursal es obligatorio' });
  }

  try {
    // Validar que el código (si viene) no se repita
    if (codigo && codigo.trim() !== '') {
      const existing = await SucursalesModel.findOne({
        where: { codigo: codigo.trim() }
      });
      if (existing) {
        return res.status(400).json({
          mensajeError: `Ya existe una sucursal con el código "${codigo.trim()}"`
        });
      }
    }

    const nueva = await SucursalesModel.create({
      nombre: nombre.trim(),
      codigo: codigo?.trim() || null,
      direccion: direccion || null,
      ciudad: ciudad || null,
      provincia: provincia || undefined, // si viene, pisa el default 'Tucumán'
      telefono: telefono || null,
      email: email || null,
      responsable_nombre: responsable_nombre || null,
      responsable_dni: responsable_dni || null,
      horario_apertura: horario_apertura || undefined,
      horario_cierre: horario_cierre || undefined,
      estado:
        estado && ['activo', 'inactivo'].includes(estado) ? estado : undefined
    });

    await registrarLogActividad({
      usuario_id: usuario_log_id || null,
      modulo: 'sucursales',
      accion: 'CREAR',
      entidad: 'sucursal',
      entidad_id: nueva.id,
      descripcion: `El usuario ${usuario_log_id} creó la sucursal "${nueva.nombre}" (#${nueva.id})`,
      ip: req.ip,
      user_agent: req.headers['user-agent']
    });
    res.json({ message: 'Sucursal creada correctamente', sucursal: nueva });
  } catch (error) {
    console.error('[CR_Sucursal_CTS] error:', error);
    res.status(500).json({ mensajeError: error.message });
  }
};

// ===============================================
// Eliminar una sucursal
// (NO permite eliminar si está referenciada por tickets)
// ===============================================

export const ER_Sucursal_CTS = async (req, res) => {
  const { usuario_log_id } = req.body; // reservado para futuro log
  const { id } = req.params;

  try {
    const sucursal = await SucursalesModel.findByPk(id);

    if (!sucursal) {
      return res.status(404).json({ mensajeError: 'Sucursal no encontrada' });
    }

    try {
      const deleted = await SucursalesModel.destroy({ where: { id } });

      if (deleted !== 1) {
        return res.status(404).json({ mensajeError: 'Sucursal no encontrada' });
      }

      // Solo logueamos si realmente se eliminó
      await registrarLogActividad({
        usuario_id: usuario_log_id || null,
        modulo: 'sucursales',
        accion: 'ELIMINAR',
        entidad: 'sucursal',
        entidad_id: sucursal.id,
        descripcion: `El usuario ${usuario_log_id} eliminó la sucursal "${sucursal.nombre}" (#${sucursal.id}).`,
        ip: req.ip,
        user_agent: req.headers['user-agent']
      });

      return res.json({ message: 'Sucursal eliminada correctamente' });
    } catch (err) {
      //💥 Acá atrapamos el caso FK
      if (err.name === 'SequelizeForeignKeyConstraintError') {
        // Podés filtrar por constraint si querés ser más específico:
        // if (err.index === 'fk_tickets_sucursal') { ... }
        return res.status(409).json({
          mensajeError:
            'No se puede eliminar la sucursal porque tiene tickets asociados. ' +
            'Reasigna esos tickets a otra sucursal o ciérralos antes de intentar eliminarla.'
        });
      }

      // Otros errores reales los dejamos caer al catch exterior
      throw err;
    }
  } catch (error) {
    console.error('[ER_Sucursal_CTS] error:', error);
    return res
      .status(500)
      .json({
        mensajeError: 'Error al eliminar la sucursal',
        detalle: error.message
      });
  }
};

// ===============================================
// Actualizar una sucursal
// ===============================================

export const UR_Sucursal_CTS = async (req, res) => {
  const { id } = req.params;
  const { usuario_log_id } = req.body; // reservado para logs

  try {
    const sucursalAnterior = await SucursalesModel.findByPk(id);
    if (!sucursalAnterior) {
      return res.status(404).json({ mensajeError: 'Sucursal no encontrada' });
    }

    // Campos a auditar
    const camposAuditar = [
      'nombre',
      'codigo',
      'direccion',
      'ciudad',
      'provincia',
      'telefono',
      'email',
      'responsable_nombre',
      'responsable_dni',
      'horario_apertura',
      'horario_cierre',
      'estado'
    ];

    const cambios = [];

    for (const key of camposAuditar) {
      if (
        Object.prototype.hasOwnProperty.call(req.body, key) &&
        req.body[key]?.toString() !== sucursalAnterior[key]?.toString()
      ) {
        cambios.push(
          `cambió el campo "${key}" de "${sucursalAnterior[key]}" a "${req.body[key]}"`
        );
      }
    }

    // Si viene "codigo", validar que no esté usado por otra sucursal
    if (req.body.codigo && req.body.codigo.trim() !== '') {
      const existing = await SucursalesModel.findOne({
        where: {
          codigo: req.body.codigo.trim(),
          id: { [Op.ne]: id }
        }
      });
      if (existing) {
        return res.status(400).json({
          mensajeError: `Ya existe otra sucursal con el código "${req.body.codigo.trim()}"`
        });
      }
    }

    const [updated] = await SucursalesModel.update(req.body, {
      where: { id }
    });

    if (updated === 1) {
      const actualizada = await SucursalesModel.findByPk(id);

      await registrarLogActividad({
        usuario_id: usuario_log_id || null,
        modulo: 'sucursales',
        accion: 'ACTUALIZAR',
        entidad: 'sucursal',
        entidad_id: id,
        descripcion:
          cambios.length > 0
            ? `El usuario ${usuario_log_id} actualizó la sucursal #${id}: ${cambios.join(
                '; '
              )}`
            : `El usuario ${usuario_log_id} ejecutó actualización sin cambios aparentes en la sucursal #${id}`,
        ip: req.ip,
        user_agent: req.headers['user-agent']
      });

      res.json({
        message: 'Sucursal actualizada correctamente',
        sucursal: actualizada,
        cambios // opcional devolverlos, útil para debug
      });
    } else {
      res.status(404).json({ mensajeError: 'Sucursal no encontrada' });
    }
  } catch (error) {
    console.error('[UR_Sucursal_CTS] error:', error);
    res.status(500).json({ mensajeError: error.message });
  }
};
