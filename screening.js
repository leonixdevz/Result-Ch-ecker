/**
 * screening.js
 * Comprehensive JAMB & O'Level (WAEC/NECO/NABTEB) Admission Screening Engine
 * Supports standard Nigerian Polytechnic & University Post-UTME Aggregate Calculation Models
 */

// O'Level Grade-to-Point Conversion Systems
const OLEVEL_POINTS_POLY = {
  'A1': 10,
  'B2': 9,
  'B3': 8,
  'C4': 7,
  'C5': 6,
  'C6': 5,
  'D7': 0, // Pass - Not Credit
  'E8': 0, // Pass - Not Credit
  'F9': 0  // Fail
};

const OLEVEL_CREDIT_GRADES = new Set(['A1', 'B2', 'B3', 'C4', 'C5', 'C6']);

// Institutional Database with General Cut-Offs and Departmental Merit Benchmarks
const INSTITUTIONS = [
  {
    id: 'fpi',
    name: 'The Federal Polytechnic, Ilaro',
    shortName: 'FPI',
    type: 'Polytechnic',
    state: 'Ogun',
    generalCutOff: 150,
    screeningModel: 'JAMB_50_OLEVEL_50', // (JAMB/8) + OLevel Points (max 50)
    sittingDeduction: 2, // 2 points deduction for 2 sittings
    courses: [
      {
        code: 'COM',
        name: 'Computer Science',
        degree: 'ND',
        jambCutOff: 170,
        aggregateCutOff: 62.0,
        requiredOLevel: ['English Language', 'Mathematics', 'Physics'],
        electiveOptions: ['Chemistry', 'Biology', 'Agricultural Science', 'Further Mathematics', 'Economics', 'Computer Studies']
      },
      {
        code: 'EEE',
        name: 'Electrical/Electronic Engineering',
        degree: 'ND',
        jambCutOff: 160,
        aggregateCutOff: 58.0,
        requiredOLevel: ['English Language', 'Mathematics', 'Physics', 'Chemistry'],
        electiveOptions: ['Technical Drawing', 'Further Mathematics', 'Biology', 'Agricultural Science']
      },
      {
        code: 'SLT',
        name: 'Science Laboratory Technology (SLT)',
        degree: 'ND',
        jambCutOff: 160,
        aggregateCutOff: 57.5,
        requiredOLevel: ['English Language', 'Mathematics', 'Chemistry', 'Biology'],
        electiveOptions: ['Physics', 'Agricultural Science', 'Geography']
      },
      {
        code: 'ACC',
        name: 'Accountancy',
        degree: 'ND',
        jambCutOff: 165,
        aggregateCutOff: 60.0,
        requiredOLevel: ['English Language', 'Mathematics', 'Economics'],
        electiveOptions: ['Financial Accounting', 'Commerce', 'Government', 'Civic Education', 'Book Keeping']
      },
      {
        code: 'BAM',
        name: 'Business Administration & Management',
        degree: 'ND',
        jambCutOff: 160,
        aggregateCutOff: 56.5,
        requiredOLevel: ['English Language', 'Mathematics', 'Economics'],
        electiveOptions: ['Commerce', 'Government', 'Business Methods', 'Accounting', 'Civic Education']
      },
      {
        code: 'MAC',
        name: 'Mass Communication',
        degree: 'ND',
        jambCutOff: 175,
        aggregateCutOff: 64.0,
        requiredOLevel: ['English Language', 'Mathematics', 'Literature in English'],
        electiveOptions: ['Government', 'Economics', 'CRS/IRS', 'History', 'Civic Education']
      }
    ]
  },
  {
    id: 'yabatech',
    name: 'Yaba College of Technology',
    shortName: 'YABATECH',
    type: 'Polytechnic',
    state: 'Lagos',
    generalCutOff: 160,
    screeningModel: 'JAMB_50_OLEVEL_50',
    sittingDeduction: 2.5,
    courses: [
      {
        code: 'COM',
        name: 'Computer Science',
        degree: 'ND',
        jambCutOff: 180,
        aggregateCutOff: 66.0,
        requiredOLevel: ['English Language', 'Mathematics', 'Physics'],
        electiveOptions: ['Chemistry', 'Biology', 'Further Mathematics', 'Economics']
      },
      {
        code: 'EEE',
        name: 'Electrical/Electronic Engineering',
        degree: 'ND',
        jambCutOff: 170,
        aggregateCutOff: 61.5,
        requiredOLevel: ['English Language', 'Mathematics', 'Physics', 'Chemistry'],
        electiveOptions: ['Technical Drawing', 'Further Mathematics']
      },
      {
        code: 'ACC',
        name: 'Accountancy',
        degree: 'ND',
        jambCutOff: 175,
        aggregateCutOff: 63.0,
        requiredOLevel: ['English Language', 'Mathematics', 'Economics'],
        electiveOptions: ['Financial Accounting', 'Commerce', 'Government']
      }
    ]
  },
  {
    id: 'mapoly',
    name: 'Moshood Abiola Polytechnic',
    shortName: 'MAPOLY',
    type: 'Polytechnic',
    state: 'Ogun',
    generalCutOff: 140,
    screeningModel: 'JAMB_50_OLEVEL_50',
    sittingDeduction: 0,
    courses: [
      {
        code: 'COM',
        name: 'Computer Science',
        degree: 'ND',
        jambCutOff: 150,
        aggregateCutOff: 54.0,
        requiredOLevel: ['English Language', 'Mathematics', 'Physics'],
        electiveOptions: ['Chemistry', 'Biology', 'Economics']
      },
      {
        code: 'MAC',
        name: 'Mass Communication',
        degree: 'ND',
        jambCutOff: 160,
        aggregateCutOff: 58.0,
        requiredOLevel: ['English Language', 'Mathematics', 'Literature in English'],
        electiveOptions: ['Government', 'Economics', 'CRS/IRS']
      }
    ]
  },
  {
    id: 'lasu',
    name: 'Lagos State University',
    shortName: 'LASU',
    type: 'University',
    state: 'Lagos',
    generalCutOff: 195,
    screeningModel: 'JAMB_50_OLEVEL_50',
    sittingDeduction: 3,
    courses: [
      {
        code: 'CSC',
        name: 'Computer Science',
        degree: 'B.Sc',
        jambCutOff: 220,
        aggregateCutOff: 72.0,
        requiredOLevel: ['English Language', 'Mathematics', 'Physics', 'Chemistry'],
        electiveOptions: ['Further Mathematics', 'Biology', 'Economics']
      },
      {
        code: 'ECO',
        name: 'Economics',
        degree: 'B.Sc',
        jambCutOff: 210,
        aggregateCutOff: 68.0,
        requiredOLevel: ['English Language', 'Mathematics', 'Economics'],
        electiveOptions: ['Commerce', 'Accounting', 'Government']
      }
    ]
  },
  {
    id: 'unilag',
    name: 'University of Lagos',
    shortName: 'UNILAG',
    type: 'University',
    state: 'Lagos',
    generalCutOff: 200,
    screeningModel: 'UNILAG_50_30_20', // JAMB 50% + OLevel 20% (Max 20 pts) + Exam 30%
    sittingDeduction: 0,
    courses: [
      {
        code: 'CSC',
        name: 'Computer Science',
        degree: 'B.Sc',
        jambCutOff: 240,
        aggregateCutOff: 78.5,
        requiredOLevel: ['English Language', 'Mathematics', 'Physics', 'Chemistry'],
        electiveOptions: ['Further Mathematics', 'Biology']
      },
      {
        code: 'ACC',
        name: 'Accounting',
        degree: 'B.Sc',
        jambCutOff: 235,
        aggregateCutOff: 76.0,
        requiredOLevel: ['English Language', 'Mathematics', 'Economics'],
        electiveOptions: ['Financial Accounting', 'Commerce', 'Government']
      }
    ]
  }
];

