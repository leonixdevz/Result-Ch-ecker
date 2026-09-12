/** * student-server.js * Student-Only Express Server: Result Checker & Admission Screening * Federal Polytechnic, Ilaro - NBTE 4.0 Standard */

const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const { db, getNBTEGradeAndPoint, getNBTEClassification, parseFPIMatric } = require('../database');
const { INSTITUTIONS, evaluateAdmissionEligibility } = require('../screening');
const { generateToken, sendLoginToken } = require('../emailToken');

const app = express();
<<<<<<< HEAD
const PORT = process.env.STUDENT_PORT || 3000;
=======
const PORT = process.env.STUDENT_PORT || 3006;
>>>>>>> dddfd06 (ui-course-email)

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static assets from 'public' directory (student views only)
app.use(express.static(path.join(__dirname, 'public')));

// Student home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ----------------------------------------------------------------------------- // HEALTH & METADATA // -----------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    server: 'student',
    institution: 'Federal Polytechnic, Ilaro',
    system: 'Student Result & Screening Portal',
    scale: 'NBTE 4.0'
  });
});

// ----------------------------------------------------------------------------- // STUDENT AUTHENTICATION & RESULT CHECKER // -----------------------------------------------------------------------------

/**
 * Student Login & Result Retrieval Endpoint
 *
 * Supports TWO login methods (client picks via request body shape):
 *
 *  METHOD A — Password login (primary, new):
 *    Body: { matric_no, password }
 *    On success: full results payload returned immediately.
 *
 *  METHOD B — Email verification token (existing, kept as fallback):
 *    Step 1: { matric_no }                      -> emails one-time token
 *    Step 2: { matric_no, token }               -> verifies token, returns results
 */
app.post('/api/auth/student-login', (req, res) => {
  const { matric_no, password, token } = req.body;

  if (!matric_no || typeof matric_no !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Matriculation number is required.'
    });
  }

  const cleanMatric = String(matric_no).trim().toUpperCase();
  const cleanPassword = password ? String(password).trim() : '';
  const cleanToken = token ? String(token).trim() : '';

  const studentSql = `
    SELECT id, matric_no, full_name, school, department, programme, level, academic_session, email, password
    FROM students
    WHERE UPPER(matric_no) = ?
  `;

  db.get(studentSql, [cleanMatric], (err, student) => {
    if (err) {
      console.error('[AUTH ERROR] Query failed:', err.message);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during authentication.'
      });
    }

    if (!student) {
      // Do not reveal whether the matric exists — same generic message for all methods
      return res.status(401).json({
        success: false,
        message: 'Invalid matriculation number or password.'
      });
    }

    // ------------------------------------------------------------- // METHOD A: password login // -------------------------------------------------------------
    if (cleanPassword) {
      return verifyPasswordLogin(student, cleanPassword, res);
    }  // -------------------------------------------------------------
    // METHOD B: email token flow
    // -------------------------------------------------------------
    // Step 1: no token yet -> send one
    if (!cleanToken) {
      // No password and no token: only the email-token path is possible.
      if (!student.email) {
        return res.status(400).json({
          success: false,
          message: 'No email address is on file for this student. Please use password login or contact the admin.'
        });
      }

      const rawToken = generateToken();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

      db.run(
        `INSERT INTO auth_tokens (student_id, token, expires_at) VALUES (?, ?, ?)`,
        [student.id, rawToken, expiresAt],
        (insertErr) => {
          if (insertErr) {
            console.error('[TOKEN INSERT ERROR]', insertErr.message);
            return res.status(500).json({ success: false, message: 'Failed to create verification token.' });
          }

          sendLoginToken(student, rawToken, 'verification')
            .then(() => {
              const masked = student.email.replace(/^(.)(.*)(@.*)$/, '$1****$3');
              res.json({
                success: true,
                needsToken: true,
                emailHint: masked,
                message: 'A verification code has been sent to the email address on file.'
              });
            })
            .catch((mailErr) => {
              console.error('[MAIL ERROR]', mailErr);
              res.status(500).json({ success: false, message: 'Failed to send verification email.' });
            });
        }
      );
      return;
    }

    // Step 2: token provided -> verify
    db.get(
      `SELECT id, token, expires_at, used
       FROM auth_tokens
       WHERE student_id = ? AND token = ? AND used = 0
       ORDER BY id DESC LIMIT 1`,
      [student.id, cleanToken],
      (tokErr, tokRow) => {
        if (tokErr) {
          console.error('[TOKEN QUERY ERROR]', tokErr.message);
          return res.status(500).json({ success: false, message: 'Internal error while verifying token.' });
        }
        if (!tokRow) {
          return res.status(401).json({ success: false, message: 'Invalid or expired verification code.' });
        }

        if (new Date(tokRow.expires_at) < new Date()) {
          return res.status(401).json({ success: false, message: 'Verification code has expired. Please request a new one.' });
        }

        // Mark token as single-use (not fatal if this fails)
        db.run(`UPDATE auth_tokens SET used = 1 WHERE id = ?`, [tokRow.id], (updErr) => {
          if (updErr) console.warn('[TOKEN MARK-USED ERROR]', updErr.message);
        });

        fetchStudentResultsPayload(student, res);
      }
    );
  });
});

