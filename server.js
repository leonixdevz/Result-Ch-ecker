/**
 * server.js
 * Express Backend API: Result Checker, Admission Screening, and Official Admin Engine
 * Federal Polytechnic, Ilaro - NBTE 4.0 Standard & FPI Matric System
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { db, getNBTEGradeAndPoint, getNBTEClassification, parseFPIMatric } = require('./database');
const { INSTITUTIONS, evaluateAdmissionEligibility } = require('./screening');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_SECRET_PIN = process.env.ADMIN_PIN || 'FPI-ADMIN-2026';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static assets from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Admin Web Route (Isolated from regular student views)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Admin Authorization Middleware
function requireAdminAuth(req, res, next) {
  const adminKey = req.headers['x-admin-key'] || req.query.admin_key || req.body.admin_key;
  if (!adminKey || adminKey !== ADMIN_SECRET_PIN) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid or missing Official Admin PIN/Key.'
    });
  }
  next();
}

// -----------------------------------------------------------------------------
// 1. HEALTH & METADATA
// -----------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    institution: 'Federal Polytechnic, Ilaro',
    system: 'Unified Student Result & Screening API',
    scale: 'NBTE 4.0'
  });
});

// -----------------------------------------------------------------------------
// 2. STUDENT AUTHENTICATION & RESULT CHECKER
// -----------------------------------------------------------------------------

/**
 * Student Login & Result Retrieval Endpoint
 * Authenticates with Matric Number and Password (default: 12345678)
 */
app.post('/api/auth/student-login', (req, res) => {
  const { matric_no, password } = req.body;

  if (!matric_no || !password) {
    return res.status(400).json({
      success: false,
      message: 'Matriculation Number and Password are both required.'
    });
  }

  const cleanMatric = String(matric_no).trim().toUpperCase();
  const cleanPassword = String(password).trim();

  const studentSql = `
    SELECT id, matric_no, password, full_name, school, department, programme, level, academic_session, created_at
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
      return res.status(404).json({
        success: false,
        message: `Student with Matriculation Number "${cleanMatric}" was not found. Please verify and try again.`
      });
    }

    // Check Password (match student password or allow fallback default 12345678)
    const expectedPassword = student.password || '12345678';
    if (cleanPassword !== expectedPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password. (Default student password is: 12345678)'
      });
    }

    // Fetch and compile results
    fetchStudentResultsPayload(student, res);
  });
});

/**
 * Change Student Password
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
    if (current_password.trim() !== expected) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    db.run('UPDATE students SET password = ? WHERE id = ?', [new_password.trim(), student.id], (upErr) => {
      if (upErr) return res.status(500).json({ success: false, message: upErr.message });
      res.json({ success: true, message: 'Password updated successfully.' });
    });
  });
});

/**
 * Direct Result Query by Matric No (Compatibility Endpoint)
 */
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

/**
 * Helper to Compile and Return Student Results Payload
 */
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

// -----------------------------------------------------------------------------
// 3. ADMISSION SCREENING (JAMB & WAEC)
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// 4. OFFICIAL ADMIN ENDPOINTS
// -----------------------------------------------------------------------------

// Admin Authentication Check
app.post('/api/admin/login', (req, res) => {
  const { pin } = req.body;
  if (pin === ADMIN_SECRET_PIN) {
    return res.json({
      success: true,
      token: ADMIN_SECRET_PIN,
      message: 'Official Admin authenticated successfully.'
    });
  }
  return res.status(401).json({
    success: false,
    message: 'Invalid Official Admin PIN. (Default test PIN is: FPI-ADMIN-2026)'
  });
});

// List All Students
app.get('/api/admin/students', requireAdminAuth, (req, res) => {
  const search = req.query.search ? `%${req.query.search.trim()}%` : '%';
  const sql = `
    SELECT s.*, COUNT(r.id) as total_courses
    FROM students s
    LEFT JOIN results r ON s.id = r.student_id
    WHERE s.matric_no LIKE ? OR s.full_name LIKE ? OR s.department LIKE ?
    GROUP BY s.id
    ORDER BY s.id DESC
  `;

  db.all(sql, [search, search, search], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    res.json({ success: true, students: rows });
  });
});

// Create or Update Student
app.post('/api/admin/students', requireAdminAuth, (req, res) => {
  const { matric_no, password, full_name, school, department, programme, level, academic_session } = req.body;

  if (!matric_no || !full_name || !department) {
    return res.status(400).json({
      success: false,
      message: 'matric_no, full_name, and department are required.'
    });
  }

  const cleanMatric = matric_no.trim().toUpperCase();
  const cleanPassword = (password && password.trim()) ? password.trim() : '12345678';
  const parsed = parseFPIMatric(cleanMatric);

  db.get('SELECT id FROM students WHERE UPPER(matric_no) = ?', [cleanMatric], (checkErr, existing) => {
    if (checkErr) return res.status(500).json({ success: false, message: checkErr.message });

    if (existing) {
      const updateSql = `
        UPDATE students
        SET full_name = ?, school = ?, department = ?, programme = ?, level = ?, academic_session = ?
        WHERE id = ?
      `;
      db.run(
        updateSql,
        [
          full_name.trim(),
          school || parsed.school,
          department.trim(),
          programme || 'National Diploma (ND)',
          level || 'ND 1',
          academic_session || '2024/2025',
          existing.id
        ],
        function (updateErr) {
          if (updateErr) return res.status(500).json({ success: false, message: updateErr.message });
          res.json({
            success: true,
            message: `Student record updated for ${cleanMatric}`,
            studentId: existing.id
          });
        }
      );
    } else {
      const insertSql = `
        INSERT INTO students (matric_no, password, full_name, school, department, programme, level, academic_session)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      db.run(
        insertSql,
        [
          cleanMatric,
          cleanPassword,
          full_name.trim(),
          school || parsed.school,
          department.trim(),
          programme || 'National Diploma (ND)',
          level || 'ND 1',
          academic_session || '2024/2025'
        ],
        function (insertErr) {
          if (insertErr) return res.status(500).json({ success: false, message: insertErr.message });
          res.json({
            success: true,
            message: `New student registered with ID ${this.lastID} (${cleanMatric})`,
            studentId: this.lastID
          });
        }
      );
    }
  });
});