/**
 * Calculate O'Level Total Points from 5 relevant subjects
 * Standard Polytechnic/LASU Model (max 50 points):
 * A1=10, B2=9, B3=8, C4=7, C5=6, C6=5
 */
function calculateOLevelPoints(olevelSubjects, sittings = 1, deduction = 0) {
  let totalPoints = 0;
  const gradedSubjects = [];

  olevelSubjects.slice(0, 5).forEach((item) => {
    const pts = OLEVEL_POINTS_POLY[item.grade] || 0;
    totalPoints += pts;
    gradedSubjects.push({
      subject: item.subject,
      grade: item.grade,
      points: pts,
      isCredit: OLEVEL_CREDIT_GRADES.has(item.grade)
    });
  });

  let adjustedPoints = totalPoints;
  if (sittings > 1 && deduction > 0) {
    adjustedPoints = Math.max(0, totalPoints - deduction);
  }

  return {
    rawPoints: totalPoints,
    adjustedPoints: Number(adjustedPoints.toFixed(2)),
    deduction: sittings > 1 ? deduction : 0,
    gradedSubjects
  };
}

/**
 * Verify Course Prerequisites
 * Checks if candidate has at least 5 credit passes (A1 - C6),
 * specifically in required subjects (e.g. English, Maths, Physics).
 */