/**
 * Verify a password login attempt.
 * On success, optionally re-hash a still-plaintext password to bcrypt.
 */
function verifyPasswordLogin(student, plainPassword, res) {
  const stored = (student.password || '').trim();
  if (!stored) {
    return res.status(401).json({ success: false, message: 'Invalid matriculation number or password.' });
  }

  let passwordValid = false;

  // Treat bcrypt hashes (starts with $2a$ / $2b$ / $2y$ and is 60 chars long)
  if (stored.startsWith('$2') && stored.length === 60) {
    bcrypt.compare(plainPassword, stored, (bcErr, bcMatch) => {
      if (bcErr) {
        console.error('[BCRYPT ERROR]', bcErr.message);
        return res.status(500).json({ success: false, message: 'Authentication error. Please try again.' });
      }
      passwordValid = bcMatch;
      onPasswordChecked(passwordValid, student, res, null);
    });
  } else {
    // Plaintext comparison (legacy passwords still stored as plain text)
    passwordValid = plainPassword === stored;
    onPasswordChecked(passwordValid, student, res, stored);
  }
}

/**
 * After password validity is determined:
 *  - fail                 -> 401
 *  - success + plaintext  -> re-hash with bcrypt, then return results
 *  - success + hashed    -> return results immediately
 */
function onPasswordChecked(valid, student, res, storedPlain) {
  if (!valid) {
    return res.status(401).json({ success: false, message: 'Invalid matriculation number or password.' });
  }

  // Migrate legacy plaintext passwords to bcrypt
  if (storedPlain && !storedPlain.startsWith('$2')) {
    bcrypt.hash(storedPlain, 10, (hashErr, hash) => {
      if (hashErr) {
        console.warn('[PASSWORD MIGRATION WARNING]', hashErr.message);
      } else {
        db.run('UPDATE students SET password = ? WHERE id = ?', [hash, student.id], (upErr) => {
          if (upErr) console.warn('[PASSWORD MIGRATION UPDATE WARNING]', upErr.message);
        });
      }
      fetchStudentResultsPayload(student, res);
    });
  } else {
    fetchStudentResultsPayload(student, res);
  }
}

/**
 * Request a password-reset token (email a one-time code).
 * Generic response to avoid user enumeration.
 */
