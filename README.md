Project Structure Summary for Chapters 3 and 4

Overview

The FPI Student Result Checker System is a Node.js-based web
application designed for Federal Polytechnic, Ilaro,
implementing the NBTE 4.0 grading standard. It provides both
student result checking and admission screening capabilities.

Core Components

1. Backend API (server.js)

- Main Entry Point: Express.js application serving as the
  unified API
- Key Features:
  - Student authentication via matric number/password
  - Result retrieval and processing
  - Admission screening evaluation
  - Admin management endpoints
  - Static file serving from public/ directory
  - CORS middleware for cross-origin requests

2. Database Layer (database.js)

- SQLite3 Integration: Manages results.db file
- NBTE 4.0 Logic:
  - Score-to-grade conversion (A=75+, AB=70+, B=65+, etc.)
  - Academic classification based on CGPA (Distinction≥3.5,
    Upper Credit≥3.0, etc.)
- Matric Number Parsing: Decodes FPI format (YYSSMMIIII →
  Year, School, Dept, Mode, ID)
- Auto-seeding: Creates test student (2460113253) with sample
  results

3. Admission Screening Engine (screening.js)

- O'Level Grading: Standard conversion (A1=10, B2=9, B3=8,
  C4=7, C5=6, C6=5)
- Multi-institution Support: FPI, YABATECH, MAPOLY, LASU,
  UNILAG
- Screening Models:
  - JAMB_50_OLEVEL_50 (most polytechnics)
  - UNILAG_50_30_20 (University of Lagos specific)
- Prerequisite Checking: Validates required O'Level subjects
  per course
- Aggregate Calculation: Combines JAMB (50%) and O'Level
  (50%) scores

4. System Configuration (systemConfig.js)

- SQLite-backed Settings: Persistent admin-editable
  configuration
- Default Values:
  - Institution: "The Federal Polytechnic, Ilaro" (FPI)
  - Grading Scale: NBTE 4.0 with 9 grade bands
  - Classifications: Distinction (≥3.5), Upper Credit
    (3.0-3.49), etc.
  - School/Department/Mode catalogs
  - Matric number format specification
  - Admin PIN: 'FPI-ADMIN-2026'

5. Frontend Interface (public/index.html)

- Single Page Application: Two-tab interface
  - Result Checker Tab: Student login + results
    display/printing
  - Admission Screener Tab: JAMB/O'Level evaluation form
- Styling: Tailwind CSS via CDN with custom brand colors
- Features:
  - Matric number auto-fill helper (test account:
    2460113253/12345678)
  - Print-friendly result statements with institutional
    header
  - Real-time API communication via fetch()
  - Responsive design for mobile/desktop

6. Admin Interface (public/admin.html)

- Administrative Functions (protected by PIN):
  - Student registration and management
  - Batch result uploading
  - System configuration viewing/editing
  - Student list with search capability

Technical Stack

- Runtime: Node.js
- Framework: Express.js
- Database: SQLite3
- Frontend: HTML5, Tailwind CSS (CDN), Vanilla JavaScript
- Security:
  - Password-based student authentication
  - PIN-protected admin access
  - Input validation and sanitization
  - CORS middleware
- API Design: RESTful endpoints with JSON responses

Data Flow

1. Student Result Checking:
   - Login → Credential validation → Data retrieval → NBTE
     processing → GPA/CGPA calculation → Result formatting →
     Display/print
2. Admission Screening:
   - Form submission → JAMB/O'Level processing →
     Institutional evaluation → Prerequisite checking →
     Aggregate calculation → Qualification status → Results
     display
3. Admin Operations:
   - PIN authentication → Student/result management →
     Configuration updates → Data persistence to SQLite

Key Features Summary

- NBTE 4.0 Compliant: Accurate grade point and classification
  calculations
- FPI-specific: Custom matric number format parsing and
  institutional data
- Multi-purpose: Combines result checking with admission
  screening
- Print-ready: Official statement of results formatting
- Extensible: Configurable settings via systemConfig.js
- Test-ready: Pre-seeded with sample student data for
  immediate testing

This modular architecture separates concerns effectively
while maintaining tight integration between the result
checking and admission screening functionalities, all built
around the NBTE 4.0 standard as requested by Federal
Polytechnic, Ilaro.
