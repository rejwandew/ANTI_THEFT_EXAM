/**
 * Exams Catalog Configuration & Registry Engine
 * 
 * Collects and registers exams from modular files organized by:
 * exams/[subject]/[chapter]/quiz_[no].js
 */

const EXAMS_CATALOG = [];

/**
 * Register an exam into the global catalog
 * Called automatically by each quiz file when loaded.
 */
function registerExamToCatalog(exam) {
  if (!exam || !exam.id) return;
  const existingIdx = EXAMS_CATALOG.findIndex(e => e.id === exam.id);
  if (existingIdx >= 0) {
    EXAMS_CATALOG[existingIdx] = exam;
  } else {
    EXAMS_CATALOG.push(exam);
  }
}

/**
 * Returns all exams, merging built-in EXAMS_CATALOG with any custom exams
 * created by teachers in the Admin Dashboard (stored in localStorage).
 */
function getAllExamsCatalog() {
  let custom = [];
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('custom_exams_catalog');
      if (saved) {
        custom = JSON.parse(saved);
      }
    }
  } catch (e) {
    console.warn("Could not read custom_exams_catalog from localStorage:", e);
  }

  // Merge catalog with custom exams (avoiding duplicate IDs)
  const all = [...EXAMS_CATALOG];
  custom.forEach(c => {
    if (!all.some(e => e.id === c.id)) {
      all.push(c);
    }
  });

  return all;
}

/**
 * Helper to find an exam by its unique ID
 */
function getExamById(id) {
  return getAllExamsCatalog().find(e => e.id === id);
}

// In Node.js environment, automatically require the modular exams for testing
if (typeof module !== 'undefined' && module.exports) {
  try {
    const q1 = require('../exams/math/chapter_10.3/quiz_1.js');
    const q2 = require('../exams/math/chapter_11/quiz_1.js');
    const q3 = require('../exams/science/chapter_07/quiz_1.js');
    registerExamToCatalog(q1);
    registerExamToCatalog(q2);
    registerExamToCatalog(q3);
  } catch (e) {}

  module.exports = { 
    EXAMS_CATALOG, 
    registerExamToCatalog, 
    getAllExamsCatalog,
    getExamById 
  };
}

if (typeof window !== 'undefined') {
  window.EXAMS_CATALOG = EXAMS_CATALOG;
  window.registerExamToCatalog = registerExamToCatalog;
  window.getAllExamsCatalog = getAllExamsCatalog;
  window.getExamById = getExamById;
}
