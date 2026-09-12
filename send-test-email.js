/**
 * send-test-email.js
 * One-off test: send a real email through the configured SMTP (Gmail).
 *
 * Usage: node send-test-email.js
 *
 * Relies on .env (SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM).
 * Uses the same mailTransport factory as emailToken.js.
 */
require('dotenv').config();
const nodemailer = require('nodemailer');

// Replicate the transport config from emailToken.js so we test the exact same setup.
const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true', // false = STARTTLS on 587
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
});

async function main() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('Missing SMTP_USER or SMTP_PASS in .env. Please fill them in.');
    process.exit(1);
  }

  const from = process.env.SMTP_FROM || `"Federal Polytechnic, Ilaro Result Checker" <no-reply@fpi.edu.ng>`;
  const to = process.env.SMTP_USER; // send the test to the same account (easiest to verify)

  const info = await transport.sendMail({
    from,
    to,
    subject: 'Test: Federal Polytechnic Ilaro Result Checker Email',
    text: [
      'Hello,',
      '',
      'This is a test email from the FPI Student Result Checker system.',
      '',
      'If you received this, the email configuration is working correctly.',
      'Login verification codes and password-reset codes will now be sent to students.',
      '',
      '- FPI Result Checker System'
    ].join('\n'),
    html: [
      '<pre style="font-family: sans-serif;">',
      'Hello,',
      '',
      'This is a test email from the FPI Student Result Checker system.',
      '',
      'If you received this, the email configuration is working correctly.',
      'Login verification codes and password-reset codes will now be sent to students.',
      '',
      '- FPI Result Checker System',
      '</pre>'
    ].join('\n')
  });

  console.log('Message sent: %s', info.messageId);
  console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info) || '(no preview URL available)');
  console.log('To: %s', to);
  console.log('From: %s', from);
}

main().catch(err => {
  console.error('Failed to send test email:', err.message);
  if (err.response) {
    console.error('SMTP response:', err.response);
  }
  process.exit(1);
});
