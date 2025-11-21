/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 19 / 11 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Archivo central de relaciones entre modelos Sequelize
 * para el sistema interno de tickets Conectate.
 *
 * Aquí se definen TODAS las asociaciones (hasMany, belongsTo, etc.)
 * dejando los modelos limpios, sin relaciones internas.
 *
 * Tema: Modelos - Relaciones
 * Capa: Backend
 */

import { UsuariosModel } from './Core/MD_TB_Usuarios.js';
import { SucursalesModel } from './Core/MD_TB_Sucursales.js';

import { TicketsModel } from './Tickets/MD_TB_Tickets.js';
import { TicketAdjuntosModel } from './Tickets/MD_TB_TicketAdjuntos.js';
import { TicketEstadosHistorialModel } from './Tickets/MD_TB_TicketEstadosHistorial.js';
import { NotificacionesModel } from './Tickets/MD_TB_Notificaciones.js';

import { LogsActividadModel } from './Logs/MD_TB_LogsActividad.js';

/**
 * Función que inicializa todas las relaciones entre modelos.
 * Llamarla una sola vez al iniciar la app (por ejemplo en app.js o server.js).
 */
export const initModelRelations = () => {
  // ============================
  // CORE: Usuarios ↔ Sucursales
  // ============================

  // Usuario pertenece a una sucursal base (puede ser NULL para supervisor/admin)
  UsuariosModel.belongsTo(SucursalesModel, {
    foreignKey: 'sucursal_id',
    as: 'sucursal'
  });

  // Una sucursal puede tener muchos usuarios asociados (operadores)
  SucursalesModel.hasMany(UsuariosModel, {
    foreignKey: 'sucursal_id',
    as: 'usuarios'
  });

  // ============================
  // TICKETS: Tickets ↔ Sucursales / Usuarios
  // ============================

  // Ticket pertenece a una sucursal
  TicketsModel.belongsTo(SucursalesModel, {
    foreignKey: 'sucursal_id',
    as: 'sucursal'
  });

  // Sucursal tiene muchos tickets
  SucursalesModel.hasMany(TicketsModel, {
    foreignKey: 'sucursal_id',
    as: 'tickets'
  });

  // Ticket pertenece a un usuario creador
  TicketsModel.belongsTo(UsuariosModel, {
    foreignKey: 'usuario_creador_id',
    as: 'creador'
  });

  // Usuario puede haber creado muchos tickets
  UsuariosModel.hasMany(TicketsModel, {
    foreignKey: 'usuario_creador_id',
    as: 'tickets_creados'
  });

  // ============================
  // TICKETS: Tickets ↔ Adjuntos
  // ============================

  // Ticket tiene muchos adjuntos
  TicketsModel.hasMany(TicketAdjuntosModel, {
    foreignKey: 'ticket_id',
    as: 'adjuntos'
  });

  // Adjunto pertenece a un ticket
  TicketAdjuntosModel.belongsTo(TicketsModel, {
    foreignKey: 'ticket_id',
    as: 'ticket'
  });

  // ============================
  // TICKETS: Tickets ↔ Historial de estados
  // ============================

  // Ticket tiene muchos cambios de estado
  TicketsModel.hasMany(TicketEstadosHistorialModel, {
    foreignKey: 'ticket_id',
    as: 'historial_estados'
  });

  // Cambio de estado pertenece a un ticket
  TicketEstadosHistorialModel.belongsTo(TicketsModel, {
    foreignKey: 'ticket_id',
    as: 'ticket'
  });

  // Usuario realiza muchos cambios de estado
  UsuariosModel.hasMany(TicketEstadosHistorialModel, {
    foreignKey: 'usuario_id',
    as: 'cambios_estado'
  });

  // Cambio de estado pertenece a un usuario
  TicketEstadosHistorialModel.belongsTo(UsuariosModel, {
    foreignKey: 'usuario_id',
    as: 'usuario'
  });

  // ============================
  // TICKETS: Notificaciones
  // ============================

  // Ticket tiene muchas notificaciones asociadas
  TicketsModel.hasMany(NotificacionesModel, {
    foreignKey: 'ticket_id',
    as: 'notificaciones'
  });

  // Notificación pertenece a un ticket
  NotificacionesModel.belongsTo(TicketsModel, {
    foreignKey: 'ticket_id',
    as: 'ticket'
  });

  // Usuario puede ser origen de muchas notificaciones
  UsuariosModel.hasMany(NotificacionesModel, {
    foreignKey: 'usuario_origen_id',
    as: 'notificaciones_enviadas'
  });

  // 🔵 Alias para ORIGEN → "origen"
  NotificacionesModel.belongsTo(UsuariosModel, {
    foreignKey: 'usuario_origen_id',
    as: 'origen'
  });

  // Usuario puede recibir muchas notificaciones
  UsuariosModel.hasMany(NotificacionesModel, {
    foreignKey: 'usuario_destino_id',
    as: 'notificaciones_recibidas'
  });

  // 🔵 Alias para DESTINO → "destino"
  NotificacionesModel.belongsTo(UsuariosModel, {
    foreignKey: 'usuario_destino_id',
    as: 'destino'
  });

  // ============================
  // LOGS: LogsActividad ↔ Usuarios
  // ============================

  // Usuario tiene muchos logs
  UsuariosModel.hasMany(LogsActividadModel, {
    foreignKey: 'usuario_id',
    as: 'logs_actividad'
  });

  // Log pertenece a un usuario (puede ser NULL si es proceso de sistema)
  LogsActividadModel.belongsTo(UsuariosModel, {
    foreignKey: 'usuario_id',
    as: 'usuario'
  });
};