app.post('/api/auth/forgot-password', (req, res) => {
  const { matric_no } = req.body;

  if (!matric_no || typeof matric_no !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Matriculation number is required.'
    });
  }

  const cleanMatric = matric_no.trim().toUpperCase();

  db.get(
    `SELECT id, matric_no, full_name, email FROM students WHERE UPPER(matric_no) = ?`,
    [cleanMatric],
    (err, student) => {
      if (err) {
        console.error('[FORGOT PASSWORD ERROR] Query failed:', err.message);
        return res.status(500).json({ success: false, message: 'Internal server error. Please try again later.' });
      }

      // Generic response whether the matric exists or not
      if (!student || !student.email) {
        return res.json({
          success: true,
          message: 'If the matric number and email are on file, a password-reset code has been sent.'
        });
      }

      const rawToken = generateToken();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes for reset

      db.run(
        `INSERT INTO auth_tokens (student_id, token, expires_at) VALUES (?, ?, ?)`,
        [student.id, rawToken, expiresAt],
        (insertErr) => {
          if (insertErr) {
            console.error('[RESET TOKEN INSERT ERROR]', insertErr.message);
            return res.status(500).json({ success: false, message: 'Failed to create reset token. Please try again later.' });
          }

          sendLoginToken(student, rawToken)
            .then(() => {
              const masked = student.email.replace(/^(.)(.*)(@.*)$/, '$1****$3');
              res.json({
                success: true,
                message: 'If the matric number and email are on file, a password-reset code has been sent.',
                emailHint: masked
              });
            })
            .catch((mailErr) => {
              console.error('[RESET MAIL ERROR]', mailErr);
              // Do not reveal that mailing failed to an attacker; still say "check your email".
              res.json({
                success: true,
                message: 'If the matric number and email are on file, a password-reset code has been sent.'
              });
            });
        }
      );
    }
  );
});

/**
 * Reset password using a one-time email token.
 */
app.post('/api/auth/reset-password', (req, res) => {
  const { matric_no, token, new_password } = req.body;

  if (!matric_no || !token || !new_password) {
    return res.status(400).json({
      success: false,
      message: 'matric_no, token, and new_password are required.'
    });
  }

  if (new_password.trim().length < 6) {
    return res.status(400).json({
      success: false,
      message: 'New password must be at least 6 characters.'
    });
  }

  const cleanMatric = matric_no.trim().toUpperCase();
  const cleanToken = token.trim();

  db.get(
    `SELECT id, password FROM students WHERE UPPER(matric_no) = ?`,
    [cleanMatric],
    (err, student) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      if (!student) return res.status(400).json({ success: false, message: 'Invalid or expired reset code.' });

      db.get(
        `SELECT id, token, expires_at, used
         FROM auth_tokens
         WHERE student_id = ? AND token = ? AND used = 0
         ORDER BY id DESC LIMIT 1`,
        [student.id, cleanToken],
        (tokErr, tokRow) => {
          if (tokErr) {
            console.error('[RESET TOKEN VERIFY ERROR]', tokErr.message);
            return res.status(500).json({ success: false, message: 'Internal error while verifying reset code.' });
          }
          if (!tokRow) {
            return res.status(400).json({ success: false, message: 'Invalid or expired reset code.' });
          }

          if (new Date(tokRow.expires_at) < new Date()) {
            return res.status(400).json({ success: false, message: 'Reset code has expired. Please request a new one.' });
          }

          // Invalidate the token before changing the password
          db.run(`UPDATE auth_tokens SET used = 1 WHERE id = ?`, [tokRow.id], (markErr) => {
            if (markErr) console.warn('[RESET TOKEN MARK-USED ERROR]', markErr.message);
          });

          bcrypt.hash(new_password.trim(), 10, (hashErr, hash) => {
            if (hashErr) return res.status(500).json({ success: false, message: 'Failed to update password.' });

            db.run('UPDATE students SET password = ? WHERE id = ?', [hash, student.id], (upErr) => {
              if (upErr) return res.status(500).json({ success: false, message: upErr.message });
              res.json({ success: true, message: 'Password has been reset successfully. You can now log in with your new password.' });
            });
          });
        }
      );
    }
  );
});

/**
 * Change Student Password (current password known)
 */
app.post('/api/auth/change-password', (req, res) => {
  const { matric_no, current_password, new_password } = req.body;

  if (!matric_no || !current_password || !new_password) {
    return res.status(400).json({
      success: false,
      message: 'matric_no, current_password, and new_password are required.'
    });
  }

  if (new_password.trim().length < 6) {
    return res.status(400).json({
      success: false,
      message: 'New password must be at least 6 characters.'
    });
  }

  const cleanMatric = matric_no.trim().toUpperCase();

  db.get('SELECT id, password FROM students WHERE UPPER(matric_no) = ?', [cleanMatric], (err, student) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });

    const expected = student.password || '12345678';
    let currentValid = false;

    if (expected.startsWith('$2') && expected.length === 60) {
      bcrypt.compare(current_password.trim(), expected, (bcErr, bcMatch) => {
        if (bcErr) return res.status(500).json({ success: false, message: 'Authentication error.' });
        currentValid = bcMatch;
        onCurrentChecked(currentValid, student, new_password, res);
      });
    } else {
      currentValid = current_password.trim() === expected;
      onCurrentChecked(currentValid, student, new_password, res);
    }
  });
});

