// Utils/mailer.js
/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 21 / 11 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Configuración centralizada de Nodemailer para el sistema Conectate.
 * Desde acá salen todos los correos (notificaciones, etc.).
 *
 * Tema: Utils - Email
 * Capa: Backend
 */

import nodemailer from 'nodemailer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// ── Cargar .env SIEMPRE desde la raíz del proyecto (no desde cwd)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Este archivo está en Utils/, la raíz es un nivel más arriba
const ROOT = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(ROOT, '.env') });

// ================= Constantes & Helpers =================
const TZ = 'America/Argentina/Buenos_Aires';

// Validación simple de email (suficiente para filtrar errores comunes)
export const isValidEmail = (s) =>
  typeof s === 'string' &&
  s.length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

// Escapar dinámicos (por si vienen caracteres HTML)
export const escapeHtml = (str = '') =>
  String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

export const formatARS = (n) =>
  Number(n || 0).toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS'
  });

/** Crea Date seguro desde 'YYYY-MM-DD' y lo muestra en es-AR con TZ AR */
export const formatFechaAR = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('es-AR', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

// Preheader oculto (para inbox preview)
export const preheader = (text) =>
  `<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;visibility:hidden;">${escapeHtml(
    text
  )}⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀</span>`;

/* ================= Transporter (pool + timeouts + DKIM opcional) ================= */
export const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'c1662169.ferozo.com',
  port: Number(process.env.MAIL_PORT || 465),
  secure: true, // 465 = SSL
  pool: true,
  maxConnections: Number(process.env.MAIL_MAX_CONN || 3),
  maxMessages: Number(process.env.MAIL_MAX_MSG || 100),
  connectionTimeout: Number(process.env.MAIL_CONN_TIMEOUT || 15_000),
  socketTimeout: Number(process.env.MAIL_SOCKET_TIMEOUT || 20_000),
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  },
  tls: {
    // 👇 clave para bypassear el problema de issuer en este servidor
    rejectUnauthorized: false
  },
  dkim: process.env.DKIM_DOMAIN
    ? {
        domainName: process.env.DKIM_DOMAIN,
        keySelector: process.env.DKIM_SELECTOR,
        privateKey: process.env.DKIM_PRIVATE_KEY?.replaceAll('\\n', '\n')
      }
    : undefined
});


// (Opcional) verificación al arrancar
export async function verifyMailer() {
  try {
    await transporter.verify();
    console.log('✉️  Mailer OK: conexión SMTP verificada.');
  } catch (e) {
    console.error('✉️  Mailer FAIL:', e.message);
  }
}

/**
 * Envoltorio cómodo para enviar mails.
 * Luego lo vamos a usar desde el servicio de notificaciones.
 */
export async function sendMail({ to, subject, html, text }) {
  if (!to) throw new Error('El campo "to" es obligatorio');
  if (!subject) throw new Error('El campo "subject" es obligatorio');

  const fromName = process.env.MAIL_FROM_NAME || 'Conectate - Notificaciones';
  const fromEmail =
    process.env.MAIL_FROM_EMAIL ||
    process.env.MAIL_USER ||
    'notificaciones@conectategroup.ar';

  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    html,
    text
  });

  console.log(`📧 Email enviado a ${to} (MessageId: ${info.messageId})`);
  return info;
}
