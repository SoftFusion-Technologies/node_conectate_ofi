/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 19 / 11 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Modelo Sequelize para la tabla `ticket_estados_historial`.
 * Registra el historial de cambios de estado de cada ticket:
 * quién cambió, de qué estado a cuál, cuándo y con qué comentario.
 *
 * Tema: Modelos - Tickets (Historial de Estados)
 * Capa: Backend
 */

import dotenv from 'dotenv';
import { DataTypes } from 'sequelize';
import db from '../../DataBase/db.js';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export const TicketEstadosHistorialModel = db.define(
  'ticket_estados_historial',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },

    ticket_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      comment: 'Ticket al que corresponde el cambio de estado'
    },

    estado_anterior: {
      type: DataTypes.ENUM(
        'abierto',
        'pendiente',
        'autorizado',
        'rechazado',
        'cerrado'
      ),
      allowNull: true,
      comment: 'Estado previo (NULL si es el primer registro de estado)'
    },

    estado_nuevo: {
      type: DataTypes.ENUM(
        'abierto',
        'pendiente',
        'autorizado',
        'rechazado',
        'cerrado'
      ),
      allowNull: false,
      comment: 'Nuevo estado aplicado al ticket'
    },

    usuario_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      comment: 'Usuario que realizó el cambio de estado'
    },

    comentario: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Motivo del cambio, observaciones, motivo de rechazo, etc.'
    },

    fecha_cambio: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha y hora del cambio de estado'
    }
  },
  {
    tableName: 'ticket_estados_historial',
    timestamps: false,
    comment: 'Historial de cambios de estado de cada ticket',
    indexes: [
      {
        name: 'idx_hist_ticket',
        fields: ['ticket_id']
      },
      {
        name: 'idx_hist_fecha',
        fields: ['fecha_cambio']
      },
      {
        name: 'idx_hist_estado',
        fields: ['estado_nuevo']
      }
    ]
  }
);

export default {
  TicketEstadosHistorialModel
};
