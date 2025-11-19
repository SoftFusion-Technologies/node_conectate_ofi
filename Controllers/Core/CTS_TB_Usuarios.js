/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 19 / 11 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo (CTS_TB_Usuarios.js) contiene controladores para manejar operaciones
 * CRUD sobre la tabla de usuarios del sistema interno Conectate.
 *
 * Tema: Controladores - Usuarios
 * Capa: Backend
 */

// Importar modelos
import MD_TB_Usuarios from '../../Models/Core/MD_TB_Usuarios.js';
import MD_TB_Sucursales from '../../Models/Core/MD_TB_Sucursales.js';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';

const { UsuariosModel } = MD_TB_Usuarios;
const { SucursalesModel } = MD_TB_Sucursales;

// Util: elimina claves con '', null o undefined
const stripEmpty = (obj) => {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    out[k] = v;
  }
  return out;
};

const ROLES_VALIDOS = ['operador_sucursal', 'supervisor', 'admin'];
const ESTADOS_VALIDOS = ['activo', 'inactivo'];

// ===================================================
// Obtener todos los usuarios
// ===================================================

export const OBRS_Usuarios_CTS = async (req, res) => {
  try {
    const usuarios = await UsuariosModel.findAll({
      include: [{ model: SucursalesModel, as: 'sucursal' }],
      order: [['id', 'ASC']]
    });

    // Buena práctica: no devolver el hash de password al front
    const sanitizados = usuarios.map((u) => {
      const plain = u.toJSON();
      delete plain.password;
      return plain;
    });

    res.json(sanitizados);
  } catch (error) {
    console.error('[OBRS_Usuarios_CTS] error:', error);
    res.status(500).json({ mensajeError: error.message });
  }
};

// ===================================================
// Obtener un solo usuario por ID
// ===================================================

export const OBR_Usuario_CTS = async (req, res) => {
  try {
    const usuario = await UsuariosModel.findByPk(req.params.id, {
      include: [{ model: SucursalesModel, as: 'sucursal' }]
    });

    if (!usuario) {
      return res.status(404).json({ mensajeError: 'Usuario no encontrado' });
    }

    const plain = usuario.toJSON();
    delete plain.password;

    res.json(plain);
  } catch (error) {
    console.error('[OBR_Usuario_CTS] error:', error);
    res.status(500).json({ mensajeError: error.message });
  }
};

// ===================================================
// Crear un nuevo usuario
// ===================================================

export const CR_Usuario_CTS = async (req, res) => {
  const {
    nombre,
    email,
    password,
    rol,
    sucursal_id,
    estado,
    usuario_log_id // reservado para logs futuros
  } = req.body;

  if (!nombre || !email || !password || !rol) {
    return res.status(400).json({
      mensajeError: 'Faltan campos obligatorios: nombre, email, password y rol'
    });
  }

  if (!ROLES_VALIDOS.includes(rol)) {
    return res
      .status(400)
      .json({
        mensajeError: `Rol inválido. Roles permitidos: ${ROLES_VALIDOS.join(
          ', '
        )}`
      });
  }

  try {
    // Validar email único
    const existeEmail = await UsuariosModel.findOne({ where: { email } });
    if (existeEmail) {
      return res
        .status(400)
        .json({ mensajeError: 'Ya existe un usuario con ese email' });
    }

    // Validar sucursal si viene informada
    let sucursalIdNormalizado = null;
    if (
      sucursal_id !== undefined &&
      sucursal_id !== null &&
      sucursal_id !== ''
    ) {
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
      sucursalIdNormalizado = sid;
    }

    const estadoFinal =
      estado && ESTADOS_VALIDOS.includes(estado) ? estado : 'activo';

    // Hashear password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const nuevo = await UsuariosModel.create({
      nombre: nombre.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      rol,
      sucursal_id: sucursalIdNormalizado,
      estado: estadoFinal
    });

    const plain = nuevo.toJSON();
    delete plain.password;

    // TODO: logs_actividad (usuario_log_id, ACCION: CREAR_USUARIO)

    res.json({ message: 'Usuario creado correctamente', usuario: plain });
  } catch (error) {
    console.error('[CR_Usuario_CTS] error:', error);
    res.status(500).json({
      mensajeError: error.message,
      detalles: error.errors || error
    });
  }
};

// ===================================================
// Eliminar un usuario
// ===================================================