// Batch Insert Course Results for a Student
app.post('/api/admin/results/batch', requireAdminAuth, (req, res) => {
  const { matric_no, semester, academic_year, courses } = req.body;

  if (!matric_no || !Array.isArray(courses) || courses.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'matric_no and an array of courses are required.'
    });
  }

  const cleanMatric = matric_no.trim().toUpperCase();

  db.get('SELECT id FROM students WHERE UPPER(matric_no) = ?', [cleanMatric], (findErr, student) => {
    if (findErr) return res.status(500).json({ success: false, message: findErr.message });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: `Student with matric ${cleanMatric} does not exist. Please register the student first.`
      });
    }

    const insertStmt = db.prepare(`
      INSERT INTO results (student_id, course_code, course_title, credit_unit, score, grade, grade_point, semester, academic_year)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let insertedCount = 0;
    try {
      courses.forEach((c) => {
        const { grade, gradePoint } = getNBTEGradeAndPoint(c.score);
        insertStmt.run(
          student.id,
          c.course_code.trim().toUpperCase(),
          c.course_title.trim(),
          Number(c.credit_unit) || 2,
          Number(c.score) || 0,
          grade,
          gradePoint,
          semester || 'ND 1 First Semester',
          academic_year || '2024/2025'
        );
        insertedCount++;
      });

      insertStmt.finalize((finErr) => {
        if (finErr) return res.status(500).json({ success: false, message: finErr.message });
        res.json({
          success: true,
          message: `Successfully uploaded ${insertedCount} course results for ${cleanMatric}.`
        });
      });
    } catch (e) {
      res.status(400).json({ success: false, message: e.message });
    }
  });
});

// Delete Student Record
app.delete('/api/admin/students/:matric_no(*)', requireAdminAuth, (req, res) => {
  const matricNo = decodeURIComponent(req.params.matric_no || req.params[0]).trim().toUpperCase();

  db.run('DELETE FROM students WHERE UPPER(matric_no) = ?', [matricNo], function (err) {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (this.changes === 0) {
      return res.status(404).json({ success: false, message: `Student ${matricNo} not found.` });
    }
    res.json({ success: true, message: `Student record and all results deleted for ${matricNo}.` });
  });
});

// Fallback 404 for unmatched API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found.'
  });
});

// Start Express Server if executed directly
let serverInstance = null;
if (require.main === module) {
  serverInstance = app.listen(PORT, () => {
    console.log(`[SERVER INFO] Federal Polytechnic Ilaro Result Checker & Screening System running on http://localhost:${PORT}`);
  });
}

module.exports = { app, server: serverInstance };
