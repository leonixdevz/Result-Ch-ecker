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
<<<<<<< HEAD
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
=======
async function getTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    const t = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user, pass }
    });
    try {
      await t.verify();
      return t;
    } catch (err) {
      console.warn('[EMAIL] SMTP creds rejected, falling back to Ethereal:', err.message.slice(0, 80));
    }
  }

  // Fallback: Ethereal test account (works without real credentials)
  const account = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: { user: account.user, pass: account.pass }
  });
}

async function main() {
  const isEthereal = !process.env.SMTP_USER || !process.env.SMTP_PASS;
  const transport = await getTransport();
  const from = process.env.SMTP_FROM || 'no-reply@fpi.edu.ng';

  // When using Ethereal, send to its test account so we get a preview URL.
  const to = isEthereal
    ? (await nodemailer.createTestAccount()).user
    : (process.env.SMTP_USER || 'no-reply@fpi.edu.ng');

  const info = await transport.sendMail({
    from: `"Federal Polytechnic, Ilaro Result Checker" <${from}>`,
    to,
    subject: 'Test: FPI Result Checker Email',
>>>>>>> dddfd06 (ui-course-email)
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
<<<<<<< HEAD
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
=======
      '<div style="font-family: sans-serif; max-width: 600px;">',
      '<h2>Test Email</h2>',
      '<p>This is a test email from the FPI Student Result Checker system.</p>',
      '<p>If you received this, the email configuration is working correctly.</p>',
      '<p>Login verification codes and password-reset codes will now be sent to students.</p>',
      '<hr>',
      '<p style="color: #666; font-size: 12px;">- FPI Result Checker System</p>',
      '</div>'
>>>>>>> dddfd06 (ui-course-email)
    ].join('\n')
  });

  console.log('Message sent: %s', info.messageId);
<<<<<<< HEAD
  console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info) || '(no preview URL available)');
=======
  if (isEthereal) {
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    console.log('(Using Ethereal test account - no real SMTP creds configured)');
  }
>>>>>>> dddfd06 (ui-course-email)
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
