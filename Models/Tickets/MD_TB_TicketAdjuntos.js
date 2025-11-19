/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 19 / 11 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Modelo Sequelize para la tabla `ticket_adjuntos`.
 * Guarda los archivos asociados a un ticket (imágenes de recibos, Excel de tareas, PDFs, etc.).
 *
 * Tema: Modelos - Tickets (Adjuntos)
 * Capa: Backend
 */

import dotenv from 'dotenv';
import { DataTypes } from 'sequelize';
import db from '../../DataBase/db.js';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export const TicketAdjuntosModel = db.define(
  'ticket_adjuntos',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },

    ticket_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      comment: 'Ticket al que pertenece el adjunto'
    },

    tipo: {
      type: DataTypes.ENUM('imagen', 'excel', 'pdf', 'otro'),
      allowNull: false,
      defaultValue: 'otro',
      comment: 'Clasificación funcional del adjunto'
    },

    nombre_original: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Nombre original del archivo subido por el usuario'
    },

    ruta_archivo: {
      type: DataTypes.STRING(500),
      allowNull: false,
      comment: 'Ruta relativa o URL donde se guarda el archivo'
    },

    mime_type: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment:
        'MIME type detectado (image/jpeg, application/vnd.ms-excel, etc.)'
    },

    tamano_bytes: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      comment: 'Tamaño del archivo en bytes'
    },

    es_principal: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: '0 = adjunto normal, 1 = marcado como principal o destacado'
    },

    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    tableName: 'ticket_adjuntos',
    timestamps: false, // solo manejamos created_at desde la BD
    comment:
      'Adjuntos de tickets (imágenes de recibos, Excel de tareas, otros archivos)',
    indexes: [
      {
        name: 'idx_ticket_adj_ticket',
        fields: ['ticket_id']
      },
      {
        name: 'idx_ticket_adj_tipo',
        fields: ['tipo']
      }
    ]
  }
);

export default {
  TicketAdjuntosModel
};
