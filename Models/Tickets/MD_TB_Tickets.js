/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 19 / 11 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Modelo Sequelize para la tabla `tickets` del sistema interno Conectate.
 * Representa cada orden/ticket de conciliación cargada por usuarios de sucursal.
 *
 * Tema: Modelos - Tickets
 * Capa: Backend
 */

import dotenv from 'dotenv';
import { DataTypes } from 'sequelize';
import db from '../../DataBase/db.js';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export const TicketsModel = db.define(
  'tickets',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },

    // Fecha/hora de la orden/ticket (dato de negocio)
    fecha_ticket: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: 'Fecha de la orden/ticket informada por el usuario'
    },
    hora_ticket: {
      type: DataTypes.TIME,
      allowNull: true,
      comment: 'Hora aproximada del evento, opcional'
    },

    // Relación con sucursal y usuario creador
    sucursal_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      comment: 'Sucursal responsable donde se origina el ticket'
    },
    usuario_creador_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      comment: 'Usuario que cargó el ticket'
    },

    // Estado actual del ticket
    estado: {
      type: DataTypes.ENUM(
        'abierto',
        'pendiente',
        'autorizado',
        'rechazado',
        'cerrado'
      ),
      allowNull: false,
      defaultValue: 'abierto',
      comment: 'Estado actual del ticket'
    },

    // Info principal
    asunto: {
      type: DataTypes.STRING(150),
      allowNull: false,
      comment: 'Título corto o resumen del ticket'
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Detalle de la situación / descripción del problema'
    },
    observaciones_supervisor: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Comentarios del supervisor al autorizar / rechazar / cerrar'
    },

    fecha_cierre: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha y hora en que se cerró el ticket'
    },

    // Timestamps
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
    tableName: 'tickets',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    comment:
      'Tickets / órdenes de conciliación cargadas por usuarios de sucursal',
    indexes: [
      {
        name: 'idx_tickets_estado',
        fields: ['estado']
      },
      {
        name: 'idx_tickets_fecha',
        fields: ['fecha_ticket']
      },
      {
        name: 'idx_tickets_sucursal_estado',
        fields: ['sucursal_id', 'estado']
      },
      {
        name: 'idx_tickets_usuario',
        fields: ['usuario_creador_id']
      }
    ]
  }
);

export default {
  TicketsModel
};
