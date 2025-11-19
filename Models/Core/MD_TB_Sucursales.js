/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 19 / 11 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Modelo Sequelize para la tabla `sucursales` del sistema interno Conectate.
 * Representa las oficinas/sucursales desde donde se cargan tickets.
 *
 * Tema: Modelos - Sucursales
 * Capa: Backend
 */

import dotenv from 'dotenv';
import { DataTypes } from 'sequelize';
import db from '../../DataBase/db.js';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export const SucursalesModel = db.define(
  'sucursales',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Nombre de la sucursal/oficina'
    },
    codigo: {
      type: DataTypes.STRING(10),
      allowNull: true,
      unique: true,
      comment: 'Código corto interno (ej: MON, CON, FAM)'
    },
    direccion: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Dirección física de la sucursal'
    },
    ciudad: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Ciudad o localidad'
    },
    provincia: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'Tucumán',
      comment: 'Provincia, por defecto Tucumán'
    },
    telefono: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Teléfono de contacto de la sucursal'
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        isEmail: true
      },
      comment: 'Email de la sucursal o responsable'
    },
    responsable_nombre: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Nombre de la persona responsable de la sucursal'
    },
    responsable_dni: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'DNI del responsable, para control interno'
    },
    horario_apertura: {
      type: DataTypes.TIME,
      allowNull: false,
      defaultValue: '09:00:00',
      comment: 'Hora de apertura de la sucursal'
    },
    horario_cierre: {
      type: DataTypes.TIME,
      allowNull: false,
      defaultValue: '18:00:00',
      comment: 'Hora de cierre de la sucursal'
    },
    estado: {
      type: DataTypes.ENUM('activo', 'inactivo'),
      allowNull: false,
      defaultValue: 'activo',
      comment: 'Estado operativo de la sucursal'
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
    tableName: 'sucursales',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    comment: 'Sucursales/oficinas del sistema interno de tickets Conectate',
    indexes: [
      {
        name: 'uq_sucursales_codigo',
        unique: true,
        fields: ['codigo']
      },
      {
        name: 'idx_sucursales_estado_ciudad',
        fields: ['estado', 'ciudad']
      }
    ]
  }
);

// Las relaciones con Usuarios/Tickets las manejamos en sus módulos

export default {
  SucursalesModel
};
