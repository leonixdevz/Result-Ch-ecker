/**
 * admin-server.js
 * Admin-Only Express Server: Student & Results Management
 * Federal Polytechnic, Ilaro - Official Admin Portal
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { db, getNBTEGradeAndPoint, getNBTEClassification, parseFPIMatric } = require('../database');

const app = express();
const PORT = process.env.ADMIN_PORT || 4000;


const ADMIN_SECRET_PIN = process.env.ADMIN_PIN || 'FPI-ADMIN-2026';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve admin static page
app.use(express.static(path.join(__dirname, 'public')));

// Admin home route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

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
// HEALTH & METADATA
// -----------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    server: 'admin',
    institution: 'Federal Polytechnic, Ilaro',
    system: 'Official Admin Management Portal',
    scale: 'NBTE 4.0'
  });
});

// -----------------------------------------------------------------------------
// ADMIN AUTHENTICATION
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// STUDENT MANAGEMENT
// -----------------------------------------------------------------------------

/**
 * List All Students
 */
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

/**
 * Get Single Student Details
 */
app.get('/api/admin/students/:matric_no', requireAdminAuth, (req, res) => {
  const matricNo = decodeURIComponent(req.params.matric_no).trim().toUpperCase();

  const sql = `
    SELECT * FROM students WHERE UPPER(matric_no) = ?
  `;

  db.get(sql, [matricNo], (err, student) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }
    res.json({ success: true, student });
  });
});

/**
 * Create or Update Student (REGISTER NEW STUDENTS)
 *
 * On create, the student password is ALWAYS the fixed default
 * '12345678', stored as a bcrypt hash. The admin cannot assign
 * a custom password from this endpoint.
 * On update, the password column is intentionally NOT changed.
 */
app.post('/api/admin/students', requireAdminAuth, (req, res) => {
  const { matric_no, full_name, school, department, programme, level, academic_session, email } = req.body;

  if (!matric_no || !full_name || !department) {
    return res.status(400).json({
      success: false,
      message: 'matric_no, full_name, and department are required.'
    });
  }

  const cleanMatric = matric_no.trim().toUpperCase();
  const parsed = parseFPIMatric(cleanMatric);

  db.get('SELECT id FROM students WHERE UPPER(matric_no) = ?', [cleanMatric], (checkErr, existing) => {
    if (checkErr) return res.status(500).json({ success: false, message: checkErr.message });

    if (existing) {
      // UPDATE: do not touch the password column here.
      const updateSql = `
        UPDATE students
        SET full_name = ?, school = ?, department = ?, programme = ?, level = ?, academic_session = ?, email = ?
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
          (email && email.trim()) ? email.trim() : null,
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
      // CREATE: use the fixed default password for every new student.
      const DEFAULT_PASSWORD = '12345678';

      bcrypt.hash(DEFAULT_PASSWORD, 10, (hashErr, hash) => {
        if (hashErr) return res.status(500).json({ success: false, message: 'Failed to create student record.' });

        const insertSql = `
          INSERT INTO students (matric_no, password, full_name, school, department, programme, level, academic_session, email)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        db.run(
          insertSql,
          [
            cleanMatric,
            hash,
            full_name.trim(),
            school || parsed.school,
            department.trim(),
            programme || 'National Diploma (ND)',
            level || 'ND 1',
            academic_session || '2024/2025',
            (email && email.trim()) ? email.trim() : null
          ],
          function (insertErr) {
            if (insertErr) return res.status(500).json({ success: false, message: insertErr.message });
            res.json({
              success: true,
              message: `New student registered with ID ${this.lastID} (${cleanMatric}). Default login password: ${DEFAULT_PASSWORD}`,
              studentId: this.lastID
            });
          }
        );
      });
    }
  });
});

// bcrypt is used to hash the fixed default password for new students.
const bcrypt = require('bcryptjs');

/**
 * Delete Student Record
 */
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

// -----------------------------------------------------------------------------
// RESULTS / PROJECT MANAGEMENT (ADD COURSES/RESULTS TO STUDENTS)
// -----------------------------------------------------------------------------

/**
 * Get All Results for a Student
 */
app.get('/api/admin/results/:matric_no', requireAdminAuth, (req, res) => {
  const matricNo = decodeURIComponent(req.params.matric_no).trim().toUpperCase();

  db.get('SELECT id FROM students WHERE UPPER(matric_no) = ?', [matricNo], (err, student) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const sql = `
      SELECT * FROM results WHERE student_id = ? ORDER BY id DESC
    `;

    db.all(sql, [student.id], (resultErr, results) => {
      if (resultErr) return res.status(500).json({ success: false, message: resultErr.message });
      res.json({ success: true, results });
    });
  });
});

