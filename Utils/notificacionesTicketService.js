// Utils/notificacionesTicketService.js
/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 21 / 11 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Servicio de notificaciones asociadas a Tickets.
 * Crea notificaciones internas y por email cuando se crea un ticket.
 *
 * Tema: Utils - Notificaciones / Tickets
 * Capa: Backend
 */
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { TicketsModel } from '../Models/Tickets/MD_TB_Tickets.js';
import { UsuariosModel } from '../Models/Core/MD_TB_Usuarios.js';
import { SucursalesModel } from '../Models/Core/MD_TB_Sucursales.js';
import { NotificacionesModel } from '../Models/Tickets/MD_TB_Notificaciones.js';
import { sendTicketCreatedMail } from './ticketMailService.js';

/**
 * Construye el asunto de la notificación para ticket creado.
 */
function buildAsuntoTicketCreado(ticket) {
  return `Nuevo ticket #${ticket.id} creado`;
}

/**
 * Construye el mensaje plano de notificación (lo que ves en el Centro de notificaciones).
 * Respeta el estilo de ejemplo:
 *
 * El operador X creó el ticket #8 en la sucursal SAN MIGUEL (San Miguel), con estado "pendiente" y asunto "PRUEBA".
 *
 * Creada: 21/11/2025, 11:49:45
 * Canal: interno
 * Ticket #8
 */
function buildMensajeTicketCreado({ ticket, operador, sucursal, canalTexto }) {
  const operadorNombre = operador?.nombre || 'Operador';
  const sucNombre = sucursal?.nombre || 'Sucursal';
  const sucCiudad = sucursal?.ciudad ? ` (${sucursal.ciudad})` : '';

  // Fecha/hora de creación del ticket
  const fechaCreacion = ticket.created_at || new Date(); // fallback, idealmente viene de la columna created_at de la DB

  const fechaFormateada = format(fechaCreacion, 'dd/MM/yyyy, HH:mm:ss', {
    locale: es
  });

  const estado = ticket.estado || 'pendiente';
  const asuntoTicket = ticket.asunto || '(sin asunto)';

  return (
    `El operador ${operadorNombre} creó el ticket #${ticket.id} en la sucursal ${sucNombre}${sucCiudad}, ` +
    `con estado "${estado}" y asunto "${asuntoTicket}".\n\n` +
    `Creada: ${fechaFormateada}\n` +
    `Canal: ${canalTexto}\n` +
    `Ticket #${ticket.id}`
  );
}

/**
 * Regla de negocio:
 *  - Notificación interna: operador creador + todos los supervisores activos con email
 *  - Email: solo supervisores activos con email (independiente de sucursal)
 */
async function obtenerDestinatariosTicketCreado({ ticket, transaction }) {
  // Operador creador
  const operador = await UsuariosModel.findByPk(ticket.usuario_creador_id, {
    transaction
  });

  // Supervisores activos (sin importar sucursal)
  const supervisores = await UsuariosModel.findAll({
    where: {
      rol: 'supervisor',
      estado: 'activo'
    },
    transaction
  });

  // Destinatarios internos = operador + supervisores (si tienen email), sin duplicados
  const destinatariosInternos = [
    ...(operador ? [operador] : []),
    ...supervisores
  ]
    .filter((u) => !!u.email)
    .filter((u, index, arr) => arr.findIndex((x) => x.id === u.id) === index);

  // Destinatarios email = solo supervisores con email (sin duplicados)
  const destinatariosEmail = supervisores
    .filter((u) => !!u.email)
    .filter((u, index, arr) => arr.findIndex((x) => x.id === u.id) === index);

  return { operador, supervisores, destinatariosInternos, destinatariosEmail };
}

/**
 * Crea las notificaciones para "ticket creado":
 *  - una notificación interna (canal = 'interno') por destinatario
 *  - una notificación email (canal = 'email') por destinatario (estado_envio = 'pendiente')
 *
 * Debe llamarse DENTRO de la misma transacción donde se crea el ticket.
 */