function onCurrentChecked(valid, student, newPassword, res) {
  if (!valid) {
    return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
  }

  bcrypt.hash(newPassword.trim(), 10, (hashErr, hash) => {
    if (hashErr) return res.status(500).json({ success: false, message: 'Failed to update password.' });
    db.run('UPDATE students SET password = ? WHERE id = ?', [hash, student.id], (upErr) => {
      if (upErr) return res.status(500).json({ success: false, message: upErr.message });
      res.json({ success: true, message: 'Password updated successfully.' });
    });
  });
}

/** * Direct Result Query by Matric No (Compatibility Endpoint) */
app.get(['/api/results/:matric_no(*)', '/api/results'], (req, res) => {
  const rawMatric = req.params.matric_no || req.params[0] || req.query.matric_no || '';

  if (!rawMatric || typeof rawMatric !== 'string' || rawMatric.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Matriculation number is required. Format example: 2460113253'
    });
  }

  const matricNo = decodeURIComponent(rawMatric).trim().toUpperCase();

  const studentSql = `
    SELECT id, matric_no, full_name, school, department, programme, level, academic_session, created_at
    FROM students
    WHERE UPPER(matric_no) = ?
  `;

  db.get(studentSql, [matricNo], (err, student) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    if (!student) {
      return res.status(404).json({
        success: false,
        message: `No record found for Matriculation Number: "${matricNo}".`
      });
    }

    fetchStudentResultsPayload(student, res);
  });
});

