import nodemailer from "nodemailer"
import logger from "@/lib/logger"

function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    tls: {
      rejectUnauthorized: false,
      minVersion: "TLSv1",
    },
  })
}

async function dispatch(to: string | string[], subject: string, html: string): Promise<void> {
  const transporter = getTransporter()
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@fitevo.app"
  const recipients = Array.isArray(to) ? to.join(", ") : to

  if (!transporter) {
    logger.info(`=== EMAIL (SMTP non configuré) — ${subject} ===`)
    logger.info(`To: ${recipients}`)
    logger.info("================================================")
    return
  }

  try {
    await transporter.sendMail({ from, to: recipients, subject, html })
  } catch (smtpError) {
    logger.error("Échec envoi email SMTP", smtpError)
    logger.error(`Host: ${process.env.SMTP_HOST}  Port: ${process.env.SMTP_PORT}  To: ${recipients}`)
    throw smtpError
  }
}

export async function sendPasswordResetEmail(
  toEmail: string,
  resetUrl: string,
): Promise<void> {
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 16px">
      <h2 style="color:#dc2626;margin-bottom:8px">Réinitialisation de mot de passe</h2>
      <p style="color:#374151;margin-bottom:24px">
        Vous avez demandé à réinitialiser votre mot de passe FitEvo.<br/>
        Ce lien est valable <strong>1 heure</strong>.
      </p>
      <a href="${resetUrl}"
         style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
        Réinitialiser mon mot de passe
      </a>
      <p style="color:#6b7280;font-size:13px;margin-top:24px">
        Si vous n'avez pas fait cette demande, ignorez cet email.
        Votre mot de passe ne sera pas modifié.
      </p>
    </div>
  `
  await dispatch(toEmail, "Réinitialisation de mot de passe – FitEvo", html)
}

export async function sendWorkRecapEmail(data: {
  employeeName: string
  employeeEmail: string
  gymName: string
  period: string
  startTime: string
  endTime: string
  breakDuration: number
  tasksCompleted: number
  totalTasks: number
  cashTotal?: number
  adminEmails: string[]
}): Promise<void> {
  if (data.adminEmails.length === 0) return

  const periodLabel: Record<string, string> = {
    matin: "Matin",
    aprem: "Après-midi",
    journee: "Journée",
  }
  const periodDisplay = periodLabel[data.period] ?? data.period
  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
  const cashLine = data.cashTotal !== undefined
    ? `<tr><td style="padding:6px 0;color:#6b7280">Caisse totale</td><td style="padding:6px 0;font-weight:600;color:#111827">${data.cashTotal.toFixed(2)} €</td></tr>`
    : ""

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px">
      <h2 style="color:#dc2626;margin-bottom:4px">Fin de période – FitEvo</h2>
      <p style="color:#6b7280;margin-top:0;margin-bottom:24px">${today}</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <tr><td style="padding:6px 0;color:#6b7280">Employé</td><td style="padding:6px 0;font-weight:600;color:#111827">${data.employeeName} (${data.employeeEmail})</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Salle</td><td style="padding:6px 0;font-weight:600;color:#111827">${data.gymName}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Période</td><td style="padding:6px 0;font-weight:600;color:#111827">${periodDisplay}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Début</td><td style="padding:6px 0;font-weight:600;color:#111827">${data.startTime}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Fin</td><td style="padding:6px 0;font-weight:600;color:#111827">${data.endTime}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Pause</td><td style="padding:6px 0;font-weight:600;color:#111827">${data.breakDuration} min</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Tâches</td><td style="padding:6px 0;font-weight:600;color:#111827">${data.tasksCompleted} / ${data.totalTasks} complétées</td></tr>
        ${cashLine}
      </table>
      <p style="color:#6b7280;font-size:12px;margin-top:24px">Email automatique FitEvo — ne pas répondre.</p>
    </div>
  `
  await dispatch(data.adminEmails, `Fin de période – ${data.employeeName} (${periodDisplay})`, html)
}

