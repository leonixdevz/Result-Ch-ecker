/**
 * database.js
 * SQLite3 Database Initialization & NBTE 4.0 Logic
 * Federal Polytechnic, Ilaro - Authentic Numeric Matriculation Format
 */

const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, 'results.db');

// Initialize SQLite database instance
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('[DB ERROR] Failed to connect to SQLite database:', err.message);
  } else {
    console.log('[DB INFO] Connected to SQLite database at:', DB_PATH);
  }
});

/**
 * NBTE 4.0 Grading Logic
 * Maps numerical student scores to NBTE letter grades and grade points.
 */
function getNBTEGradeAndPoint(rawScore) {
  const score = parseFloat(rawScore);
  if (isNaN(score) || score < 0 || score > 100) {
    throw new Error(`Invalid score: "${rawScore}". Score must be between 0 and 100.`);
  }

  if (score >= 75) {
    return { grade: 'A', gradePoint: 4.00, remarks: 'Distinction' };
  } else if (score >= 70) {
    return { grade: 'AB', gradePoint: 3.50, remarks: 'Very Good' };
  } else if (score >= 65) {
    return { grade: 'B', gradePoint: 3.25, remarks: 'Good' };
  } else if (score >= 60) {
    return { grade: 'BC', gradePoint: 3.00, remarks: 'Credit' };
  } else if (score >= 55) {
    return { grade: 'C', gradePoint: 2.75, remarks: 'Credit' };
  } else if (score >= 50) {
    return { grade: 'CD', gradePoint: 2.50, remarks: 'Credit' };
  } else if (score >= 45) {
    return { grade: 'D', gradePoint: 2.25, remarks: 'Pass' };
  } else if (score >= 40) {
    return { grade: 'E', gradePoint: 2.00, remarks: 'Pass' };
  } else {
    return { grade: 'F', gradePoint: 0.00, remarks: 'Fail' };
  }
}

/**
 * NBTE Academic Classification Logic based on CGPA
 */
function getNBTEClassification(cgpa) {
  const val = parseFloat(cgpa);
  if (isNaN(val)) return 'N/A';
  if (val >= 3.50) return 'Distinction';
  if (val >= 3.00) return 'Upper Credit';
  if (val >= 2.50) return 'Lower Credit';
  if (val >= 2.00) return 'Pass';
  return 'Fail';
}

/**
 * Parse FPI Matric Number:
 * Format: [Year: 24][School: 60][Dept: 1][Mode: 1][ID: 3253] -> 2460113253
 */
function parseFPIMatric(matricNo) {
  const clean = String(matricNo || '').trim();
  if (clean.length === 10 && /^\d+$/.test(clean)) {
    const year = `20${clean.substring(0, 2)}`;
    const schoolCode = clean.substring(2, 4);
    const deptCode = clean.substring(4, 5);
    const modeCode = clean.substring(5, 6);
    const studentId = clean.substring(6, 10);

    const schoolMap = {
      '60': 'School of Pure and Applied Sciences',
      '40': 'School of Engineering',
      '20': 'School of Management Studies',
      '30': 'School of Environmental Studies',
      '50': 'School of Communication & Info Tech'
    };

    const deptMap = {
      '1': 'Computer Science',
      '2': 'Science Laboratory Technology (SLT)',
      '3': 'Mathematics & Statistics',
      '4': 'Food Technology',
      '5': 'Hospitality Management'
    };

    const modeMap = {
      '1': 'Full-Time',
      '2': 'Part-Time'
    };

    return {
      isValid: true,
      entryYear: year,
      school: schoolMap[schoolCode] || 'School of Pure and Applied Sciences',
      department: deptMap[deptCode] || 'Computer Science',
      mode: modeMap[modeCode] || 'Full-Time',
      studentId: studentId
    };
  }

  return {
    isValid: false,
    entryYear: '2024',
    school: 'School of Pure and Applied Sciences',
    department: 'Computer Science',
    mode: 'Full-Time',
    studentId: clean
  };
}

/**
 * Initialize Tables
 */
