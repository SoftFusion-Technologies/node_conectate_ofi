/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 19 / 11 /2025
 * Versión: 1.1
 *
 * Descripción:
 * Este archivo (routes.js) define las rutas HTTP para operaciones CRUD en las tablas
 *
 * Tema: Rutas
 *
 * Capa: Backend
 */

import express from 'express';
const router = express.Router();

import { authenticateToken } from '../Security/auth.js';
import { uploadTicketFiles } from '../Middlewares/uploadTickets.js';

// ----------------------------------------------------------------
// Importamos controladores de sucursales
// ----------------------------------------------------------------
import {
  OBRS_Sucursales_CTS,
  OBR_Sucursal_CTS,
  CR_Sucursal_CTS,
  ER_Sucursal_CTS,
  UR_Sucursal_CTS
} from '../Controllers/Core/CTS_TB_Sucursales.js';

// ----------------------------------------------------------------
// Importamos controladores de usuarios
// ----------------------------------------------------------------
import {
  OBRS_Usuarios_CTS,
  OBR_Usuario_CTS,
  CR_Usuario_CTS,
  ER_Usuario_CTS,
  UR_Usuario_CTS
} from '../Controllers/Core/CTS_TB_Usuarios.js';

// ----------------------------------------------------------------
// Importamos controladores de LOGS
// ----------------------------------------------------------------

import {
  OBRS_LogsActividad_CTS,
  OBR_LogActividad_CTS
} from '../Controllers/Logs/CTS_TB_LogsActividad.js';

// ----------------------------------------------------------------
// Importamos controladores de TICKETS
// ----------------------------------------------------------------

import {
  OBRS_Tickets_CTS,
  OBR_Ticket_CTS,
  CR_Ticket_CTS,
  UR_Ticket_CTS,
  ER_Ticket_CTS,
  CR_Ticket_CambiarEstado_CTS
} from '../Controllers/Tickets/CTS_TB_Tickets.js';

// ----------------------------------------------------------------
// Importamos controladores de TICKETS ADJUNTOS
// ----------------------------------------------------------------

import {
  OBRS_TicketAdjuntos_CTS,
  OBR_TicketAdjunto_CTS,
  CR_TicketAdjunto_CTS,
  ER_TicketAdjunto_CTS
} from '../Controllers/Tickets/CTS_TB_TicketAdjuntos.js';

// ----------------------------------------------------------------
// Rutas para operaciones CRUD en la tabla 'sucursales'
// ----------------------------------------------------------------

// Obtener todas las sucursales (con o sin paginado/filtros)
router.get('/sucursales', OBRS_Sucursales_CTS);

// Obtener una sucursal por ID
router.get('/sucursales/:id', OBR_Sucursal_CTS);

// Crear una nueva sucursal
router.post('/sucursales', CR_Sucursal_CTS);

// Eliminar una sucursal por ID
router.delete('/sucursales/:id', ER_Sucursal_CTS);

// Actualizar una sucursal por ID
router.put('/sucursales/:id', UR_Sucursal_CTS);

// ----------------------------------------------------------------
// Rutas para operaciones CRUD en la tabla 'usuarios'
// (todas protegidas con authenticateToken)
// ----------------------------------------------------------------

router.post('/usuarios', authenticateToken, CR_Usuario_CTS);
router.put('/usuarios/:id', authenticateToken, UR_Usuario_CTS);
router.delete('/usuarios/:id', authenticateToken, ER_Usuario_CTS);
router.get('/usuarios', authenticateToken, OBRS_Usuarios_CTS);
router.get('/usuarios/:id', authenticateToken, OBR_Usuario_CTS);

// ----------------------------------------------------------------
// Rutas para logs de actividad (auditoría)
// Solo accesibles con token (idealmente admin/supervisor)
// ----------------------------------------------------------------

router.get('/logs', authenticateToken, OBRS_LogsActividad_CTS);
router.get('/logs/:id', authenticateToken, OBR_LogActividad_CTS);

// ----------------------------------------------------------------
// Rutas para TICKETS
// Solo accesibles con token (idealmente admin/supervisor)
// ----------------------------------------------------------------


import {
  OBRS_TicketEstadosHistorial_CTS,
  OBR_TicketEstadoHistorial_CTS
} from '../Controllers/Tickets/CTS_TB_TicketEstadosHistorial.js';

// Historial global (sólo supervisor/admin idealmente)
router.get(
  '/tickets/historial',
  authenticateToken,
  OBRS_TicketEstadosHistorial_CTS
);

// Historial de un ticket puntual
router.get(
  '/tickets/:ticketId/historial',
  authenticateToken,
  OBRS_TicketEstadosHistorial_CTS
);

// Detalle de un registro de historial
router.get(
  '/tickets/historial/:id',
  authenticateToken,
  OBR_TicketEstadoHistorial_CTS
);

router.get('/tickets', authenticateToken, OBRS_Tickets_CTS);
router.get('/tickets/:id', authenticateToken, OBR_Ticket_CTS);
router.post('/tickets', authenticateToken, CR_Ticket_CTS);
router.put('/tickets/:id', authenticateToken, UR_Ticket_CTS);
router.delete('/tickets/:id', authenticateToken, ER_Ticket_CTS);
router.post(
  '/tickets/:id/cambiar-estado',
  authenticateToken,
  CR_Ticket_CambiarEstado_CTS
);


// ----------------------------------------------------------------
// Rutas para TICKETS ADJUNTOS
// Solo accesibles con token (idealmente admin/supervisor)
// ----------------------------------------------------------------

// Listar adjuntos de un ticket
router.get(
  '/tickets/:ticketId/adjuntos',
  authenticateToken,
  OBRS_TicketAdjuntos_CTS
);

// Obtener un adjunto puntual
router.get('/tickets/adjuntos/:id', authenticateToken, OBR_TicketAdjunto_CTS);

// Crear adjunto para un ticket (subida de archivo)
router.post(
  '/tickets/:ticketId/adjuntos',
  authenticateToken,
  uploadTicketFiles,
  CR_TicketAdjunto_CTS
);

// Eliminar adjunto
router.delete('/tickets/adjuntos/:id', authenticateToken, ER_TicketAdjunto_CTS);

import {
  OBRS_Notificaciones_CTS,
  OBR_Notificacion_CTS,
  CR_Notificacion_CTS,
  UR_Notificacion_MarcarLeida_CTS,
  ER_Notificacion_CTS,
  OBR_Notificaciones_Resumen_CTS
} from '../Controllers/Tickets/CTS_TB_Notificaciones.js';

router.get('/notificaciones', authenticateToken, OBRS_Notificaciones_CTS);

router.get('/notificaciones/:id', authenticateToken, OBR_Notificacion_CTS);

router.post('/notificaciones', authenticateToken, CR_Notificacion_CTS);

router.post(
  '/notificaciones/:id/marcar-leida',
  authenticateToken,
  UR_Notificacion_MarcarLeida_CTS
);

router.delete('/notificaciones/:id', authenticateToken, ER_Notificacion_CTS);

// Resumen de notificaciones (campanita)
router.get(
  '/notificaciones/resumen',
  authenticateToken,
  OBR_Notificaciones_Resumen_CTS
);
export default router;
