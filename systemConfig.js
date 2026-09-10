/**
 * systemConfig.js
 * SQLite-backed System Settings Store + In-Memory Cache
 * Federal Polytechnic, Ilaro - Admin-Editable System Variables
 *
 * All variables that determine the system's output (grading scale,
 * classification thresholds, school/department/mode catalogs, matric
 * number format, institution identity, admin PIN) live here as editable
 * settings, persisted in the `settings` SQLite table.
 */

const DEFAULT_SETTINGS = {
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
  schools: [
    { code: '20', name: 'School of Management Studies' },
    { code: '30', name: 'School of Environmental Studies' },
    { code: '40', name: 'School of Engineering' },
    { code: '50', name: 'School of Communication & Info Tech' },
    { code: '60', name: 'School of Pure and Applied Sciences' }
  ],
  departments: [
    { code: '1', name: 'Computer Science', schoolCode: '60' },
    { code: '2', name: 'Science Laboratory Technology (SLT)', schoolCode: '60' },
    { code: '3', name: 'Mathematics & Statistics', schoolCode: '60' },
    { code: '4', name: 'Food Technology', schoolCode: '60' },
    { code: '5', name: 'Hospitality Management', schoolCode: '60' }
  ],
  modes: [
    { code: '1', name: 'Full-Time' },
    { code: '2', name: 'Part-Time' }
  ],
  matric_format: {
    yearDigits: 2,
    schoolDigits: 2,
    deptDigits: 1,
    modeDigits: 1,
    idDigits: 4,
    separator: '-'
  },
  admin_pin: 'FPI-ADMIN-2026'
};

// Settings keys that can be edited via the admin API
const EDITABLE_KEYS = Object.keys(DEFAULT_SETTINGS);

let cache = { ...DEFAULT_SETTINGS };
let dbRef = null;
let initialized = false;

/**
 * Deep clone default settings (avoid shared object mutation).
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Initialize the settings store.
 * - Ensures the `settings` table seeded with defaults where missing.
 * - Loads persisted values into the in-memory cache.
 * @param {import('sqlite3').Database} db - SQLite database instance.
 */
function init(db) {
  if (!db) return;
  dbRef = db;

  const stmt = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
  );
  Object.keys(DEFAULT_SETTINGS).forEach((key) => {
    stmt.run(key, JSON.stringify(DEFAULT_SETTINGS[key]));
  });
  stmt.finalize();

  // Load persisted values into cache (superseding defaults)
  db.all('SELECT key, value FROM settings', (err, rows) => {
    if (err) {
      console.error('[CONFIG ERROR] Failed to load settings:', err.message);
      cache = deepClone(DEFAULT_SETTINGS);
      return;
    }
    const loaded = {};
    (rows || []).forEach((row) => {
      try {
        loaded[row.key] = JSON.parse(row.value);
      } catch (e) {
        loaded[row.key] = DEFAULT_SETTINGS[row.key];
      }
    });
    cache = {
      ...deepClone(DEFAULT_SETTINGS),
      ...loaded
    };
    initialized = true;
  });
}

/**
 * Get a single setting value (falls back to default).
 * @param {string} key
 */
function getSetting(key) {
  if (key in cache) return cache[key];
  if (key in DEFAULT_SETTINGS) return deepClone(DEFAULT_SETTINGS[key]);
  return undefined;
}

/**
 * Get all current settings.
 */
function getAllSettings() {
  return deepClone(cache);
}

/**
 * Persist one setting to SQLite and refresh the cache.
 * @param {string} key
 * @param {*} value
 * @returns {Promise<void>}
 */
function setSetting(key, value) {
  return new Promise((resolve, reject) => {
    if (!dbRef) return reject(new Error('Settings store not initialized.'));
    if (!(key in DEFAULT_SETTINGS)) {
      return reject(new Error(`Unknown setting key: "${key}".`));
    }

    dbRef.run(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      [key, JSON.stringify(value)],
      (err) => {
        if (err) return reject(err);
        cache[key] = deepClone(value);
        resolve(deepClone(value));
      }
    );
  });
}

/**
 * Reset all settings to defaults.
 * @returns {Promise<void>}
 */
function resetAllSettings() {
  cache = deepClone(DEFAULT_SETTINGS);
  return setSetting('institution', DEFAULT_SETTINGS.institution);
}

module.exports = {
  DEFAULT_SETTINGS,
  EDITABLE_KEYS,
  init,
  getSetting,
  getAllSettings,
  setSetting,
  resetAllSettings,
  isInitialized: () => initialized
};