function checkPrerequisites(olevelSubjects, requiredSubjects) {
  const creditSubjectMap = new Map();

  olevelSubjects.forEach((item) => {
    if (OLEVEL_CREDIT_GRADES.has(item.grade)) {
      creditSubjectMap.set(item.subject.toLowerCase(), item.grade);
    }
  });

  const totalCredits = creditSubjectMap.size;
  const missingPrerequisites = [];
  const passedPrerequisites = [];

  requiredSubjects.forEach((reqSub) => {
    const cleanSub = reqSub.toLowerCase();
    if (creditSubjectMap.has(cleanSub)) {
      passedPrerequisites.push({
        subject: reqSub,
        grade: creditSubjectMap.get(cleanSub)
      });
    } else {
      missingPrerequisites.push(reqSub);
    }
  });

  const meetsCreditCount = totalCredits >= 5;
  const meetsRequiredSubjects = missingPrerequisites.length === 0;

  return {
    meetsCreditCount,
    totalCredits,
    meetsRequiredSubjects,
    missingPrerequisites,
    passedPrerequisites,
    isOLevelQualified: meetsCreditCount && meetsRequiredSubjects
  };
}

/**
 * Evaluate Candidate Admission Qualification Across Institutions and Courses
 *
 * @param {Object} candidate
 * @param {number} candidate.jambScore - (0 - 400)
 * @param {Array<{subject: string, grade: string}>} candidate.olevelSubjects - (Array of 5-9 subjects)
 * @param {number} candidate.sittings - (1 or 2)
 * @param {string} candidate.targetCourseCode - (e.g. 'COM' or 'Computer Science')
 * @param {string} [candidate.targetInstitutionId] - (e.g. 'fpi')
 * @returns {Object} Comprehensive Evaluation Result
 */
