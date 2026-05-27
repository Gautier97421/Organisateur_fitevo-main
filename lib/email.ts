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
    tls: { rejectUnauthorized: false },
  })
}

export async function sendPasswordResetEmail(
  toEmail: string,
  resetUrl: string,
): Promise<void> {
  const transporter = getTransporter()
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@fitevo.app"

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

  if (!transporter) {
    // Pas de SMTP configuré — afficher le lien dans les logs (dev / démo)
    logger.info("=== RESET PASSWORD LINK (SMTP non configuré) ===")
    logger.info(`To: ${toEmail}`)
    logger.info(`URL: ${resetUrl}`)
    logger.info("================================================")
    return
  }

  try {
    await transporter.sendMail({
      from,
      to: toEmail,
      subject: "Réinitialisation de mot de passe – FitEvo",
      html,
    })
  } catch (smtpError) {
    logger.error("Échec envoi email SMTP", smtpError)
    // Fallback : afficher le lien dans les logs pour ne pas bloquer l'utilisateur
    logger.info("=== RESET PASSWORD LINK (fallback SMTP) ===")
    logger.info(`To: ${toEmail}`)
    logger.info(`URL: ${resetUrl}`)
    logger.info("===========================================")
  }
}