export async function sendValidationOverdueEmail(data: {
  eventTitle: string
  eventDate: string
  recipientEmails: string[]
}): Promise<void> {
  if (data.recipientEmails.length === 0) return

  const dateDisplay = new Date(data.eventDate).toLocaleDateString("fr-FR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  })

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px">
      <div style="background:#f59e0b;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0">
        <h2 style="margin:0;font-size:18px">⏰ Validation en retard — FitEvo</h2>
      </div>
      <div style="border:1px solid #fcd34d;border-top:none;border-radius:0 0 8px 8px;padding:20px">
        <p style="color:#374151;margin-bottom:12px">
          L'événement planifié ci-dessous nécessitait une validation qui n'a pas été effectuée avant la fin de la journée prévue.
        </p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
          <tr><td style="padding:6px 0;color:#6b7280">Événement</td><td style="padding:6px 0;font-weight:600;color:#111827">${data.eventTitle}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Date prévue</td><td style="padding:6px 0;font-weight:600;color:#111827">${dateDisplay}</td></tr>
        </table>
        <p style="color:#92400e;background:#fffbeb;border:1px solid #fcd34d;padding:12px;border-radius:6px;font-size:14px">
          Veuillez contacter un responsable pour régulariser cette situation.
        </p>
        <p style="color:#6b7280;font-size:12px;margin-top:24px">Email automatique FitEvo — ne pas répondre.</p>
      </div>
    </div>
  `
  await dispatch(data.recipientEmails, `⏰ Validation en retard : ${data.eventTitle}`, html)
}

export async function sendEmergencyEmail(data: {
  employeeName: string
  employeeEmail: string
  message: string
  adminEmails: string[]
}): Promise<void> {
  if (data.adminEmails.length === 0) return

  const now = new Date().toLocaleString("fr-FR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })

  const msgBlock = data.message.trim()
    ? `<div style="background:#fff1f1;border-left:4px solid #dc2626;padding:12px 16px;border-radius:4px;margin-bottom:16px">
        <p style="margin:0;color:#374151;font-size:15px"><strong>Message :</strong><br/>${data.message.replace(/\n/g, "<br/>")}</p>
      </div>`
    : `<p style="color:#6b7280;font-style:italic">Aucun message fourni.</p>`

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px">
      <div style="background:#dc2626;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;display:flex;align-items:center;gap:12px">
        <span style="font-size:28px">⚠️</span>
        <div>
          <h2 style="margin:0;font-size:20px">Alerte d'urgence — FitEvo</h2>
          <p style="margin:4px 0 0;font-size:13px;opacity:0.85">${now}</p>
        </div>
      </div>
      <div style="border:1px solid #fca5a5;border-top:none;border-radius:0 0 8px 8px;padding:20px">
        <p style="color:#374151;margin-bottom:16px">
          L'employé <strong>${data.employeeName}</strong> (<a href="mailto:${data.employeeEmail}" style="color:#dc2626">${data.employeeEmail}</a>)
          a déclenché une alerte d'urgence.
        </p>
        ${msgBlock}
        <p style="color:#6b7280;font-size:12px;margin-top:24px;border-top:1px solid #f3f4f6;padding-top:12px">
          Email automatique FitEvo — ne pas répondre directement à cet email.
        </p>
      </div>
    </div>
  `
  await dispatch(data.adminEmails, `🚨 URGENCE – ${data.employeeName}`, html)
}

export async function sendEventReminderEmail(data: {
  eventTitle: string
  eventDate: string
  eventTime?: string
  eventLocation?: string
  customMessage?: string
  recipientEmails: string[]
}): Promise<void> {
  if (data.recipientEmails.length === 0) return

  const dateDisplay = new Date(data.eventDate).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
  const timeLine = data.eventTime
    ? `<p style="color:#374151;margin:4px 0"><strong>Heure :</strong> ${data.eventTime}</p>`
    : ""
  const locationLine = data.eventLocation
    ? `<p style="color:#374151;margin:4px 0"><strong>Lieu :</strong> ${data.eventLocation}</p>`
    : ""
  const customLine = data.customMessage
    ? `<p style="color:#374151;margin-top:16px;padding:12px;background:#f9fafb;border-left:4px solid #dc2626;border-radius:4px">${data.customMessage}</p>`
    : ""

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px">
      <h2 style="color:#dc2626;margin-bottom:8px">Rappel d'événement – FitEvo</h2>
      <h3 style="color:#111827;margin-top:0;margin-bottom:16px">${data.eventTitle}</h3>
      <p style="color:#374151;margin:4px 0"><strong>Date :</strong> ${dateDisplay}</p>
      ${timeLine}
      ${locationLine}
      ${customLine}
      <p style="color:#6b7280;font-size:12px;margin-top:24px">Email automatique FitEvo — ne pas répondre.</p>
    </div>
  `
  await dispatch(data.recipientEmails, `Rappel : ${data.eventTitle}`, html)
}