export async function crearNotificacionesPorTicketCreado({
  ticket,
  transaction
}) {
  // Recuperamos sucursal y destinatarios
  const sucursal = await SucursalesModel.findByPk(ticket.sucursal_id, {
    transaction
  });
  const { operador, destinatariosInternos, destinatariosEmail } =
    await obtenerDestinatariosTicketCreado({
      ticket,
      transaction
    });

  const asunto = buildAsuntoTicketCreado(ticket);

  const notifsCreadas = [];

  // 🔹 1) Notificaciones internas (operador + supervisores)
  for (const dest of destinatariosInternos) {
    const mensajeInterno = buildMensajeTicketCreado({
      ticket,
      operador,
      sucursal,
      canalTexto: 'interno'
    });

    const notifInterna = await NotificacionesModel.create(
      {
        ticket_id: ticket.id,
        usuario_origen_id: operador?.id || null,
        usuario_destino_id: dest.id,
        canal: 'interno',
        asunto,
        mensaje: mensajeInterno,
        estado_envio: 'enviado' // interno no depende de SMTP
      },
      { transaction }
    );

    notifsCreadas.push(notifInterna);
  }

  // 🔹 2) Notificaciones de email (SOLO supervisores)
  for (const dest of destinatariosEmail) {
    const mensajeEmail = buildMensajeTicketCreado({
      ticket,
      operador,
      sucursal,
      canalTexto: 'email'
    });

    const notifEmail = await NotificacionesModel.create(
      {
        ticket_id: ticket.id,
        usuario_origen_id: operador?.id || null,
        usuario_destino_id: dest.id,
        canal: 'email',
        asunto,
        mensaje: mensajeEmail,
        estado_envio: 'pendiente' // será enviada luego por SMTP
      },
      { transaction }
    );

    notifsCreadas.push(notifEmail);
  }

  console.log('[Notifs Ticket]', {
    ticketId: ticket.id,
    internos: destinatariosInternos.map((u) => ({
      id: u.id,
      email: u.email,
      rol: u.rol
    })),
    email: destinatariosEmail.map((u) => ({
      id: u.id,
      email: u.email,
      rol: u.rol
    }))
  });

  return {
    sucursal,
    operador,
    destinatariosInternos,
    destinatariosEmail,
    notifsCreadas
  };
}

/**
 * Envía los emails asociados a las notificaciones de tipo "ticket creado"
 * para un ticket dado. Toma todas las notificaciones:
 *  - canal = 'email'
 *  - estado_envio = 'pendiente'
 *  - ticket_id = ticketId
 *
 * y por cada una arma el mail y lo envía.
 */
export async function enviarEmailsPorTicketCreado(ticketId) {
  // Cargamos el ticket con datos básicos
  const ticket = await TicketsModel.findByPk(ticketId);
  if (!ticket) {
    console.warn(
      `enviarEmailsPorTicketCreado: ticket ${ticketId} no encontrado.`
    );
    return;
  }

  // Operador y sucursal
  const operador = await UsuariosModel.findByPk(ticket.usuario_creador_id);
  const sucursal = await SucursalesModel.findByPk(ticket.sucursal_id);

  // Notificaciones pendientes para este ticket
  const notifsPendientes = await NotificacionesModel.findAll({
    where: {
      ticket_id: ticketId,
      canal: 'email',
      estado_envio: 'pendiente'
    }
  });

  if (!notifsPendientes.length) {
    console.log(
      `enviarEmailsPorTicketCreado: no hay notificaciones de email pendientes para ticket ${ticketId}.`
    );
    return;
  }

  for (const notif of notifsPendientes) {
    try {
      const destinatario = await UsuariosModel.findByPk(
        notif.usuario_destino_id
      );
      if (!destinatario || !destinatario.email) {
        console.warn(
          `Notificación ${notif.id}: destinatario sin email, se marca como error.`
        );
        await notif.update({
          estado_envio: 'error',
          fecha_envio: new Date()
        });
        continue;
      }

      await sendTicketCreatedMail({
        ticket,
        operador,
        sucursal,
        destinatario
      });

      await notif.update({
        estado_envio: 'enviado',
        fecha_envio: new Date()
      });
    } catch (error) {
      console.error(
        `Error enviando email de notificación ${notif.id} para ticket ${ticketId}:`,
        error.message
      );
      await notif.update({
        estado_envio: 'error',
        fecha_envio: new Date()
      });
    }
  }
}