function initializeDatabase() {
  db.serialize(() => {
    db.run('PRAGMA foreign_keys = ON');

    // Create students table with email column
    db.run(`
      CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        matric_no TEXT UNIQUE NOT NULL,
        password TEXT DEFAULT '12345678',
        full_name TEXT NOT NULL,
        school TEXT DEFAULT 'School of Pure and Applied Sciences',
        department TEXT NOT NULL,
        programme TEXT NOT NULL,
        level TEXT NOT NULL,
        academic_session TEXT NOT NULL,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create results table
    db.run(`
      CREATE TABLE IF NOT EXISTS results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        course_code TEXT NOT NULL,
        course_title TEXT NOT NULL,
        credit_unit INTEGER NOT NULL,
        score REAL NOT NULL,
        grade TEXT NOT NULL,
        grade_point REAL NOT NULL,
        semester TEXT NOT NULL,
        academic_year TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE
      )
    `, (err) => {
      if (!err) {
        seedDatabase();
      }
    });

    // Create auth_tokens table for email verification
    db.run(`
      CREATE TABLE IF NOT EXISTS auth_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        token TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        used INTEGER DEFAULT 0,
        FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
      )
    `);

    // Migration: older databases were created before the email column existed;
    // CREATE TABLE IF NOT EXISTS does not alter existing tables, so add it here.
    db.run('ALTER TABLE students ADD COLUMN email TEXT', (err) => {
      if (err && !/duplicate column name/i.test(err.message)) {
        console.error('[DB ERROR] Failed to add email column to students:', err.message);
      }
    });
  });
}

/**
 * Seed Database with Primary Test Student (2460113253)
 * Breakdown: 24 (2024 entry) + 60 (School of Pure & Applied) + 1 (Comp Sci) + 1 (Full-Time) + 3253 (Student ID)
 */
function seedDatabase() {
  const testStudent = {
    matric_no: '2460113253',
    password: '12345678',
    full_name: 'ADEWALE OLUWASEUN IBRAHIM',
    school: 'School of Pure and Applied Sciences',
    department: 'Computer Science',
    programme: 'National Diploma (ND) Full-Time',
    level: 'ND 1',
    academic_session: '2024/2025'
  };

  db.get('SELECT id FROM students WHERE UPPER(matric_no) = UPPER(?)', [testStudent.matric_no], (err, row) => {
    if (err) return;

    if (row) {
      // Ensure password exists
      db.run('UPDATE students SET password = ? WHERE id = ? AND (password IS NULL OR password = "")', [testStudent.password, row.id]);
      return;
    }

    db.run(
      `INSERT INTO students (matric_no, password, full_name, school, department, programme, level, academic_session, email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        testStudent.matric_no,
        testStudent.password,
        testStudent.full_name,
        testStudent.school,
        testStudent.department,
        testStudent.programme,
        testStudent.level,
        testStudent.academic_session,
        null // email initially null
      ],
      function (insertErr) {
        if (insertErr) return;
        const studentId = this.lastID;

        const courses = [
          // ND 1 First Semester
          { sem: 'ND 1 First Semester', yr: '2024/2025', code: 'COM 111', title: 'Introduction to Computing', cu: 3, score: 84 },
          { sem: 'ND 1 First Semester', yr: '2024/2025', code: 'COM 112', title: 'Introduction to Digital Electronics', cu: 3, score: 78 },
          { sem: 'ND 1 First Semester', yr: '2024/2025', code: 'COM 113', title: 'Introduction to Programming in Python & Basic', cu: 3, score: 81 },
          { sem: 'ND 1 First Semester', yr: '2024/2025', code: 'MTH 111', title: 'Logic and Linear Algebra', cu: 2, score: 73 },
          { sem: 'ND 1 First Semester', yr: '2024/2025', code: 'GNS 101', title: 'Use of English I', cu: 2, score: 76 },
          { sem: 'ND 1 First Semester', yr: '2024/2025', code: 'GNS 111', title: 'Citizenship Education I', cu: 2, score: 80 },
          { sem: 'ND 1 First Semester', yr: '2024/2025', code: 'EED 126', title: 'Introduction to Entrepreneurship', cu: 2, score: 77 },

          // ND 1 Second Semester
          { sem: 'ND 1 Second Semester', yr: '2024/2025', code: 'COM 121', title: 'Scientific Programming with C/C++', cu: 3, score: 86 },
          { sem: 'ND 1 Second Semester', yr: '2024/2025', code: 'COM 122', title: 'Introduction to Internet & Web Technologies', cu: 3, score: 90 },
          { sem: 'ND 1 Second Semester', yr: '2024/2025', code: 'COM 123', title: 'Computer Application Packages I', cu: 2, score: 82 },
          { sem: 'ND 1 Second Semester', yr: '2024/2025', code: 'COM 124', title: 'Data Structures and Algorithms', cu: 3, score: 79 },
          { sem: 'ND 1 Second Semester', yr: '2024/2025', code: 'COM 125', title: 'Introduction to Object-Oriented Programming (Java)', cu: 3, score: 85 },
          { sem: 'ND 1 Second Semester', yr: '2024/2025', code: 'MTH 121', title: 'Calculus', cu: 2, score: 74 },
          { sem: 'ND 1 Second Semester', yr: '2024/2025', code: 'GNS 102', title: 'Communication in English II', cu: 2, score: 71 },
          { sem: 'ND 1 Second Semester', yr: '2024/2025', code: 'GNS 121', title: 'Citizenship Education II', cu: 2, score: 83 }
        ];

        const stmt = db.prepare(`
          INSERT INTO results (student_id, course_code, course_title, credit_unit, score, grade, grade_point, semester, academic_year)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        courses.forEach((c) => {
          const { grade, gradePoint } = getNBTEGradeAndPoint(c.score);
          stmt.run(studentId, c.code, c.title, c.cu, c.score, grade, gradePoint, c.sem, c.yr);
        });

        stmt.finalize();
      }
    );
  });
}

// Auto-initialize when required
initializeDatabase();

module.exports = {
  db,
  getNBTEGradeAndPoint,
  getNBTEClassification,
  parseFPIMatric,
  initializeDatabase,
  seedDatabase
};