/** * Helper to Compile and Return Student Results Payload */
function fetchStudentResultsPayload(student, res) {
  const resultsSql = `
    SELECT id, course_code, course_title, credit_unit, score, grade, grade_point, semester, academic_year
    FROM results
    WHERE student_id = ?
    ORDER BY id ASC
  `;

  db.all(resultsSql, [student.id], (resultsErr, rows) => {
    if (resultsErr) {
      console.error('[API ERROR] Results query failed:', resultsErr.message);
      return res.status(500).json({
        success: false,
        message: 'Internal database error while fetching academic results.'
      });
    }

    const parsedInfo = parseFPIMatric(student.matric_no);

    if (!rows || rows.length === 0) {
      return res.status(200).json({
        success: true,
        student: {
          id: student.id,
          matric_no: student.matric_no,
          full_name: student.full_name,
          school: student.school || parsedInfo.school,
          department: student.department || parsedInfo.department,
          programme: student.programme || 'National Diploma (ND)',
          level: student.level || 'ND 1',
          academic_session: student.academic_session || '2024/2025',
          mode: parsedInfo.mode
        },
        summary: {
          totalCreditUnits: 0,
          totalQualityPoints: 0.0,
          totalUnitsPassed: 0,
          cgpa: 0.0,
          classification: 'No Results Recorded',
          gradingSystem: 'NBTE 4.0 Scale',
          institution: 'Federal Polytechnic, Ilaro'
        },
        semesters: []
      });
    }

    const semesterGroups = {};
    let cumulativeUnits = 0;
    let cumulativeQualityPoints = 0;
    let cumulativeUnitsPassed = 0;

    rows.forEach((row) => {
      const semesterName = row.semester;
      if (!semesterGroups[semesterName]) {
        semesterGroups[semesterName] = {
          semester: semesterName,
          academic_year: row.academic_year,
          totalCreditUnits: 0,
          totalQualityPoints: 0,
          totalUnitsPassed: 0,
          courses: []
        };
      }

      let gradeInfo;
      try {
        gradeInfo = getNBTEGradeAndPoint(row.score);
      } catch (e) {
        gradeInfo = { grade: row.grade, gradePoint: row.grade_point, remarks: '' };
      }

      const creditUnit = Number(row.credit_unit) || 0;
      const gradePoint = Number(gradeInfo.gradePoint !== undefined ? gradeInfo.gradePoint : row.grade_point) || 0;
      const qualityPoint = Number((creditUnit * gradePoint).toFixed(2));
      const passed = row.score >= 40 && gradeInfo.grade !== 'F';

      semesterGroups[semesterName].totalCreditUnits += creditUnit;
      semesterGroups[semesterName].totalQualityPoints += qualityPoint;
      if (passed) {
        semesterGroups[semesterName].totalUnitsPassed += creditUnit;
      }

      semesterGroups[semesterName].courses.push({
        id: row.id,
        course_code: row.course_code,
        course_title: row.course_title,
        credit_unit: creditUnit,
        score: row.score,
        grade: gradeInfo.grade,
        grade_point: gradePoint,
        quality_point: qualityPoint,
        remarks: gradeInfo.remarks
      });

      cumulativeUnits += creditUnit;
      cumulativeQualityPoints += qualityPoint;
      if (passed) {
        cumulativeUnitsPassed += creditUnit;
      }
    });

    const semesters = Object.values(semesterGroups).map((sem) => {
      const gpa = sem.totalCreditUnits > 0
        ? Number((sem.totalQualityPoints / sem.totalCreditUnits).toFixed(2))
        : 0.00;

      return {
        semester: sem.semester,
        academic_year: sem.academic_year,
        totalCreditUnits: sem.totalCreditUnits,
        totalQualityPoints: Number(sem.totalQualityPoints.toFixed(2)),
        totalUnitsPassed: sem.totalUnitsPassed,
        gpa: gpa,
        courses: sem.courses
      };
    });

    const cgpa = cumulativeUnits > 0
      ? Number((cumulativeQualityPoints / cumulativeUnits).toFixed(2))
      : 0.00;

    const classification = getNBTEClassification(cgpa);

    res.json({
      success: true,
      student: {
        id: student.id,
        matric_no: student.matric_no,
        full_name: student.full_name,
        school: student.school || parsedInfo.school,
        department: student.department || parsedInfo.department,
        programme: student.programme || 'National Diploma (ND)',
        level: student.level || 'ND 1',
        academic_session: student.academic_session || '2024/2025',
        mode: parsedInfo.mode
      },
      summary: {
        totalCreditUnits: cumulativeUnits,
        totalQualityPoints: Number(cumulativeQualityPoints.toFixed(2)),
        totalUnitsPassed: cumulativeUnitsPassed,
        cgpa: cgpa,
        classification: classification,
        gradingSystem: 'NBTE 4.0 Scale',
        institution: 'Federal Polytechnic, Ilaro'
      },
      semesters: semesters
    });
  });
}

// ----------------------------------------------------------------------------- // ADMISSION SCREENING (JAMB & WAEC) // -----------------------------------------------------------------------------
app.get('/api/screening/schools', (req, res) => {
  res.json({
    success: true,
    institutions: INSTITUTIONS
  });
});

app.post('/api/screening/evaluate', (req, res) => {
  try {
    const { jambScore, olevelSubjects, sittings, targetCourseCode, targetInstitutionId } = req.body;

    if (jambScore === undefined || !olevelSubjects) {
      return res.status(400).json({
        success: false,
        message: 'Missing required screening parameters (jambScore, olevelSubjects).'
      });
    }

    const evaluation = evaluateAdmissionEligibility({
      jambScore,
      olevelSubjects,
      sittings,
      targetCourseCode,
      targetInstitutionId
    });

    res.json({
      success: true,
      evaluation
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message || 'Error evaluating admission screening.'
    });
  }
});

// Fallback 404 for unmatched API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found.'
  });
});

// Start Student Server
let serverInstance = null;
if (require.main === module) {
  serverInstance = app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║  STUDENT PORTAL SERVER                                         ║
║  Federal Polytechnic, Ilaro - NBTE 4.0 System                 ║
║                                                                ║
║  🎓 Student Access: http://localhost:${PORT}                    ║
║  📊 Result Checker & Admission Screening                       ║
╚════════════════════════════════════════════════════════════════╝
    `);
  });
}

module.exports = { app, server: serverInstance };
