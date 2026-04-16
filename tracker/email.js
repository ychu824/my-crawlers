const nodemailer = require('nodemailer');
const logger = require('./logger');

// configuration can come from environment variables
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 25,
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  } : undefined
});

async function sendEmail(to, subject, text) {
  const recipients = (Array.isArray(to) ? to : String(to).split(','))
    .map(addr => addr.trim())
    .filter(Boolean);

  await Promise.all(recipients.map(async (recipient) => {
    try {
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@example.com',
        to: recipient,
        subject,
        text
      });
      logger.info('Email sent', { to: recipient, subject, info });
    } catch (err) {
      logger.error('Failed to send email', { to: recipient, error: err.message });
    }
  }));
}

module.exports = { sendEmail };