export const ER_Usuario_CTS = async (req, res) => {
  const { usuario_log_id } = req.body; // reservado para logs

  try {
    const usuario = await UsuariosModel.findByPk(req.params.id);
    if (!usuario) {
      return res.status(404).json({ mensajeError: 'Usuario no encontrado' });
    }

    await UsuariosModel.destroy({ where: { id: req.params.id } });

    // TODO: logs_actividad (usuario_log_id, ACCION: ELIMINAR_USUARIO)

    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    console.error('[ER_Usuario_CTS] error:', error);
    res.status(500).json({ mensajeError: error.message });
  }
};

// ===================================================
// Actualizar un usuario
// ===================================================

export const UR_Usuario_CTS = async (req, res) => {
  const { id } = req.params;
  const { usuario_log_id } = req.body; // reservado para logs

  try {
    const usuarioAnterior = await UsuariosModel.findByPk(id);
    if (!usuarioAnterior) {
      return res.status(404).json({ mensajeError: 'Usuario no encontrado' });
    }

    // Campos permitidos para actualización
    const permitidos = [
      'nombre',
      'email',
      'rol',
      'sucursal_id',
      'estado',
      'password'
    ];
    const basePayload = {};
    for (const key of permitidos) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        basePayload[key] = req.body[key];
      }
    }

    // Limpiar strings vacíos para evitar setear "" en DB
    let payload = stripEmpty(basePayload);

    // Normalizar sucursal_id
    if ('sucursal_id' in payload) {
      if (payload.sucursal_id === '') {
        payload.sucursal_id = null;
      } else {
        const sid = Number(payload.sucursal_id);
        if (Number.isNaN(sid)) {
          return res
            .status(400)
            .json({ mensajeError: 'El campo sucursal_id debe ser numérico' });
        }
        payload.sucursal_id = sid;
      }
    }

    // Validar rol si viene
    if ('rol' in payload && !ROLES_VALIDOS.includes(payload.rol)) {
      return res
        .status(400)
        .json({
          mensajeError: `Rol inválido. Roles permitidos: ${ROLES_VALIDOS.join(
            ', '
          )}`
        });
    }

    // Validar estado si viene
    if ('estado' in payload && !ESTADOS_VALIDOS.includes(payload.estado)) {
      return res
        .status(400)
        .json({
          mensajeError: `Estado inválido. Estados permitidos: ${ESTADOS_VALIDOS.join(
            ', '
          )}`
        });
    }

    // Validar que email no se repita si se quiere cambiar
    if ('email' in payload) {
      const existeEmail = await UsuariosModel.findOne({
        where: {
          email: payload.email,
          id: { [Op.ne]: id }
        }
      });
      if (existeEmail) {
        return res
          .status(400)
          .json({ mensajeError: 'Ya existe otro usuario con ese email' });
      }
    }

    // Hashear password solo si viene no vacía (tras stripEmpty)
    if ('password' in payload) {
      const salt = await bcrypt.genSalt(10);
      payload.password = await bcrypt.hash(payload.password, salt);
    }

    // Armar difs para logs (sin mostrar password)
    const camposParaDiff = ['nombre', 'email', 'rol', 'sucursal_id', 'estado'];
    const cambios = [];

    for (const key of camposParaDiff) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        const nuevoVal = String(payload[key] ?? '');
        const anteriorVal = String(usuarioAnterior[key] ?? '');
        if (nuevoVal !== anteriorVal) {
          cambios.push(`cambió "${key}" de "${anteriorVal}" a "${nuevoVal}"`);
        }
      }
    }
    if ('password' in payload) {
      cambios.push('actualizó "password"');
    }

    // Update seguro: solo los campos que quedaron en payload
    const [updated] = await UsuariosModel.update(payload, {
      where: { id },
      fields: Object.keys(payload)
    });

    if (updated === 1) {
      const actualizado = await UsuariosModel.findByPk(id, {
        include: [{ model: SucursalesModel, as: 'sucursal' }]
      });

      const plain = actualizado.toJSON();
      delete plain.password;

      // TODO: logs_actividad si cambios.length > 0 && usuario_log_id

      res.json({
        message: 'Usuario actualizado correctamente',
        usuario: plain,
        cambios // opcional, útil para debug
      });
    } else {
      res.status(404).json({ mensajeError: 'Usuario no encontrado' });
    }
  } catch (error) {
    console.error('[UR_Usuario_CTS] error:', error);
    res.status(500).json({ mensajeError: error.message });
  }
};
