/**
 * emailToken.js
 * Shared Email Verification Helpers: One-Time Login Tokens
 * Federal Polytechnic, Ilaro - NBTE 4.0 Standard
 *
 * Configure via environment variables (or a local .env file):
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM
 */

// Load .env if present (do this before reading process.env)
try { require('dotenv').config({ path: '.env' }); } catch (_) { /* .env not required */ }

const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Configure SMTP transport for sending one-time login tokens
/**
 * Build the SMTP transport. Uses real SMTP credentials when available;
 * falls back to a fresh Ethereal test account so the OTP flow works in
 * development without a working mailbox.
 */
function buildMailTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user, pass }
    });
  }

<<<<<<< HEAD
  // No real SMTP config: use a disposable Ethereal account.
  // createTestAccount() is async; callers that need the transport at
  // module load time should be OK because Ethereal is only used as a
  // last resort and the OTP endpoints are async anyway.
=======
>>>>>>> dddfd06 (ui-course-email)
  return null;
}

let cachedTransport = null;
async function getMailTransport() {
  if (cachedTransport) return cachedTransport;
<<<<<<< HEAD
  const t = buildMailTransport();
  if (t) { cachedTransport = t; return t; }
=======

  const configured = buildMailTransport();
  if (configured) {
    // Verify the configured transport works; if it rejects credentials,
    // fall back to a fresh Ethereal account.
    try {
      await configured.verify();
      cachedTransport = configured;
      return cachedTransport;
    } catch (err) {
      console.warn('[EMAIL] SMTP transport rejected credentials, falling back to Ethereal:', err.message.slice(0, 80));
    }
  }
>>>>>>> dddfd06 (ui-course-email)

  const account = await nodemailer.createTestAccount();
  cachedTransport = nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: { user: account.user, pass: account.pass }
  });
  return cachedTransport;
}

/**
 * Generate a random 6-digit one-time token.
 */
function generateToken() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Send a one-time token to the student's email.
 *
 * @param {Object} student  - row from the students table (needs full_name, matric_no, email)
 * @param {string} token    - the random token
 * @param {string} [mode='verification'] - 'verification' (login) or 'reset' (password reset)
 */
async function sendLoginToken(student, token, mode = 'verification') {
<<<<<<< HEAD
=======
  const transport = await getMailTransport();
>>>>>>> dddfd06 (ui-course-email)
  const from = process.env.SMTP_FROM || 'no-reply@fpi.edu.ng';
  const isReset = mode === 'reset';

  const mailOptions = {
    from: `"Federal Polytechnic, Ilaro Result Checker" <${from}>`,
    to: student.email,
    subject: isReset
<<<<<<< HEAD
      ? 'Your Password Reset Code - Result Checker'
      : 'Your One-Time Login Code - Result Checker',
=======
      ? 'Your Password Reset Code - FPI Result Checker'
      : 'Your One-Time Login Code - FPI Result Checker',
>>>>>>> dddfd06 (ui-course-email)
    text: [
      `Hello ${student.full_name},`,
      '',
      isReset
        ? `A request was made to reset the password for matric number: ${student.matric_no}.`
        : `A request was made to view the academic result for matric number: ${student.matric_no}.`,
      '',
      `Your verification code is: ${token}`,
      '',
      isReset
        ? 'This code will expire in 30 minutes. If you did not request this, please ignore this email.'
        : 'This code will expire in 10 minutes. If you did not request this, please ignore this email.',
      '',
      '- Federal Polytechnic, Ilaro Result Checker System'
<<<<<<< HEAD
    ].join('\n')
  };

  await mailTransport.sendMail(mailOptions);
}

module.exports = { generateToken, sendLoginToken, mailTransport };
=======
    ].join('\n'),
    html: [
      '<div style="font-family: sans-serif; max-width: 600px;">',
      '<h2 style="margin-top: 0;">One-Time Verification Code</h2>',
      '<p>Hello ' + student.full_name + ',</p>',
      '<p>' + (isReset
        ? 'A request was made to reset the password for matric number: <strong>' + student.matric_no + '</strong>.'
        : 'A request was made to view the academic result for matric number: <strong>' + student.matric_no + '</strong>.') + '</p>',
      '<p style="font-size: 28px; font-weight: bold; letter-spacing: 4px; text-align: center; margin: 24px 0;">' + token + '</p>',
      '<p>' + (isReset
        ? 'This code will expire in 30 minutes. If you did not request this, please ignore this email.'
        : 'This code will expire in 10 minutes. If you did not request this, please ignore this email.') + '</p>',
      '<hr>',
      '<p style="color: #666; font-size: 12px;">- Federal Polytechnic, Ilaro Result Checker System</p>',
      '</div>'
    ].join('\n')
  };

  await transport.sendMail(mailOptions);
}

module.exports = { generateToken, sendLoginToken, getMailTransport };
>>>>>>> dddfd06 (ui-course-email)