/**
 * Batch Insert Course Results for a Student (ADD PROJECTS/COURSES)
 */
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

/**
 * Add Single Course Result
 */
app.post('/api/admin/results', requireAdminAuth, (req, res) => {
  const { matric_no, course_code, course_title, credit_unit, score, semester, academic_year } = req.body;

  if (!matric_no || !course_code || !course_title || score === undefined) {
    return res.status(400).json({
      success: false,
      message: 'matric_no, course_code, course_title, and score are required.'
    });
  }

  const cleanMatric = matric_no.trim().toUpperCase();

  db.get('SELECT id FROM students WHERE UPPER(matric_no) = ?', [cleanMatric], (err, student) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: `Student with matric ${cleanMatric} not found.`
      });
    }

    const { grade, gradePoint } = getNBTEGradeAndPoint(score);

    const sql = `
      INSERT INTO results (student_id, course_code, course_title, credit_unit, score, grade, grade_point, semester, academic_year)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(
      sql,
      [
        student.id,
        course_code.trim().toUpperCase(),
        course_title.trim(),
        Number(credit_unit) || 2,
        Number(score),
        grade,
        gradePoint,
        semester || 'ND 1 First Semester',
        academic_year || '2024/2025'
      ],
      function (insertErr) {
        if (insertErr) return res.status(500).json({ success: false, message: insertErr.message });
        res.json({
          success: true,
          message: `Course result added successfully for ${cleanMatric}.`,
          resultId: this.lastID
        });
      }
    );
  });
});

/**
 * Delete a Course Result
 */
app.delete('/api/admin/results/:result_id', requireAdminAuth, (req, res) => {
  const resultId = parseInt(req.params.result_id);

  db.run('DELETE FROM results WHERE id = ?', [resultId], function (err) {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (this.changes === 0) {
      return res.status(404).json({ success: false, message: 'Result not found.' });
    }
    res.json({ success: true, message: 'Course result deleted successfully.' });
  });
});

// -----------------------------------------------------------------------------
// STATISTICS & DASHBOARD
// -----------------------------------------------------------------------------
app.get('/api/admin/stats', requireAdminAuth, (req, res) => {
  db.get('SELECT COUNT(*) as total_students FROM students', [], (err1, studentCount) => {
    if (err1) return res.status(500).json({ success: false, message: err1.message });

    db.get('SELECT COUNT(*) as total_results FROM results', [], (err2, resultCount) => {
      if (err2) return res.status(500).json({ success: false, message: err2.message });

      db.get('SELECT COUNT(DISTINCT semester) as total_semesters FROM results', [], (err3, semesterCount) => {
        if (err3) return res.status(500).json({ success: false, message: err3.message });

        res.json({
          success: true,
          stats: {
            total_students: studentCount.total_students,
            total_results: resultCount.total_results,
            total_semesters: semesterCount.total_semesters
          }
        });
      });
    });
  });
});

// Helper to compile and return student results payload (same as in student-server)
function sendStudentResultPayload(student, res) {
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

// Open endpoints for student client (no auth required)
app.get('/api/open/students/:matric_no', (req, res) => {
  const matricNo = decodeURIComponent(req.params.matric_no).trim().toUpperCase();

  db.get(
    'SELECT id, matric_no, full_name, school, department, programme, level, academic_session FROM students WHERE UPPER(matric_no) = ?',
    [matricNo],
    (err, student) => {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student not found.' });
      }
      // Return only basic profile
      res.json({
        success: true,
        student: {
          id: student.id,
          matric_no: student.matric_no,
          full_name: student.full_name,
          school: student.school,
          department: student.department,
          programme: student.programme,
          level: student.level,
          academic_session: student.academic_session
        }
      });
    }
  );
});

app.get('/api/open/students/:matric_no/results', (req, res) => {
  const matricNo = decodeURIComponent(req.params.matric_no).trim().toUpperCase();

  db.get(
    'SELECT id, matric_no, full_name, school, department, programme, level, academic_session FROM students WHERE UPPER(matric_no) = ?',
    [matricNo],
    (err, student) => {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student not found.' });
      }
      sendStudentResultPayload(student, res);
    }
  );
});

// Fallback 404 for unmatched API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found.'
  });
});

// Start Admin Server
let serverInstance = null;
if (require.main === module) {
  serverInstance = app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║  ADMIN MANAGEMENT PORTAL                                       ║
║  Federal Polytechnic, Ilaro - Official Admin System           ║
║                                                                ║
║  🔐 Admin Access: http://localhost:${PORT}                      ║
║  👥 Student Registration & Results Management                  ║
║  📝 Default PIN: FPI-ADMIN-2026                                ║
╚════════════════════════════════════════════════════════════════╝
    `);
  });
}

module.exports = { app, server: serverInstance };