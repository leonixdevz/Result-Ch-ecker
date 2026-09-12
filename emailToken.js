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

  // No real SMTP config: use a disposable Ethereal account.
  // createTestAccount() is async; callers that need the transport at
  // module load time should be OK because Ethereal is only used as a
  // last resort and the OTP endpoints are async anyway.
  return null;
}

let cachedTransport = null;
async function getMailTransport() {
  if (cachedTransport) return cachedTransport;
  const t = buildMailTransport();
  if (t) { cachedTransport = t; return t; }

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
  const from = process.env.SMTP_FROM || 'no-reply@fpi.edu.ng';
  const isReset = mode === 'reset';

  const mailOptions = {
    from: `"Federal Polytechnic, Ilaro Result Checker" <${from}>`,
    to: student.email,
    subject: isReset
      ? 'Your Password Reset Code - Result Checker'
      : 'Your One-Time Login Code - Result Checker',
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
    ].join('\n')
  };

  await mailTransport.sendMail(mailOptions);
}

module.exports = { generateToken, sendLoginToken, mailTransport };
