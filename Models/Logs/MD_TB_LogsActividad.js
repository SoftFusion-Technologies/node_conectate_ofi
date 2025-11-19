/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 19 / 11 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Modelo Sequelize para la tabla `logs_actividad`.
 * Registra acciones realizadas en el sistema (quién hizo qué, sobre qué entidad y cuándo),
 * pensado para auditoría y trazabilidad.
 *
 * Tema: Modelos - Logs / Auditoría
 * Capa: Backend
 */

import dotenv from 'dotenv';
import { DataTypes } from 'sequelize';
import db from '../../DataBase/db.js';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export const LogsActividadModel = db.define(
  'logs_actividad',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },

    usuario_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      comment: 'Usuario que realizó la acción (NULL si es proceso de sistema)'
    },

    modulo: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Módulo o sección del sistema (tickets, usuarios, auth, etc.)'
    },

    accion: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Acción realizada (CREAR_TICKET, CAMBIAR_ESTADO, LOGIN, etc.)'
    },

    entidad: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Entidad afectada (ticket, usuario, sucursal, etc.)'
    },

    entidad_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      comment: 'ID de la entidad afectada (ej: ticket_id, usuario_id)'
    },

    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Descripción legible del evento, útil para auditoría'
    },

    fecha_hora: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha y hora del evento'
    },

    ip: {
      type: DataTypes.STRING(45),
      allowNull: true,
      comment: 'IP desde donde se ejecutó la acción'
    },

    user_agent: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'User-Agent del cliente (navegador, etc.)'
    }
  },
  {
    tableName: 'logs_actividad',
    timestamps: false,
    comment:
      'Logs de actividad del sistema: quién hizo qué, sobre qué entidad y cuándo',
    indexes: [
      {
        name: 'idx_logs_modulo_fecha',
        fields: ['modulo', 'fecha_hora']
      },
      {
        name: 'idx_logs_usuario_fecha',
        fields: ['usuario_id', 'fecha_hora']
      },
      {
        name: 'idx_logs_entidad',
        fields: ['entidad', 'entidad_id']
      }
    ]
  }
);

export default {
  LogsActividadModel
};
