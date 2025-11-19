/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 19 / 11 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Modelo Sequelize para la tabla `usuarios` del sistema interno Conectate.
 * Maneja roles (operador_sucursal, supervisor, admin) y vínculo opcional a sucursales.
 *
 * Tema: Modelos - Usuarios
 * Capa: Backend
 */

import dotenv from 'dotenv';
import { DataTypes } from 'sequelize';
import db from '../../DataBase/db.js';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export const UsuariosModel = db.define(
  'usuarios',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Nombre completo del usuario'
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      },
      comment: 'Email único para login'
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Hash de contraseña'
    },
    rol: {
      type: DataTypes.ENUM('operador_sucursal', 'supervisor', 'admin'),
      allowNull: false,
      defaultValue: 'operador_sucursal',
      comment: 'Rol funcional en el sistema'
    },
    sucursal_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      comment:
        'Sucursal base del usuario (operador); supervisor/admin puede ser NULL'
    },
    estado: {
      type: DataTypes.ENUM('activo', 'inactivo'),
      allowNull: false,
      defaultValue: 'activo',
      comment: 'Estado del usuario en el sistema'
    },
    ultimo_acceso: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha/hora del último login exitoso'
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    tableName: 'usuarios',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    comment: 'Usuarios del sistema interno de tickets Conectate',
    indexes: [
      {
        name: 'idx_usuarios_sucursal',
        fields: ['sucursal_id']
      },
      {
        name: 'uq_usuarios_email',
        unique: true,
        fields: ['email']
      }
    ]
  }
);


export default {
  UsuariosModel
};
