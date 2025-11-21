// Utils/ticketMailService.js
/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 21 / 11 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Servicio de mails específicos del módulo de Tickets.
 * Incluye plantillas modernas para notificar creación de tickets.
 *
 * Tema: Utils - Email / Tickets
 * Capa: Backend
 */

import { sendMail, escapeHtml, preheader } from './mailer.js';

const TZ = 'America/Argentina/Buenos_Aires';

function formatDateTimeAR(date) {
  if (!date) return '';
  return new Date(date).toLocaleString('es-AR', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Construye subject, texto plano y HTML para "Nuevo ticket creado".
 *
 * @param {Object} params
 * @param {Object} params.ticket      - Ticket (id, asunto, estado, created_at, fecha_ticket, hora_ticket, etc.)
 * @param {Object} params.operador    - Usuario que creó el ticket (nombre, email)
 * @param {Object} params.sucursal    - Sucursal (nombre, ciudad)
 * @param {Object} params.destinatario- Usuario que va a recibir el mail (nombre, email)
 * @returns {{ subject: string, text: string, html: string }}
 */
export function buildTicketCreatedEmail({
  ticket,
  operador,
  sucursal,
  destinatario
}) {
  const ticketId = ticket.id;
  const asuntoTicket = ticket.asunto || '(sin asunto)';
  const estadoTicket = ticket.estado || 'pendiente';

  const operadorNombre = operador?.nombre || 'Operador';
  const operadorEmail = operador?.email || '';

  const sucNombre = sucursal?.nombre || 'Sucursal';
  const sucCiudad = sucursal?.ciudad ? ` (${sucursal.ciudad})` : '';

  const destNombre = destinatario?.nombre || '';
  const frontendBase =
    process.env.FRONTEND_BASE_URL || 'https://conectategroup.ar/conectate';

  const urlTicket = `${frontendBase.replace(/\/$/, '')}/tickets/${ticketId}`;

  // Fecha de creación del ticket (usamos created_at si viene, o fecha_ticket + hora_ticket)
  let fechaCreacion = '';
  if (ticket.created_at) {
    fechaCreacion = formatDateTimeAR(ticket.created_at);
  } else if (ticket.fecha_ticket || ticket.hora_ticket) {
    const baseDate = ticket.fecha_ticket || new Date();
    const iso = `${baseDate}T${ticket.hora_ticket || '00:00:00'}`;
    fechaCreacion = formatDateTimeAR(iso);
  }

  const preheaderText = `Nuevo ticket #${ticketId} creado por ${operadorNombre} (${sucNombre}).`;

  // Texto plano (fallback)
  const text = [
    `Nuevo ticket #${ticketId} creado`,
    '',
    `El operador ${operadorNombre} creó el ticket #${ticketId} en la sucursal ${sucNombre}${sucCiudad},`,
    `con estado "${estadoTicket}" y asunto "${asuntoTicket}".`,
    '',
    `Creado: ${fechaCreacion}`,
    `Enlace: ${urlTicket}`,
    '',
    'Este es un mensaje automático del sistema Conectate Ticket.'
  ].join('\n');

  // HTML moderno, claro, con acento rojo corporativo
  const html = `
  <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    ${preheader(preheaderText)}
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:24px 0;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:640px;background-color:#ffffff;border-radius:12px;border:1px solid #e5e7eb;box-shadow:0 12px 30px rgba(15,23,42,0.08);overflow:hidden;">

            <!-- Header -->
            <tr>
              <td style="padding:16px 24px;border-bottom:1px solid #f3f4f6;background:linear-gradient(90deg,#fca5a5,#ef4444);">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td style="color:#fef2f2;font-size:18px;font-weight:600;">
                      Conectate Group · Ticket nuevo
                    </td>
                    <td align="right" style="font-size:11px;color:#fee2e2;">
                      #${escapeHtml(String(ticketId))}
                    </td>
                  </tr>
                  <tr>
                    <td colspan="2" style="padding-top:4px;font-size:11px;color:#fee2e2;">
                      Notificación automática de mesa de ayuda interna
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Cuerpo -->
            <tr>
              <td style="padding:22px 24px 10px 24px;color:#111827;">
                ${
                  destNombre
                    ? `<p style="margin:0 0 10px 0;font-size:16px;">Hola ${escapeHtml(
                        destNombre
                      )},</p>`
                    : `<p style="margin:0 0 10px 0;font-size:16px;">Hola,</p>`
                }

                <p style="margin:0 0 16px 0;font-size:14px;color:#4b5563;line-height:1.6;">
                  Se ha registrado un nuevo ticket en el sistema <strong>Conectate</strong>.
                  A continuación te compartimos un resumen de la solicitud.
                </p>

                <!-- Tarjeta de resumen -->
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 18px 0;border-collapse:collapse;border-radius:10px;border:1px solid #fee2e2;background-color:#fff7f7;">
                  <tr>
                    <td style="padding:10px 14px 6px 14px;border-bottom:1px solid #fee2e2;">
                      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                        <tr>
                          <td style="font-size:13px;color:#b91c1c;font-weight:600;">
                            Ticket #${escapeHtml(String(ticketId))}
                          </td>
                          <td align="right">
                            <span style="display:inline-block;padding:2px 10px;border-radius:999px;background-color:#fee2e2;color:#b91c1c;font-size:11px;font-weight:600;border:1px solid #fecaca;">
                              ${escapeHtml(estadoTicket)}
                            </span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:10px 14px;">
                      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
                        <tr>
                          <td style="padding:4px 0;font-size:12px;color:#6b7280;width:32%;">Sucursal</td>
                          <td style="padding:4px 0;font-size:13px;color:#111827;">
                            ${escapeHtml(sucNombre)}${escapeHtml(sucCiudad)}
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:4px 0;font-size:12px;color:#6b7280;">Operador</td>
                          <td style="padding:4px 0;font-size:13px;color:#111827;">
                            ${escapeHtml(operadorNombre)}${
    operadorEmail
      ? ` <span style="color:#6b7280;font-size:12px;">(${escapeHtml(
          operadorEmail
        )})</span>`
      : ''
  }
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:4px 0;font-size:12px;color:#6b7280;">Fecha/Hora</td>
                          <td style="padding:4px 0;font-size:13px;color:#111827;">
                            ${escapeHtml(fechaCreacion)}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- Asunto -->
                <div style="margin:0 0 18px 0;">
                  <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">
                    Asunto del ticket
                  </div>
                  <div style="padding:10px 12px;border-radius:8px;background-color:#f9fafb;border:1px solid #e5e7eb;font-size:14px;color:#111827;">
                    “${escapeHtml(asuntoTicket)}”
                  </div>
                </div>

                <!-- Botón -->
                <div style="margin-top:18px;margin-bottom:10px;" align="center">
                  <a href="${escapeHtml(urlTicket)}"
                    style="display:inline-block;padding:11px 24px;border-radius:999px;background-color:#dc2626;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;border:1px solid #b91c1c;">
                    Ver ticket #${escapeHtml(String(ticketId))}
                  </a>
                </div>

                <p style="margin-top:14px;font-size:12px;color:#6b7280;text-align:center;line-height:1.5;">
                  Si el botón no funciona, copiá y pegá este enlace en tu navegador:<br/>
                  <span style="color:#dc2626;">${escapeHtml(urlTicket)}</span>
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:12px 24px 16px 24px;border-top:1px solid #e5e7eb;background-color:#f9fafb;">
                <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;line-height:1.4;">
                  Este es un mensaje automático del sistema interno de tickets Conectate.<br/>
                  Por favor, no respondas a este correo.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
  `;

  const subject = `🔔 Nuevo ticket #${ticketId} - ${asuntoTicket}`;

  return { subject, text, html };
}


/**
 * Envía el mail de "Nuevo ticket creado" a un destinatario.
 *
 * @param {Object} params
 * @param {Object} params.ticket
 * @param {Object} params.operador
 * @param {Object} params.sucursal
 * @param {Object} params.destinatario  - Debe tener al menos { email, nombre }
 */
export async function sendTicketCreatedMail({
  ticket,
  operador,
  sucursal,
  destinatario
}) {
  if (!destinatario?.email) {
    throw new Error('El destinatario no tiene email definido.');
  }

  const { subject, text, html } = buildTicketCreatedEmail({
    ticket,
    operador,
    sucursal,
    destinatario
  });

  return sendMail({
    to: destinatario.email,
    subject,
    text,
    html
  });
}
