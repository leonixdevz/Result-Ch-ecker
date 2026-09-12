# FPI Student Result Checker System

> A Node.js web application for Federal Polytechnic, Ilaro built on the **NBTE 4.0 grading standard**. Provides student result checking and admission screening across Nigerian polytechnics and universities.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Getting Started](#getting-started)
   - [Prerequisites](#prerequisites)
   - [Installation](#installation)
   - [Running the System](#running-the-system)
   - [Seeding the Database](#seeding-the-database)
4. [System Components](#system-components)
   - [Student Server](#student-server)
   - [Admin Server](#admin-server)
   - [Shared Modules](#shared-modules)
5. [Database Schema](#database-schema)
6. [Authentication](#authentication)
7. [Admission Screening](#admission-screening)
8. [System Configuration](#system-configuration)
9. [Frontend Interfaces](#frontend-interfaces)
10. [Testing](#testing)
11. [Security Considerations](#security-considerations)
12. [Development](#development)

---

## Project Overview

The **FPI Student Result Checker System** is a dual-server web application that enables:

- **Students** to authenticate with their matriculation number and view their official academic results formatted as a printable Statement of Results
- **Administrators** to manage student records, upload results, configure system settings, and evaluate admission screening eligibility

The system implements the **NBTE 4.0 grading standard** for Nigerian polytechnics, converting numerical scores to letter grades (A through F) with corresponding grade points, and classifying academic performance based on Cumulative Grade Point Average (CGPA).

**Target Institution:** The Federal Polytechnic, Ilaro (FPI), Ogun State, Nigeria

---

## Architecture

```
project-root/
├── package.json              # Project manifest & scripts
├── package-lock.json         # Locked dependency versions
├── results.db               # SQLite database (auto-created)
├── .gitignore               # Git ignore patterns
│
├── start-all.js             # Orchestrator: launches both servers
│
├── database.js              # SQLite setup, NBTE grading logic, FPI matric parser, DB seeding
├── screening.js             # Admission screening engine (JAMB + O'Level evaluation)
├── emailToken.js            # One-time login token generation & SMTP email delivery
├── systemConfig.js          # SQLite-backed admin-editable system settings
│
├── Admin server/
│   ├── admin-server.js      # Express server (port 4000) — admin endpoints + static files
│   └── public/
│       ├── admin.html       # Admin dashboard SPA
│       └── styles.css       # Admin UI styles
│
└── Student server/
    ├── student-server.js    # Express server (port 3000) — student endpoints + static files
    └── public/
        ├── index.html       # Student portal SPA (result checker + admission screening)
        └── styles.css       # Student portal styles
```

### Server Architecture

The system uses **two separate Express.js servers** running on different ports:

| Server | Port | Purpose | Static Files Served |
|--------|------|---------|---------------------|
| **Student Server** | 3000 | Student-facing: authentication, result retrieval, admission screening | `Student server/public/` |
| **Admin Server** | 4000 | Admin-facing: student/result management, system configuration | `Admin server/public/` |

Both servers share the same SQLite database (`results.db`) and import common modules from the project root.

### Data Flow

1. **Student Result Checking:**
   - Login with matric number → email verification code → verify code → fetch results → NBTE grade processing → GPA/CGPA computation → display/print Statement of Results

2. **Admission Screening:**
   - Enter JAMB score + O'Level subjects → institutional evaluation → prerequisite checking → aggregate calculation → qualification status across institutions

3. **Admin Operations:**
   - PIN authentication → student/result management → configuration updates → data persistence to SQLite

---

## Getting Started

### Prerequisites

- **Node.js** v14 or higher
- **npm** (comes with Node.js)
- No external database — uses **SQLite** (file-based, zero configuration)

### Installation

```bash
# Install all dependencies
npm install
```

This installs:
- `express` — web framework
- `sqlite3` — database driver
- `bcryptjs` — password hashing
- `jsonwebtoken` — JWT authentication
- `nodemailer` — email delivery for verification codes
- `cors` — cross-origin resource sharing
- `nodemon` (dev) — hot reload during development

### Running the System

```bash
# Start both servers together (recommended)
npm start

# Or start individually
npm run start:student   # Student server on port 3000
npm run start:admin     # Admin server on port 4000
```

Access points after startup:
- **Student Portal:** http://localhost:3000
- **Admin Portal:** http://localhost:4000

#### Development Mode (with auto-reload)

```bash
# Start individual servers with nodemon for hot reloading
npm run dev:student   # Rebuilds on file changes
npm run dev:admin     # Rebuilds on file changes
```

### Seeding the Database

The database auto-seeds when the servers start. To manually seed or reset:

```bash
npm run seed
```

This creates the default test student account with sample ND 1 results.

---

## System Components

### Student Server (`Student server/student-server.js`)

**Entry Point:** Express.js application on port 3000

**Key Features:**
- Student authentication via matric number + one-time email token
- Result retrieval with NBTE 4.0 grade processing
- GPA and CGPA calculation
- Admission screening evaluation
- Serves `Student server/public/index.html`
- CORS middleware for cross-origin requests

**API Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check with system metadata |
| `POST` | `/api/auth/student-login` | Two-step login: request code or verify code |
| `GET` | `/api/results/:matric_no` | Direct result query by matric number |
| `GET` | `/api/screening/schools` | List available institutions for screening |
| `POST` | `/api/screening/evaluate` | Evaluate admission eligibility |

### Admin Server (`Admin server/admin-server.js`)

**Entry Point:** Express.js application on port 4000

**Key Features:**
- PIN-protected administrative endpoints
- Student registration and management
- Batch result uploading
- System configuration viewing and editing
- Serves `Admin server/public/admin.html`

### Shared Modules

#### `database.js`

Core database layer providing:

- **SQLite3 Integration:** Manages `results.db` file with three tables (students, results, auth_tokens)
- **NBTE 4.0 Logic:**
  - `getNBTEGradeAndPoint(score)` — converts numerical score to letter grade + grade point
  - `getNBTEClassification(cgpa)` — classifies academic standing from CGPA
- **Matric Number Parsing:** `parseFPIMatric(matricNo)` decodes FPI format: `YYSSMMIIII` → Year, School, Dept, Mode, ID
- **Auto-seeding:** Creates test student (2460113253) with full ND 1 sample results

#### `screening.js`

Admission screening engine with:

- **O'Level Grading:** A1=10, B2=9, B3=8, C4=7, C5=6, C6=5
- **Multi-institution Support:** FPI, YABATECH, MAPOLY, LASU, UNILAG
- **Screening Models:**
  - `JAMB_50_OLEVEL_50` — standard polytechnic model
  - `UNILAG_50_30_20` — University of Lagos specific model
- **Prerequisite Checking:** Validates required O'Level subjects per course
- **Aggregate Calculation:** Combines JAMB (50%) and O'Level (50%) scores

#### `emailToken.js`

Email verification helpers:

- Generates cryptographically random 8-character tokens via `crypto.randomBytes()`
- Sends formatted login emails via Nodemailer SMTP transport
- Configurable via environment variables (SMTP_HOST, SMTP_PORT, SMTP_USER, etc.)

#### `systemConfig.js`

SQLite-backed settings store:

- Persists all configurable system variables in a `settings` table
- Default values for institution identity, grading scale, classifications, school/department catalogs
- Admin-editable via API with in-memory caching
- Fallback to defaults when values are missing

---

## Database Schema

### Table: `students`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique identifier |
| matric_no | TEXT | UNIQUE NOT NULL | FPI matriculation number (10 digits) |
| password | TEXT | DEFAULT '12345678' | Student password (stored as-is for demo) |
| full_name | TEXT | NOT NULL | Student's full name |
| school | TEXT | DEFAULT 'School of Pure and Applied Sciences' | School affiliation |
| department | TEXT | NOT NULL | Department name |
| programme | TEXT | NOT NULL | Programme description (e.g., "ND Full-Time") |
| level | TEXT | NOT NULL | Academic level (e.g., "ND 1") |
| academic_session | TEXT | NOT NULL | Current academic session |
| email | TEXT | (nullable) | Email for verification codes |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Record creation timestamp |

### Table: `results`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique identifier |
| student_id | INTEGER | NOT NULL, FK → students.id | Student reference |
| course_code | TEXT | NOT NULL | Course code (e.g., "COM 111") |
| course_title | TEXT | NOT NULL | Full course title |
| credit_unit | INTEGER | NOT NULL | Credit unit value |
| score | REAL | NOT NULL | Raw score (0-100) |
| grade | TEXT | NOT NULL | NBTE letter grade (A, AB, B, etc.) |
| grade_point | REAL | NOT NULL | Grade point value (4.00, 3.50, etc.) |
| semester | TEXT | NOT NULL | Semester designation |
| academic_year | TEXT | NOT NULL | Academic year (e.g., "2024/2025") |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Record creation timestamp |

**Foreign Key:** `ON DELETE CASCADE` — deleting a student removes all their results.

### Table: `auth_tokens`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique identifier |
| student_id | INTEGER | NOT NULL, FK → students.id | Student reference |
| token | TEXT | NOT NULL | Verification code |
| expires_at | DATETIME | NOT NULL | Token expiration time |
| used | INTEGER | DEFAULT 0 | Whether token has been used |

### Table: `settings` (for systemConfig.js)

| Column | Type | Description |
|--------|------|-------------|
| key | TEXT PRIMARY KEY | Setting identifier |
| value | TEXT | JSON string of setting value |
| updated_at | DATETIME | Last modification timestamp |

---

## Authentication

### Student Login Flow (Two-Step)

1. **Step 1 — Request Code:**
   - Student submits matric number via `/api/auth/student-login`
   - System checks if student exists and has an email on file
   - If valid, generates an 8-character random token
   - Stores token in `auth_tokens` table with 10-minute expiry
   - Sends token to student's email via `emailToken.js`
   - Returns a "check your email" response

2. **Step 2 — Verify Code:**
   - Student submits matric number + token
   - System validates token against stored record
   - Checks token not expired and not already used
   - Marks token as used
   - Returns full student data + results payload on success

**Security Note:** The system returns the same generic message whether the matric exists or not to prevent user enumeration.

### Admin Authentication

- Admin endpoints are protected by a PIN system
- Default admin PIN: check system configuration
- PIN validation happens on each request (no session persistence)

---

## Admission Screening

### How It Works

The screening engine evaluates a candidate's admission eligibility across multiple institutions and courses:

1. **Input:**
   - JAMB score (0-400)
   - 5 O'Level subjects with grades (WAEC/NECO/NABTEB)
   - Number of sittings (1 or 2)
   - Target institution and course

2. **Processing:**
   - Converts JAMB score to 50-point scale: `JAMB/8`
   - Converts O'Level grades to points using institution-specific scheme
   - Applies sitting deductions where applicable
   - Checks prerequisite subject requirements
   - Compares against institution/course cut-offs

3. **Output:**
   - Primary choice evaluation with detailed breakdown
   - Aggregate score and qualification status
   - List of eligible alternative institutions/courses

### Status Categories

| Status | Meaning |
|--------|---------|
| `QUALIFIED_MERIT` | Meets merit list cut-off |
| `BORDERLINE_COMPETITIVE` | Within supplementary/concession range |
| `BELOW_AGGREGATE` | Below departmental aggregate cut-off |
| `BELOW_COURSE_JAMB` | Below departmental JAMB cut-off |
| `BELOW_INST_JAMB` | Below institution general cut-off |
| `DEFICIENT_SUBJECTS` | Missing required O'Level subjects |
| `DEFICIENT_OLEVEL` | Fewer than 5 credit passes |

---

## System Configuration

All editable system variables are stored in the `settings` SQLite table and managed through `systemConfig.js`.

### Default Settings

```javascript
{
  institution: {
    name: 'The Federal Polytechnic, Ilaro',
    shortName: 'FPI',
    gradingStandard: 'NBTE 4.0',
    motto: 'Technology for Self Reliance'
  },
  grade_scale: [
    { min: 75, max: 100, grade: 'A', gradePoint: 4.0, remark: 'Distinction' },
    { min: 70, max: 74, grade: 'AB', gradePoint: 3.5, remark: 'Very Good' },
    { min: 65, max: 69, grade: 'B', gradePoint: 3.25, remark: 'Good' },
    { min: 60, max: 64, grade: 'BC', gradePoint: 3.0, remark: 'Credit' },
    { min: 55, max: 59, grade: 'C', gradePoint: 2.75, remark: 'Credit' },
    { min: 50, max: 54, grade: 'CD', gradePoint: 2.5, remark: 'Credit' },
    { min: 45, max: 49, grade: 'D', gradePoint: 2.25, remark: 'Pass' },
    { min: 40, max: 44, grade: 'E', gradePoint: 2.0, remark: 'Pass' },
    { min: 0, max: 39, grade: 'F', gradePoint: 0.0, remark: 'Fail' }
  ],
  classifications: [
    { min: 3.5, max: 4.0, label: 'Distinction' },
    { min: 3.0, max: 3.49, label: 'Upper Credit' },
    { min: 2.5, max: 2.99, label: 'Lower Credit' },
    { min: 2.0, max: 2.49, label: 'Pass' },
    { min: 0.0, max: 1.99, label: 'Fail' }
  ],
  schools: [...],        // 5 schools with codes
  departments: [...],     // 5 departments with codes
  modes: [...],          // Full-Time, Part-Time
  matric_format: {...},  // Format specification
  admin_pin: 'FPI-ADMIN-2026'
}
```

### NBTE 4.0 Grading Scale

| Score Range | Grade | Grade Point | Remark |
|-------------|-------|-------------|--------|
| 75-100 | A | 4.00 | Distinction |
| 70-74 | AB | 3.50 | Very Good |
| 65-69 | B | 3.25 | Good |
| 60-64 | BC | 3.00 | Credit |
| 55-59 | C | 2.75 | Credit |
| 50-54 | CD | 2.50 | Credit |
| 45-49 | D | 2.25 | Pass |
| 40-44 | E | 2.00 | Pass |
| 0-39 | F | 0.00 | Fail |

### Academic Classification (by CGPA)

| CGPA Range | Classification |
|------------|----------------|
| 3.50-4.00 | Distinction |
| 3.00-3.49 | Upper Credit |
| 2.50-2.99 | Lower Credit |
| 2.00-2.49 | Pass |
| 0.00-1.99 | Fail |

### FPI Matric Number Format

```
Format: YY SS D M IIII
Example: 24 60 1 1 3253

YY = Entry Year (24 = 2024)
SS = School Code (60 = School of Pure and Applied Sciences)
D  = Department Code (1 = Computer Science)
M  = Mode Code (1 = Full-Time)
IIII = Student ID (3253)
```

---

## Frontend Interfaces

### Student Portal (`Student server/public/index.html`)

Single-page application with two main screens:

1. **Result Checker Screen:**
   - Login via modal (matric number → verification code)
   - Displays full Statement of Results as printable document
   - Shows semester-by-semester breakdown with GPA
   - Cumulative summary with CGPA and classification
   - Print-ready formatting with institutional header

2. **Admission Screening Screen:**
   - JAMB score input
   - O'Level subject/grade selection (5 subjects)
   - Institution and course selection
   - Sittings count
   - Displays evaluation report with qualification status

**Features:**
- Dark/light theme toggle with persistence
- Responsive design (sidebar on desktop, top tabs on mobile)
- Real-time API communication via `fetch()`
- Font Awesome icons and Google Fonts (Inter, JetBrains Mono)

### Admin Portal (`Admin server/public/admin.html`)

Administrative interface with PIN-protected access:

- Student list with search
- Student registration form
- Batch result upload
- System configuration viewer/editor
- Results management

---

## Testing

### Test Account

| Field | Value |
|-------|-------|
| Matric Number | `2460113253` |
| Password | `12345678` |
| Email | (not set by default) |
| Name | ADEWALE OLUWASEUN IBRAHIM |
| School | School of Pure and Applied Sciences |
| Department | Computer Science |
| Programme | National Diploma (ND) Full-Time |
| Level | ND 1 |
| Session | 2024/2025 |

**Note:** For the email verification flow to work, an SMTP server must be configured. For testing without email, modify `student-server.js` to skip the email step.

### Manual Testing

1. Start the system: `npm start`
2. Open http://localhost:3000 in a browser
3. Use test account `2460113253 / 12345678`
4. For admin: open http://localhost:4000 and use the admin PIN

### API Testing with cURL

```bash
# Health check
curl http://localhost:3000/api/health

# Request login code
curl -X POST http://localhost:3000/api/auth/student-login \
  -H "Content-Type: application/json" \
  -d '{"matric_no": "2460113253"}'

# Verify code (once you have it)
curl -X POST http://localhost:3000/api/auth/student-login \
  -H "Content-Type: application/json" \
  -d '{"matric_no": "2460113253", "token": "ABC12345"}'

# Get results directly
curl http://localhost:3000/api/results/2460113253

# Screening evaluation
curl -X POST http://localhost:3000/api/screening/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "jambScore": 220,
    "olevelSubjects": [
      {"subject": "English Language", "grade": "A1"},
      {"subject": "Mathematics", "grade": "B3"},
      {"subject": "Physics", "grade": "C4"},
      {"subject": "Chemistry", "grade": "B2"},
      {"subject": "Biology", "grade": "C5"}
    ],
    "sittings": 1,
    "targetCourseCode": "COM",
    "targetInstitutionId": "fpi"
  }'
```

---

## Security Considerations

1. **Password Storage:** Current implementation stores passwords in plain text. For production, use bcrypt or similar hashing.
2. **Email Verification:** Requires configured SMTP server. Default uses Ethereal for testing.
3. **Admin PIN:** Change the default PIN before deployment.
4. **Input Validation:** All user inputs are validated and sanitized.
5. **CORS:** Configured to allow cross-origin requests for development; restrict in production.
6. **Token Expiry:** Verification tokens expire after 10 minutes and are single-use.

---

## Development

### Project Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start both servers via `start-all.js` |
| `npm run start:student` | Start student server only |
| `npm run start:admin` | Start admin server only |
| `npm run dev:student` | Student server with nodemon (auto-reload) |
| `npm run dev:admin` | Admin server with nodemon (auto-reload) |
| `npm run seed` | Seed database with test data |

### Environment Variables

For email functionality:

| Variable | Description | Default |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP server hostname | `smtp.ethereal.email` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_SECURE` | Use TLS | `false` |
| `SMTP_USER` | SMTP username | (empty) |
| `SMTP_PASS` | SMTP password | (empty) |
| `SMTP_FROM` | Sender email address | `no-reply@fpi.edu.ng` |

### Adding New Institutions

Edit the `INSTITUTIONS` array in `screening.js` to add or modify institutional screening criteria.

### Modifying the Grading Scale

Edit the `grade_scale` array in `systemConfig.js` or `getNBTEGradeAndPoint()` in `database.js`.

---

## License

This project was developed for academic purposes at The Federal Polytechnic, Ilaro.

---

*Built with Node.js, Express, SQLite, and vanilla JavaScript.*
