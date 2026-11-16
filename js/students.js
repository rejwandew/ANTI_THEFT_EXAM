/**
 * Hardcoded Registered Students Database
 * Add future students here simply by adding to the list.
 */

const REGISTERED_STUDENTS = [
  {
    number: "01800000001",
    pass: "1234",
    name: "Student One",
    roll: "01"
  }
  // More students will be added here as provided:
  // {
  //   number: "01800000002",
  //   pass: "1234",
  //   name: "Student Two",
  //   roll: "02"
  // },
];

class StudentAuthService {
  constructor() {
    this.students = REGISTERED_STUDENTS;
    this.sessionKey = 'active_student_session';
  }

  getAllStudents() {
    let custom = [];
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('custom_registered_students');
        if (saved) custom = JSON.parse(saved);
      }
    } catch (e) {}

    const all = [...this.students];
    custom.forEach(c => {
      if (!all.some(s => s.number === c.number)) {
        all.push(c);
      }
    });
    return all;
  }

  getStudentByNumber(num) {
    if (!num) return null;
    const clean = String(num).trim().replace(/[-\s]/g, '');
    return this.getAllStudents().find(s => s.number.replace(/[-\s]/g, '') === clean);
  }

  authenticate(number, password) {
    if (!number || !password) {
      return { success: false, message: "নম্বর এবং পাসওয়ার্ড লিখুন।" };
    }

    const cleanNum = String(number).trim().replace(/[-\s]/g, '');
    const cleanPass = String(password).trim();

    const allStudents = this.getAllStudents();
    const student = allStudents.find(s => 
      s.number.replace(/[-\s]/g, '') === cleanNum
    );

    if (!student) {
      return { success: false, message: "এই নম্বরের কোনো শিক্ষার্থী খুঁজে পাওয়া যায়নি।" };
    }

    if (student.pass !== cleanPass) {
      return { success: false, message: "ভুল পাসওয়ার্ড! সঠিক পাসওয়ার্ড দিন।" };
    }

    // Save student session
    this.saveSession(student);
    return { success: true, student };
  }

  saveSession(student) {
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.setItem(this.sessionKey, JSON.stringify(student));
      } catch (e) {
        console.warn("Session save failed:", e);
      }
    }
  }

  getActiveSession() {
    if (typeof sessionStorage !== 'undefined') {
      try {
        const data = sessionStorage.getItem(this.sessionKey);
        return data ? JSON.parse(data) : null;
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  clearSession() {
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.removeItem(this.sessionKey);
      } catch (e) {}
    }
  }
}

if (typeof window !== 'undefined') {
  window.StudentAuth = new StudentAuthService();
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StudentAuth: new StudentAuthService(), REGISTERED_STUDENTS };
}
