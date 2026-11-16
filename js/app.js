/**
 * Main Exam Application Controller
 * Features:
 * - Student Authentication & Personal Portal
 * - Dynamic 20 Question Exam rendering & answer tracking
 * - Real-time countdown timer (20 minutes)
 * - Strict auto-submission on security violations
 * - Comprehensive Results & Detailed Math Review Screen with Correct Answers & Explanations
 * - Single-attempt lock enforcement
 */

class ExamAppController {
  constructor() {
    this.currentStudent = null;
    this.quizActive = false;
    this.activeExam = (typeof EXAMS_CATALOG !== 'undefined') ? EXAMS_CATALOG[0] : null;
    this.questions = this.activeExam ? (this.activeExam.questions || EXAM_QUESTIONS) : (EXAM_QUESTIONS || []);
    this.currentAnswers = {}; // { [questionId]: optionIndex }
    this.timerSeconds = 20 * 60;
    this.totalSeconds = this.timerSeconds;
    this.timerInterval = null;
    this.startTime = null;
    this.cachedResultPayload = null;
    this.currentFilter = 'ALL';

    // DOM Elements
    this.screens = {};
    this.bindDOM();
    this.initSessionOrURL();
  }

  bindDOM() {
    this.screens = {
      login: document.getElementById('login-screen'),
      portal: document.getElementById('portal-screen'),
      exam: document.getElementById('exam-screen'),
      results: document.getElementById('results-screen')
    };

    // Login Elements
    this.inputLoginNumber = document.getElementById('login-number');
    this.inputLoginPass = document.getElementById('login-password');
    this.btnLogin = document.getElementById('btn-do-login');
    this.loginErrorMsg = document.getElementById('login-error-msg');

    // Portal Elements
    this.portalStudentName = document.getElementById('portal-student-name');
    this.portalStudentNumber = document.getElementById('portal-student-number');
    this.portalWelcomeHeading = document.getElementById('portal-welcome-heading');
    this.portalAvatar = document.getElementById('portal-avatar');
    this.portalExamsGrid = document.getElementById('portal-exams-grid');
    this.btnLogout = document.getElementById('btn-do-logout');
    this.btnBackToPortal = document.getElementById('btn-back-to-portal');

    // Filter Buttons
    document.querySelectorAll('.exam-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.exam-filter-btn').forEach(b => {
          b.className = 'exam-filter-btn px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900';
        });
        btn.className = 'exam-filter-btn px-3 py-1.5 rounded-lg bg-white text-blue-700 shadow-sm font-bold';
        this.currentFilter = btn.getAttribute('data-filter') || 'ALL';
        this.renderPortalExams();
      });
    });

    // Exam Screen Elements
    this.examStudentName = document.getElementById('exam-student-name');
    this.examStudentRoll = document.getElementById('exam-student-roll');
    this.examTimerDisplay = document.getElementById('exam-timer');
    this.examProgressCount = document.getElementById('exam-progress-count');
    this.examProgressBar = document.getElementById('exam-progress-bar');
    this.questionsContainer = document.getElementById('questions-container');
    this.paletteContainer = document.getElementById('question-palette');
    this.btnSubmitExam = document.getElementById('btn-submit-exam');

    // Submit Modal
    this.submitModal = document.getElementById('submit-confirm-modal');
    this.btnConfirmSubmit = document.getElementById('btn-confirm-submit');
    this.btnCancelSubmit = document.getElementById('btn-cancel-submit');
    this.modalAnsweredCount = document.getElementById('modal-answered-count');
    this.modalRemainingCount = document.getElementById('modal-remaining-count');

    // Event Listeners for Login & Portal
    if (this.btnLogin) {
      this.btnLogin.addEventListener('click', () => this.handleLogin());
    }

    if (this.inputLoginNumber) {
      this.inputLoginNumber.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          if (this.inputLoginPass && !this.inputLoginPass.value) {
            this.inputLoginPass.focus();
          } else {
            this.handleLogin();
          }
        }
      });
    }

    if (this.inputLoginPass) {
      this.inputLoginPass.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.handleLogin();
      });
    }

    if (this.demoStudentSelect) {
      this.demoStudentSelect.addEventListener('change', (e) => {
        const selected = e.target.selectedOptions[0];
        if (selected && selected.value) {
          this.inputLoginRoll.value = selected.value;
          this.inputLoginPass.value = selected.getAttribute('data-pass') || "1234";
          if (this.loginErrorMsg) this.loginErrorMsg.classList.add('hidden');
        }
      });
    }

    if (this.btnLogout) {
      this.btnLogout.addEventListener('click', () => this.handleLogout());
    }

    if (this.btnBackToPortal) {
      this.btnBackToPortal.addEventListener('click', () => {
        if (this.currentStudent) {
          this.loadStudentPortal(this.currentStudent);
        } else {
          this.showScreen('login');
        }
      });
    }

    // Exam Screen Listeners
    if (this.btnSubmitExam) {
      this.btnSubmitExam.addEventListener('click', () => this.openSubmitModal());
    }

    if (this.btnConfirmSubmit) {
      this.btnConfirmSubmit.addEventListener('click', () => {
        this.closeSubmitModal();
        this.submitExam("Submitted Normally");
      });
    }

    if (this.btnCancelSubmit) {
      this.btnCancelSubmit.addEventListener('click', () => this.closeSubmitModal());
    }

    // Palette Toggle for Mobile
    const btnTogglePalette = document.getElementById('btn-toggle-palette');
    const paletteDrawer = document.getElementById('palette-drawer');
    if (btnTogglePalette && paletteDrawer) {
      btnTogglePalette.addEventListener('click', () => {
        paletteDrawer.classList.toggle('hidden');
      });
    }
  }

  isExamActive() {
    return this.quizActive;
  }

  /**
   * Check Session or URL Parameters
   */
  async initSessionOrURL() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const numParam = urlParams.get('number') || urlParams.get('num') || urlParams.get('roll');
      const passParam = urlParams.get('pass');

      if (numParam && passParam) {
        const auth = StudentAuth.authenticate(numParam, passParam);
        if (auth.success) {
          await this.loadStudentPortal(auth.student);
          return;
        }
      }

      // Check active session from sessionStorage
      const savedStudent = StudentAuth.getActiveSession();
      if (savedStudent) {
        await this.loadStudentPortal(savedStudent);
        return;
      }

      this.showScreen('login');
    } catch (e) {
      console.warn("Init session error:", e);
      this.showScreen('login');
    }
  }

  /**
   * Handle Login Authentication
   */
  async handleLogin() {
    const number = this.inputLoginNumber ? this.inputLoginNumber.value.trim() : "";
    const pass = this.inputLoginPass ? this.inputLoginPass.value.trim() : "";

    if (!number || !pass) {
      this.showLoginError("অনুগ্রহ করে শিক্ষার্থী নম্বর এবং পাসওয়ার্ড লিখুন।");
      return;
    }

    const auth = StudentAuth.authenticate(number, pass);
    if (!auth.success) {
      this.showLoginError(auth.message || "ভুল নম্বর বা পাসওয়ার্ড!");
      return;
    }

    if (this.loginErrorMsg) this.loginErrorMsg.classList.add('hidden');
    await this.loadStudentPortal(auth.student);
  }

  showLoginError(msg) {
    if (this.loginErrorMsg) {
      this.loginErrorMsg.textContent = msg;
      this.loginErrorMsg.classList.remove('hidden');
    } else {
      alert(msg);
    }
  }

  handleLogout() {
    StudentAuth.clearSession();
    this.currentStudent = null;
    if (this.inputLoginNumber) this.inputLoginNumber.value = "";
    if (this.inputLoginPass) this.inputLoginPass.value = "";
    this.showScreen('login');
  }

  /**
   * Loads the Student's Personal Portal and renders all assigned exams
   */
  async loadStudentPortal(student) {
    this.currentStudent = student;
    StudentAuth.saveSession(student);

    // Update Student Header Info
    if (this.portalStudentName) this.portalStudentName.textContent = student.name;
    if (this.portalStudentNumber) this.portalStudentNumber.textContent = student.number;
    if (this.portalWelcomeHeading) this.portalWelcomeHeading.textContent = `স্বাগতম, ${student.name}!`;
    if (this.portalAvatar) this.portalAvatar.textContent = student.roll || "S1";

    await this.renderPortalExams();
    this.showScreen('portal');
  }

  /**
   * Renders the dynamic catalog of all exams for this student
   */
  async renderPortalExams() {
    if (!this.portalExamsGrid) return;
    this.portalExamsGrid.innerHTML = '';

    const catalog = (typeof getAllExamsCatalog === 'function') 
      ? getAllExamsCatalog() 
      : ((typeof EXAMS_CATALOG !== 'undefined') ? EXAMS_CATALOG : []);

    for (const exam of catalog) {
      const attempt = await ExamStorage.checkAttemptStatus(this.currentStudent.number, exam.id);
      const isCompleted = attempt && attempt.exists && attempt.data.status === 'SUBMITTED';

      // Filtering
      if (this.currentFilter === 'ACTIVE' && (isCompleted || exam.status !== 'active')) continue;
      if (this.currentFilter === 'COMPLETED' && !isCompleted) continue;

      const card = document.createElement('div');
      card.className = "bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition hover:shadow-md";

      let statusBadgeHtml = '';
      let actionBtnHtml = '';

      if (isCompleted) {
        const data = attempt.data;
        const isNormal = data.isNormalSubmit || data.violationReason === 'Submitted Normally';
        const score = data.score || 0;
        const total = exam.totalMarks || 20;
        const pct = data.percentage || Math.round((score / total) * 100);

        statusBadgeHtml = `
          <div class="text-right">
            <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${isNormal ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">
              ${isNormal ? '✓ পরীক্ষা সম্পন্ন (Completed)' : '⚠️ অটো-সাবমিটেড (Violation)'}
            </span>
            <div class="mt-1 font-bold text-xs md:text-sm text-slate-800">
              প্রাপ্ত নম্বর: <span class="${score >= (exam.passMarks || 8) ? 'text-emerald-600' : 'text-red-600'} font-extrabold">${score} / ${total}</span> (${pct}%)
            </div>
          </div>
        `;

        actionBtnHtml = `
          <button type="button" class="btn-exam-action w-full py-3.5 rounded-xl font-bold text-white bg-slate-900 hover:bg-slate-800 active:bg-slate-950 transition flex items-center justify-center space-x-2 text-sm shadow-md" data-action="review" data-exam-id="${exam.id}">
            <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <span>ফলাফল ও সঠিক সমাধান দেখুন (View Results & Correct Answers)</span>
          </button>
        `;
      } else if (exam.status === 'active') {
        statusBadgeHtml = `
          <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            ⏳ চলমান পরীক্ষা (Active - Ready to Take)
          </span>
        `;

        actionBtnHtml = `
          <button type="button" class="btn-exam-action w-full py-3.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition flex items-center justify-center space-x-2 text-sm shadow-md hover:shadow-blue-500/25" data-action="start" data-exam-id="${exam.id}">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            <span>পরীক্ষা শুরু করুন (Start Exam Now)</span>
          </button>
        `;
      } else {
        statusBadgeHtml = `
          <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
            📅 আসন্ন পরীক্ষা (Upcoming)
          </span>
        `;

        actionBtnHtml = `
          <button type="button" class="w-full py-3 rounded-xl font-semibold text-slate-400 bg-slate-100 cursor-not-allowed text-xs flex items-center justify-center space-x-1" disabled>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
            <span>পরীক্ষাটি এখনও উন্মুক্ত হয়নি (${exam.scheduledText || 'শীঘ্রই আসছে'})</span>
          </button>
        `;
      }

      card.innerHTML = `
        <div class="p-6">
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between pb-4 border-b border-slate-100 gap-3">
            <div>
              <div class="flex items-center space-x-2">
                <span class="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">${exam.code || 'EXAM'}</span>
                <span class="text-xs text-slate-500 font-medium">${exam.subject || 'বিষয়'} • ${exam.class || 'অষ্টম শ্রেণি'}</span>
              </div>
              <h3 class="text-base md:text-lg font-bold text-slate-900 mt-1">${exam.title}</h3>
              <p class="text-xs text-slate-600 mt-0.5">${exam.description || ''}</p>
            </div>
            <div class="flex-shrink-0">
              ${statusBadgeHtml}
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 py-4 border-b border-slate-100 text-center text-xs">
            <div class="p-2 bg-slate-50 rounded-lg">
              <span class="text-slate-400 block text-[11px]">প্রশ্নসংখ্যা</span>
              <strong class="font-bold text-slate-800">${exam.totalQuestions}টি</strong>
            </div>
            <div class="p-2 bg-slate-50 rounded-lg">
              <span class="text-slate-400 block text-[11px]">সময়সীমা</span>
              <strong class="font-bold text-slate-800">${exam.durationMinutes} মিনিট</strong>
            </div>
            <div class="p-2 bg-slate-50 rounded-lg">
              <span class="text-slate-400 block text-[11px]">পূর্ণমান</span>
              <strong class="font-bold text-slate-800">${exam.totalMarks}</strong>
            </div>
            <div class="p-2 bg-slate-50 rounded-lg">
              <span class="text-slate-400 block text-[11px]">পাস নম্বর</span>
              <strong class="font-bold text-emerald-600">${exam.passMarks} (${Math.round((exam.passMarks / exam.totalMarks) * 100)}%)</strong>
            </div>
          </div>

          <div class="pt-4">
            ${actionBtnHtml}
          </div>
        </div>
      `;

      this.portalExamsGrid.appendChild(card);
    }

    // Attach click listeners to actions
    this.portalExamsGrid.querySelectorAll('.btn-exam-action').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.getAttribute('data-action');
        const examId = btn.getAttribute('data-exam-id');
        const catalog = (typeof EXAMS_CATALOG !== 'undefined') ? EXAMS_CATALOG : [];
        const exam = catalog.find(x => x.id === examId) || catalog[0];

        if (action === 'review') {
          const attempt = await ExamStorage.checkAttemptStatus(this.currentStudent.number, exam.id);
          if (attempt && attempt.exists) {
            this.activeExam = exam;
            this.showResultsScreenDirectly(attempt.data);
          }
        } else if (action === 'start') {
          this.startExamMode(exam);
        }
      });
    });
  }

  /**
   * Launch Secure Fullscreen Exam Mode for the selected exam
   */
  async startExamMode(exam = null) {
    if (!this.currentStudent) return;
    this.activeExam = exam || ((typeof EXAMS_CATALOG !== 'undefined') ? EXAMS_CATALOG[0] : null);
    const examId = this.activeExam ? this.activeExam.id : 'math-8-10.3';

    // Check again before launching
    const attempt = await ExamStorage.checkAttemptStatus(this.currentStudent.number, examId);
    if (attempt && attempt.exists) {
      alert("আপনি ইতিপূর্বে এই পরীক্ষাটি সম্পন্ন করেছেন। পুনরায় পরীক্ষা দেওয়া নিষেধ।");
      await this.loadStudentPortal(this.currentStudent);
      return;
    }

    // Record Exam Start
    await ExamStorage.recordExamStart({
      roll: this.currentStudent.number,
      name: this.currentStudent.name,
      studentNumber: this.currentStudent.number
    }, examId);

    // Setup active questions and timer
    this.questions = (this.activeExam && Array.isArray(this.activeExam.questions) && this.activeExam.questions.length > 0)
      ? this.activeExam.questions
      : ((typeof EXAM_QUESTIONS !== 'undefined') ? EXAM_QUESTIONS : []);
    this.timerSeconds = ((this.activeExam ? this.activeExam.durationMinutes : 20) || 20) * 60;
    this.totalSeconds = this.timerSeconds;
    this.currentAnswers = {};

    // Switch DOM to Exam Screen
    this.showScreen('exam');

    // Update Exam Header
    if (this.examStudentName) this.examStudentName.textContent = this.currentStudent.name;
    if (this.examStudentRoll) this.examStudentRoll.textContent = this.currentStudent.number;

    const screenTitle = document.getElementById('exam-screen-title');
    if (screenTitle && this.activeExam) {
      screenTitle.textContent = this.activeExam.title;
    }

    // Render Questions & Palette
    this.renderQuestions();
    this.renderQuestionPalette();
    this.updateProgress();

    // Check Watermark option
    const enableWatermark = document.getElementById('toggle-watermark')?.checked || false;

    // Activate Security Engine
    await ExamSecurity.activateSecurity({
      roll: this.currentStudent.number,
      name: this.currentStudent.name
    }, (violationReason) => {
      this.handleSecurityViolation(violationReason);
    }, { enableWatermark });

    this.quizActive = true;
    this.startTime = Date.now();

    // Start Countdown Timer
    this.startCountdownTimer();
  }

  /**
   * Starts the 20:00 Countdown Timer
   */
  startCountdownTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.updateTimerDisplay();

    this.timerInterval = setInterval(() => {
      if (!this.quizActive) {
        clearInterval(this.timerInterval);
        return;
      }

      this.timerSeconds--;
      this.updateTimerDisplay();

      // Sound warning at 1 minute remaining
      if (this.timerSeconds === 60) {
        ExamSecurity.playViolationAlarm();
      }

      if (this.timerSeconds <= 0) {
        clearInterval(this.timerInterval);
        this.submitExam("Auto-submitted: Time Expired (20 Minutes Finished)");
      }
    }, 1000);
  }

  updateTimerDisplay() {
    if (!this.examTimerDisplay) return;

    const mins = Math.floor(Math.max(0, this.timerSeconds) / 60);
    const secs = Math.max(0, this.timerSeconds) % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    this.examTimerDisplay.textContent = formatted;

    // Turn red and pulse when less than 3 minutes (180s)
    if (this.timerSeconds <= 180) {
      this.examTimerDisplay.parentElement.classList.add('timer-danger');
    } else {
      this.examTimerDisplay.parentElement.classList.remove('timer-danger');
    }
  }

  /**
   * Render all 20 Questions into clean cards
   */
  renderQuestions() {
    if (!this.questionsContainer) return;
    this.questionsContainer.innerHTML = '';

    this.questions.forEach((q, idx) => {
      const qCard = document.createElement('div');
      qCard.id = `q-card-${q.id}`;
      qCard.className = 'bg-white rounded-xl shadow-sm border border-gray-200 p-5 md:p-6 transition hover:shadow-md';

      const optionsHtml = q.options.map((opt, optIdx) => {
        const optionLabelBengali = ['ক', 'খ', 'গ', 'ঘ'][optIdx] || `${optIdx + 1}`;
        const isSelected = this.currentAnswers[q.id] === optIdx;
        return `
          <label class="option-label flex items-center p-3.5 rounded-lg border border-gray-200 ${isSelected ? 'selected' : ''}" data-qid="${q.id}" data-opt="${optIdx}">
            <input type="radio" name="q_${q.id}" value="${optIdx}" class="hidden" ${isSelected ? 'checked' : ''}>
            <div class="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs mr-3 flex-shrink-0 ${isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}">
              ${optionLabelBengali}
            </div>
            <span class="text-gray-800 text-sm md:text-base font-medium select-none">${opt}</span>
          </label>
        `;
      }).join('');

      qCard.innerHTML = `
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center space-x-2">
            <span class="inline-flex items-center justify-center bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-1 rounded-full">
              প্রশ্ন ${idx + 1}
            </span>
            <span class="text-xs text-gray-500 font-medium">${q.topic || 'বৃত্ত ও সিলিন্ডার'}</span>
          </div>
          <button type="button" class="btn-clear-q text-xs text-gray-400 hover:text-red-500 transition" data-qid="${q.id}">
            মুছুন (Clear)
          </button>
        </div>
        <h3 class="text-base md:text-lg font-semibold text-gray-900 mb-3 select-none leading-relaxed">
          ${q.question}
        </h3>
        ${q.diagramSvg ? `<div class="my-3 flex justify-center">${q.diagramSvg}</div>` : ''}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          ${optionsHtml}
        </div>
      `;

      this.questionsContainer.appendChild(qCard);
    });

    // Event delegation for option selection
    this.questionsContainer.addEventListener('click', (e) => {
      const label = e.target.closest('.option-label');
      if (label) {
        const qId = parseInt(label.getAttribute('data-qid'), 10);
        const optIdx = parseInt(label.getAttribute('data-opt'), 10);
        this.selectOption(qId, optIdx);
        return;
      }

      const btnClear = e.target.closest('.btn-clear-q');
      if (btnClear) {
        const qId = parseInt(btnClear.getAttribute('data-qid'), 10);
        this.clearOption(qId);
      }
    });
  }

  /**
   * Render 1-20 palette grid for quick navigation
   */
  renderQuestionPalette() {
    if (!this.paletteContainer) return;
    this.paletteContainer.innerHTML = '';

    this.questions.forEach((q, idx) => {
      const isAnswered = this.currentAnswers[q.id] !== undefined;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = `palette-btn-${q.id}`;
      btn.className = `w-8 h-8 rounded-lg text-xs font-bold transition flex items-center justify-center ${
        isAnswered ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`;
      btn.textContent = idx + 1;
      btn.addEventListener('click', () => {
        const target = document.getElementById(`q-card-${q.id}`);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
      this.paletteContainer.appendChild(btn);
    });
  }

  selectOption(questionId, optionIndex) {
    if (!this.quizActive) return;

    this.currentAnswers[questionId] = optionIndex;

    // Update UI for the question card
    const card = document.getElementById(`q-card-${questionId}`);
    if (card) {
      card.querySelectorAll('.option-label').forEach((label, idx) => {
        const isCurrent = idx === optionIndex;
        label.classList.toggle('selected', isCurrent);
        const circle = label.querySelector('div');
        if (circle) {
          if (isCurrent) {
            circle.className = 'w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs mr-3 flex-shrink-0 bg-blue-600 text-white';
          } else {
            circle.className = 'w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs mr-3 flex-shrink-0 bg-gray-100 text-gray-700';
          }
        }
      });
    }

    // Update Palette Button
    const pBtn = document.getElementById(`palette-btn-${questionId}`);
    if (pBtn) {
      pBtn.className = 'w-8 h-8 rounded-lg text-xs font-bold transition flex items-center justify-center bg-blue-600 text-white shadow-sm';
    }

    this.updateProgress();

    // Persist current answers in real time
    if (this.currentStudent) {
      ExamStorage.updateCurrentAnswers(this.currentStudent.number || this.currentStudent.roll, this.currentAnswers);
    }
  }

  clearOption(questionId) {
    if (!this.quizActive) return;

    delete this.currentAnswers[questionId];

    const card = document.getElementById(`q-card-${questionId}`);
    if (card) {
      card.querySelectorAll('.option-label').forEach((label) => {
        label.classList.remove('selected');
        const circle = label.querySelector('div');
        if (circle) {
          circle.className = 'w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs mr-3 flex-shrink-0 bg-gray-100 text-gray-700';
        }
      });
    }

    const pBtn = document.getElementById(`palette-btn-${questionId}`);
    if (pBtn) {
      pBtn.className = 'w-8 h-8 rounded-lg text-xs font-bold transition flex items-center justify-center bg-gray-100 text-gray-700 hover:bg-gray-200';
    }

    this.updateProgress();

    if (this.currentStudent) {
      ExamStorage.updateCurrentAnswers(this.currentStudent.number || this.currentStudent.roll, this.currentAnswers);
    }
  }

  updateProgress() {
    const answeredCount = Object.keys(this.currentAnswers).length;
    const total = this.questions.length;
    const pct = Math.round((answeredCount / total) * 100);

    if (this.examProgressCount) {
      this.examProgressCount.textContent = `${answeredCount}/${total}`;
    }
    if (this.examProgressBar) {
      this.examProgressBar.style.width = `${pct}%`;
    }
  }

  openSubmitModal() {
    const answered = Object.keys(this.currentAnswers).length;
    const remaining = this.questions.length - answered;

    if (this.modalAnsweredCount) this.modalAnsweredCount.textContent = answered;
    if (this.modalRemainingCount) this.modalRemainingCount.textContent = remaining;

    if (this.submitModal) {
      this.submitModal.classList.remove('hidden');
    }
  }

  closeSubmitModal() {
    if (this.submitModal) {
      this.submitModal.classList.add('hidden');
    }
  }

  /**
   * Called by security engine when any anti-cheat trigger is activated
   */
  handleSecurityViolation(reason) {
    if (!this.quizActive) return;
    this.submitExam(reason);
  }

  /**
   * Force auto-submit from BroadcastChannel or other tab
   */
  forceAutoSubmit(reason) {
    if (this.quizActive) {
      this.submitExam(reason);
    }
  }

  /**
   * Central Exam Submission Function
   */
  async submitExam(reason = "Submitted Normally") {
    if (!this.quizActive && !this.currentStudent) return;

    this.quizActive = false;

    // Clear timer
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    // Stop security listeners
    ExamSecurity.cleanup();

    // Disable blackout so user can see Results Screen
    setTimeout(() => {
      ExamSecurity.applyInstantBlackout(false);
    }, 100);

    // Calculate Scores
    const { score, correctCount, incorrectCount, skippedCount } = this.calculateDetailedScore(this.currentAnswers);
    const totalQuestions = this.questions.length;
    const percentage = Math.round((score / totalQuestions) * 100);
    const timeTaken = this.totalSeconds - Math.max(0, this.timerSeconds);

    const examId = this.activeExam ? this.activeExam.id : 'math-8-10.3';
    const examTitle = this.activeExam ? this.activeExam.title : 'Class 8 Math - Chapter 10.3';

    const payload = {
      name: this.currentStudent ? this.currentStudent.name : "Student",
      roll: this.currentStudent ? (this.currentStudent.number || this.currentStudent.roll) : "00",
      examId,
      examTitle,
      status: 'SUBMITTED',
      score,
      totalQuestions,
      correctCount,
      incorrectCount,
      skippedCount,
      percentage,
      passed: score >= (this.activeExam ? (this.activeExam.passMarks || 8) : 8),
      timeTakenSeconds: timeTaken,
      violationReason: reason,
      isNormalSubmit: (reason === "Submitted Normally"),
      answers: { ...this.currentAnswers },
      submittedAt: new Date().toISOString()
    };

    // Save permanently to storage / DB with examId
    await ExamStorage.saveAttemptResult(payload, examId);

    // Render Results Screen
    this.renderResults(payload);
    this.showScreen('results');
  }

  calculateDetailedScore(answers) {
    let score = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let skippedCount = 0;

    this.questions.forEach((q) => {
      const ans = answers[q.id];
      if (ans === undefined) {
        skippedCount++;
      } else if (ans === q.correctIndex) {
        score++;
        correctCount++;
      } else {
        incorrectCount++;
      }
    });

    return { score, correctCount, incorrectCount, skippedCount };
  }

  /**
   * Renders the Results Screen with Correct Answers and Mathematical Explanations
   */
  renderResults(payload) {
    this.cachedResultPayload = payload;

    // Ensure watermark and blackout are completely cleared on results view
    if (typeof ExamSecurity !== 'undefined') {
      if (ExamSecurity.clearWatermark) ExamSecurity.clearWatermark();
      if (ExamSecurity.applyInstantBlackout) ExamSecurity.applyInstantBlackout(false);
    }

    // Result Header Info
    const resExamTitle = document.getElementById('res-exam-title');
    const resName = document.getElementById('res-student-name');
    const resRoll = document.getElementById('res-student-roll');
    const resTime = document.getElementById('res-time-taken');
    const resDate = document.getElementById('res-submission-date');

    if (resExamTitle) {
      resExamTitle.textContent = payload.examTitle || (this.activeExam ? this.activeExam.title : "অনলাইন পরীক্ষা মূল্যায়ন");
    }
    if (resName) resName.textContent = payload.name;
    if (resRoll) resRoll.textContent = payload.roll;
    if (resTime) {
      const m = Math.floor(payload.timeTakenSeconds / 60);
      const s = payload.timeTakenSeconds % 60;
      resTime.textContent = `${m} মি. ${s} সে.`;
    }
    if (resDate) {
      const d = new Date(payload.submittedAt || Date.now());
      resDate.textContent = d.toLocaleString('bn-BD', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    }

    // Status Banner
    const statusContainer = document.getElementById('res-status-banner');
    if (statusContainer) {
      if (payload.isNormalSubmit) {
        statusContainer.className = 'p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-start space-x-3 mb-6';
        statusContainer.innerHTML = `
          <div class="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 text-emerald-700">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
          </div>
          <div>
            <h4 class="font-bold text-base md:text-lg text-emerald-900">পরীক্ষা সফলভাবে সম্পন্ন হয়েছে (Submitted Normally)</h4>
            <p class="text-xs md:text-sm text-emerald-800 mt-0.5">সবগুলো নির্দেশিকা মেনে নির্ধারিত সময়ের মধ্যে পরীক্ষা সফলভাবে সমাপ্ত হয়েছে।</p>
          </div>
        `;
      } else {
        statusContainer.className = 'p-4 rounded-xl bg-red-50 border border-red-300 text-red-950 flex items-start space-x-3 mb-6';
        statusContainer.innerHTML = `
          <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 text-red-700">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          </div>
          <div>
            <div class="flex items-center space-x-2">
              <span class="bg-red-700 text-white text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">অটো-সাবমিটেড (লকড)</span>
              <span class="text-xs font-semibold text-red-800">নিরাপত্তা লঙ্ঘন</span>
            </div>
            <h4 class="font-bold text-base md:text-lg text-red-900 mt-1">
              ${payload.violationReason || "Security Violation Detected"}
            </h4>
            <p class="text-xs md:text-sm text-red-800 mt-0.5">
              প্রতারণাবিরোধী নিরাপত্তা ব্যবস্থার নীতি লঙ্ঘনের কারণে পরীক্ষাটি তাৎক্ষণিকভাবে অটো-সাবমিট হয়েছে।
            </p>
          </div>
        `;
      }
    }

    // Score Stats
    const scoreVal = document.getElementById('res-score-value');
    const scorePct = document.getElementById('res-score-percentage');
    const correctVal = document.getElementById('res-correct-count');
    const incorrectVal = document.getElementById('res-incorrect-count');
    const skippedVal = document.getElementById('res-skipped-count');
    const passStatusBadge = document.getElementById('res-pass-badge');

    if (scoreVal) scoreVal.textContent = `${payload.score} / ${payload.totalQuestions}`;
    if (scorePct) scorePct.textContent = `${payload.percentage}%`;
    if (correctVal) correctVal.textContent = payload.correctCount || 0;
    if (incorrectVal) incorrectVal.textContent = payload.incorrectCount || 0;
    if (skippedVal) skippedVal.textContent = payload.skippedCount || 0;

    if (passStatusBadge) {
      if (payload.passed) {
        passStatusBadge.className = 'inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800';
        passStatusBadge.textContent = 'উত্তীর্ণ (Passed)';
      } else {
        passStatusBadge.className = 'inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800';
        passStatusBadge.textContent = 'অনুত্তীর্ণ (Needs Improvement)';
      }
    }

    // Render Detailed 20 Questions Review with Correct Answers
    this.renderQuestionsReview(payload.answers || {});

    // Hook up Actions (Print slip, download json)
    this.setupResultActions(payload);
  }

  /**
   * Render question-by-question breakdown with student answer, correct answer & math explanation
   */
  renderQuestionsReview(studentAnswers) {
    const container = document.getElementById('questions-review-list');
    if (!container) return;
    container.innerHTML = '';

    const banglaLabels = ['ক', 'খ', 'গ', 'ঘ'];

    this.questions.forEach((q, idx) => {
      const studentAnsIdx = studentAnswers[q.id];
      const isCorrect = studentAnsIdx === q.correctIndex;
      const isSkipped = studentAnsIdx === undefined;

      let badgeHtml = '';
      let borderClass = '';

      if (isSkipped) {
        badgeHtml = `<span class="bg-gray-100 text-gray-700 text-xs font-bold px-2.5 py-1 rounded-md">উত্তর দেওয়া হয়নি (Skipped)</span>`;
        borderClass = 'border-gray-200';
      } else if (isCorrect) {
        badgeHtml = `<span class="bg-green-100 text-green-800 text-xs font-bold px-2.5 py-1 rounded-md flex items-center space-x-1">
          <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>
          <span>সঠিক উত্তর (+১)</span>
        </span>`;
        borderClass = 'border-green-300 bg-green-50/20';
      } else {
        badgeHtml = `<span class="bg-red-100 text-red-800 text-xs font-bold px-2.5 py-1 rounded-md flex items-center space-x-1">
          <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
          <span>ভুল উত্তর (০)</span>
        </span>`;
        borderClass = 'border-red-300 bg-red-50/20';
      }

      const optionsHtml = q.options.map((opt, optIdx) => {
        const isThisCorrect = optIdx === q.correctIndex;
        const isThisSelected = optIdx === studentAnsIdx;

        let optClass = 'p-3 rounded-lg border text-sm ';
        let tag = '';

        if (isThisCorrect) {
          optClass += 'bg-green-50 border-green-500 text-green-950 font-bold';
          tag = `<span class="ml-auto text-xs bg-green-600 text-white px-2 py-0.5 rounded font-bold">সঠিক উত্তর ✓</span>`;
        } else if (isThisSelected && !isThisCorrect) {
          optClass += 'bg-red-50 border-red-400 text-red-950 font-semibold';
          tag = `<span class="ml-auto text-xs bg-red-600 text-white px-2 py-0.5 rounded font-bold">আপনার প্রদত্ত উত্তর ✗</span>`;
        } else {
          optClass += 'bg-white border-gray-200 text-gray-700';
        }

        return `
          <div class="flex items-center ${optClass}">
            <span class="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs mr-2 bg-gray-200 text-gray-800">
              ${banglaLabels[optIdx]}
            </span>
            <span>${opt}</span>
            ${tag}
          </div>
        `;
      }).join('');

      const itemCard = document.createElement('div');
      itemCard.className = `p-5 rounded-xl border ${borderClass} bg-white shadow-sm mb-4`;
      itemCard.innerHTML = `
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center space-x-2">
            <span class="font-bold text-sm text-gray-800">প্রশ্ন ${idx + 1}</span>
            <span class="text-xs text-gray-500">${q.topic || 'বৃত্ত ও সিলিন্ডার'}</span>
          </div>
          <div>${badgeHtml}</div>
        </div>
        <p class="font-semibold text-gray-900 text-base mb-3 leading-relaxed">${q.question}</p>
        ${q.diagramSvg ? `<div class="my-3 flex justify-center">${q.diagramSvg}</div>` : ''}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
          ${optionsHtml}
        </div>
        <div class="p-3.5 bg-blue-50/70 border border-blue-200 rounded-lg text-xs md:text-sm text-blue-950">
          <strong class="font-bold text-blue-900 flex items-center mb-1">
            <svg class="w-4 h-4 mr-1.5 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path></svg>
            ব্যাখ্যা (Mathematical Solution):
          </strong>
          <span class="text-gray-800 font-medium">${q.explanation}</span>
        </div>
      `;

      container.appendChild(itemCard);
    });
  }

  setupResultActions(payload) {
    const btnPrint = document.getElementById('btn-print-slip');
    const btnDownload = document.getElementById('btn-download-json');

    if (btnPrint) {
      btnPrint.onclick = () => {
        document.body.classList.add('printing-slip');
        window.print();
        setTimeout(() => {
          document.body.classList.remove('printing-slip');
        }, 1500);
      };
    }

    if (btnDownload) {
      btnDownload.onclick = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `Exam_Result_Roll_${payload.roll}_Math10.3.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      };
    }
  }

  /**
   * Direct Transition to Results (for viewing completed exam)
   */
  showResultsScreenDirectly(savedData) {
    this.quizActive = false;
    ExamSecurity.cleanup();
    ExamSecurity.applyInstantBlackout(false);

    this.renderResults(savedData);
    this.showScreen('results');
  }

  showScreen(screenName) {
    Object.keys(this.screens).forEach((name) => {
      const el = this.screens[name];
      if (el) {
        if (name === screenName) {
          el.classList.remove('hidden');
        } else {
          el.classList.add('hidden');
        }
      }
    });

    if (screenName === 'exam') {
      document.body.classList.add('exam-mode');
    } else {
      document.body.classList.remove('exam-mode');
    }
  }
}

// Instantiate and expose globally with bulletproof ready-state check
function startExamApp() {
  if (typeof window !== 'undefined' && !window.ExamApp) {
    window.ExamApp = new ExamAppController();
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startExamApp);
  } else {
    // DOM is already parsed and ready!
    startExamApp();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExamAppController;
}