function evaluateAdmissionEligibility(candidate) {
  const jambScore = Number(candidate.jambScore) || 0;
  const sittings = Number(candidate.sittings) || 1;
  const olevelSubjects = Array.isArray(candidate.olevelSubjects) ? candidate.olevelSubjects : [];
  const targetCourseCode = (candidate.targetCourseCode || '').trim().toUpperCase();
  const targetInstitutionId = (candidate.targetInstitutionId || 'fpi').trim().toLowerCase();

  // Basic Input Validation
  if (jambScore < 0 || jambScore > 400) {
    throw new Error(`Invalid JAMB Score: ${jambScore}. Must be between 0 and 400.`);
  }

  if (olevelSubjects.length < 5) {
    throw new Error('Please provide at least 5 O\'Level subjects with grades.');
  }

  // JAMB 50% Component
  const jambComponent = Number((jambScore / 8).toFixed(2)); // Out of 50 points

  const institutionEvaluations = [];
  let primaryChoiceEvaluation = null;
  const eligibleAlternatives = [];

  INSTITUTIONS.forEach((inst) => {
    const isTargetInst = inst.id === targetInstitutionId;
    const olevelResult = calculateOLevelPoints(olevelSubjects, sittings, inst.sittingDeduction);
    const aggregateScore = Number((jambComponent + olevelResult.adjustedPoints).toFixed(2));

    const courseEvaluations = inst.courses.map((course) => {
      const prereq = checkPrerequisites(olevelSubjects, course.requiredOLevel);
      const meetsJambGeneral = jambScore >= inst.generalCutOff;
      const meetsJambCourse = jambScore >= course.jambCutOff;
      const meetsAggregate = aggregateScore >= course.aggregateCutOff;

      let status = 'NOT_QUALIFIED';
      let statusLabel = 'Not Qualified';
      let statusColor = 'red';
      let recommendationReason = '';

      if (!prereq.meetsCreditCount) {
        status = 'DEFICIENT_OLEVEL';
        statusLabel = 'Deficient in O\'Level Credits';
        recommendationReason = `Candidate has ${prereq.totalCredits} credits out of required 5 credit passes.`;
      } else if (!prereq.meetsRequiredSubjects) {
        status = 'DEFICIENT_SUBJECTS';
        statusLabel = 'Missing Prerequisite Subjects';
        recommendationReason = `Missing required credit(s) in: ${prereq.missingPrerequisites.join(', ')}.`;
      } else if (!meetsJambGeneral) {
        status = 'BELOW_INST_JAMB';
        statusLabel = 'Below Institution Cut-Off';
        recommendationReason = `JAMB score (${jambScore}) is below general cut-off (${inst.generalCutOff}).`;
      } else if (!meetsJambCourse) {
        status = 'BELOW_COURSE_JAMB';
        statusLabel = 'Below Departmental JAMB Cut-Off';
        recommendationReason = `JAMB score (${jambScore}) is below departmental cut-off (${course.jambCutOff}).`;
      } else if (meetsAggregate) {
        status = 'QUALIFIED_MERIT';
        statusLabel = 'Qualified for Admission (Merit List)';
        statusColor = 'emerald';
        recommendationReason = `Aggregate score (${aggregateScore}%) exceeds departmental merit benchmark (${course.aggregateCutOff}%).`;
      } else if (aggregateScore >= (course.aggregateCutOff - 3.5)) {
        status = 'BORDERLINE_COMPETITIVE';
        statusLabel = 'Competitive / Supplementary List';
        statusColor = 'amber';
        recommendationReason = `Aggregate score (${aggregateScore}%) is within competitive range for supplementary/concession list.`;
      } else {
        status = 'BELOW_AGGREGATE';
        statusLabel = 'Below Departmental Aggregate';
        recommendationReason = `Aggregate score (${aggregateScore}%) is below departmental cut-off (${course.aggregateCutOff}%).`;
      }

      const evalData = {
        courseCode: course.code,
        courseName: course.name,
        degree: course.degree,
        jambCutOff: course.jambCutOff,
        aggregateCutOff: course.aggregateCutOff,
        requiredOLevel: course.requiredOLevel,
        status,
        statusLabel,
        statusColor,
        isQualified: status === 'QUALIFIED_MERIT',
        isCompetitive: status === 'BORDERLINE_COMPETITIVE',
        recommendationReason,
        prerequisiteCheck: prereq
      };

      // Check if this matches primary choice
      const isTargetCourse = (course.code.toUpperCase() === targetCourseCode) ||
        course.name.toUpperCase().includes(targetCourseCode);

      if (isTargetInst && isTargetCourse && !primaryChoiceEvaluation) {
        primaryChoiceEvaluation = {
          institution: {
            id: inst.id,
            name: inst.name,
            shortName: inst.shortName,
            type: inst.type,
            state: inst.state
          },
          jambScore,
          jambComponent,
          olevelPoints: olevelResult.adjustedPoints,
          olevelDeduction: olevelResult.deduction,
          aggregateScore,
          course: evalData
        };
      }

      // Collect eligible alternatives in any listed institution
      if (evalData.isQualified || evalData.isCompetitive) {
        eligibleAlternatives.push({
          institutionName: inst.name,
          institutionShort: inst.shortName,
          institutionType: inst.type,
          courseName: course.name,
          degree: course.degree,
          aggregateCutOff: course.aggregateCutOff,
          candidateAggregate: aggregateScore,
          status: evalData.statusLabel,
          statusColor: evalData.statusColor
        });
      }

      return evalData;
    });

    institutionEvaluations.push({
      institution: {
        id: inst.id,
        name: inst.name,
        shortName: inst.shortName,
        type: inst.type,
        state: inst.state,
        generalCutOff: inst.generalCutOff
      },
      olevelBreakdown: olevelResult,
      aggregateScore,
      courses: courseEvaluations
    });
  });

  // Fallback if target was not found in specific course
  if (!primaryChoiceEvaluation && institutionEvaluations.length > 0) {
    const fpiInst = institutionEvaluations.find(i => i.institution.id === 'fpi') || institutionEvaluations[0];
    const defaultCourse = fpiInst.courses[0];
    primaryChoiceEvaluation = {
      institution: fpiInst.institution,
      jambScore,
      jambComponent,
      olevelPoints: fpiInst.olevelBreakdown.adjustedPoints,
      olevelDeduction: fpiInst.olevelBreakdown.deduction,
      aggregateScore: fpiInst.aggregateScore,
      course: defaultCourse
    };
  }

  return {
    candidate: {
      jambScore,
      sittings,
      olevelSubjectsCount: olevelSubjects.length
    },
    primaryChoice: primaryChoiceEvaluation,
    eligibleAlternatives,
    allInstitutions: institutionEvaluations
  };
}

module.exports = {
  INSTITUTIONS,
  OLEVEL_POINTS_POLY,
  OLEVEL_CREDIT_GRADES,
  calculateOLevelPoints,
  checkPrerequisites,
  evaluateAdmissionEligibility
};
