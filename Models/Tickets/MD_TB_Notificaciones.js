/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 19 / 11 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Modelo Sequelize para la tabla `notificaciones`.
 * Registra las notificaciones internas/externas relacionadas a tickets
 * y acciones de usuarios (creación, cierre, rechazo, etc.).
 *
 * Tema: Modelos - Tickets (Notificaciones)
 * Capa: Backend
 */

import dotenv from 'dotenv';
import { DataTypes } from 'sequelize';
import db from '../../DataBase/db.js';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export const NotificacionesModel = db.define(
  'notificaciones',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },

    ticket_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      comment: 'Ticket asociado a la notificación (si aplica)'
    },

    usuario_origen_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      comment: 'Quién generó la notificación (NULL si es el sistema)'
    },

    usuario_destino_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      comment: 'Usuario que debe recibir/ver la notificación'
    },

    canal: {
      type: DataTypes.ENUM('interno', 'email', 'whatsapp', 'otro'),
      allowNull: false,
      defaultValue: 'interno',
      comment: 'Canal por el cual se envía o muestra la notificación'
    },

    asunto: {
      type: DataTypes.STRING(150),
      allowNull: false,
      comment: 'Título breve de la notificación'
    },

    mensaje: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Mensaje completo de la notificación'
    },

    estado_envio: {
      type: DataTypes.ENUM('pendiente', 'enviado', 'error'),
      allowNull: false,
      defaultValue: 'pendiente',
      comment:
        'Estado del envío (para email/whatsapp); para interno puede quedar siempre en enviado'
    },

    fecha_creacion: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha/hora de creación de la notificación'
    },

    fecha_envio: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha/hora efectiva de envío (para canales externos)'
    },

    fecha_lectura: {
      type: DataTypes.DATE,
      allowNull: true,
      comment:
        'Fecha/hora en que el usuario abrió/leyó la notificación (para canal interno)'
    }
  },
  {
    tableName: 'notificaciones',
    timestamps: false,
    comment:
      'Notificaciones internas y externas relacionadas a tickets y acciones de usuarios',
    indexes: [
      {
        name: 'idx_notif_destino_estado',
        fields: ['usuario_destino_id', 'estado_envio']
      },
      {
        name: 'idx_notif_ticket',
        fields: ['ticket_id']
      }
    ]
  }
);

export default {
  NotificacionesModel
};
