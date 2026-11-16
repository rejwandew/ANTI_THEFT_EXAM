/**
 * Storage & Remote Persistence Hook Module
 * Supports:
 * - LocalStorage state locking (exam_math_10_3_state)
 * - Real-time Cross-Tab synchronization via BroadcastChannel
 * - Modular Supabase / REST Backend Integration
 * - Device & Browser fingerprinting
 */

const STORAGE_KEY = 'exam_math_10_3_state';
const BROADCAST_CHANNEL_NAME = 'math_exam_security_channel';

// Supabase / External DB Configuration Hook
// Fill these credentials or leave enabled: false for local simulation mode
const CLOUD_CONFIG = {
  enabled: false, // Set to true when you provide your Supabase URL & Anon Key
  supabaseUrl: "", // e.g. "https://xyzcompany.supabase.co"
  supabaseAnonKey: "", // your public anon key
  tableName: "exam_attempts"
};

class ExamStorageService {
  constructor() {
    this.broadcastChannel = null;
    this.initBroadcastChannel();
    this.deviceFingerprint = this.generateFingerprint();
  }

  initBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.broadcastChannel.onmessage = (event) => {
          this.handleBroadcastMessage(event.data);
        };
      } catch (err) {
        console.warn("BroadcastChannel not supported or blocked:", err);
      }
    }
  }

  broadcast(message) {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(message);
      } catch (e) {
        console.warn("Broadcast failed:", e);
      }
    }
  }

  handleBroadcastMessage(data) {
    if (!data) return;
    // If another tab started or submitted with the same roll number
    if (window.ExamApp && window.ExamApp.currentStudent) {
      const currentRoll = String(window.ExamApp.currentStudent.roll).trim();
      const incomingRoll = String(data.roll).trim();

      if (currentRoll && currentRoll === incomingRoll) {
        if (data.type === 'EXAM_STARTED' && window.ExamApp.isExamActive()) {
          window.ExamApp.forceAutoSubmit("Auto-submitted: Duplicate Active Session in Another Tab/Window");
        } else if (data.type === 'EXAM_SUBMITTED') {
          window.ExamApp.showResultsScreenDirectly(data.payload);
        }
      }
    }
  }

  generateFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.textBaseline = "top";
      ctx.font = "14px 'Arial'";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#f60";
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = "#069";
      ctx.fillText("ExamLock#10.3", 2, 15);
      ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
      ctx.fillText("ExamLock#10.3", 4, 17);
      const b64 = canvas.toDataURL();
      let hash = 0;
      for (let i = 0; i < b64.length; i++) {
        hash = ((hash << 5) - hash) + b64.charCodeAt(i);
        hash |= 0;
      }
      return `${Math.abs(hash)}-${navigator.userAgent.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}`;
    } catch (e) {
      return `fp-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    }
  }

  /**
   * Retrieves all stored attempts from localStorage
   * Keyed by roll number
   */
  getAllLocalAttempts() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.error("Error reading localStorage:", e);
      return {};
    }
  }

  saveAllLocalAttempts(attempts) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(attempts));
    } catch (e) {
      console.error("Error writing to localStorage:", e);
    }
  }

  getKey(roll, examId = 'math-8-10.3') {
    return `${String(roll).trim()}__${examId}`;
  }

  getLocalAttempt(roll, examId = 'math-8-10.3') {
    const attempts = this.getAllLocalAttempts();
    const specificKey = this.getKey(roll, examId);
    if (attempts[specificKey]) return attempts[specificKey];
    // Backward compatibility if previous attempt was stored under plain roll/number
    if (examId === 'math-8-10.3' && attempts[String(roll).trim()]) {
      return attempts[String(roll).trim()];
    }
    return null;
  }

  /**
   * Async check whether student has already started or submitted
   * Checks local storage, and if Cloud is configured, queries Supabase
   */
  async checkAttemptStatus(roll, examId = 'math-8-10.3') {
    const cleanRoll = String(roll || "").trim();
    if (!cleanRoll) return { exists: false };

    // 1. Client-Side Local Storage Check
    const local = this.getLocalAttempt(cleanRoll, examId);
    if (local) {
      return {
        exists: true,
        source: 'local',
        status: local.status, // 'STARTED' or 'SUBMITTED'
        data: local
      };
    }

    // 2. Cloud DB Check (Supabase / REST Endpoint)
    if (CLOUD_CONFIG.enabled && CLOUD_CONFIG.supabaseUrl && CLOUD_CONFIG.supabaseAnonKey) {
      try {
        const url = `${CLOUD_CONFIG.supabaseUrl}/rest/v1/${CLOUD_CONFIG.tableName}?roll_number=eq.${encodeURIComponent(cleanRoll)}&select=*`;
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'apikey': CLOUD_CONFIG.supabaseAnonKey,
            'Authorization': `Bearer ${CLOUD_CONFIG.supabaseAnonKey}`,
            'Content-Type': 'application/json'
          }
        });

        if (res.ok) {
          const records = await res.json();
          if (records && records.length > 0) {
            const remoteRecord = records[0];
            // Sync down to local storage to lock this browser as well
            const attempts = this.getAllLocalAttempts();
            const storageKey = this.getKey(cleanRoll, examId);
            attempts[storageKey] = remoteRecord.payload || {
              roll: cleanRoll,
              examId,
              name: remoteRecord.student_name,
              status: remoteRecord.status,
              violationReason: remoteRecord.violation_reason || "Previous Attempt Recorded",
              score: remoteRecord.score || 0,
              submittedAt: remoteRecord.submitted_at || new Date().toISOString()
            };
            this.saveAllLocalAttempts(attempts);

            return {
              exists: true,
              source: 'cloud',
              status: remoteRecord.status,
              data: attempts[storageKey]
            };
          }
        }
      } catch (err) {
        console.warn("Cloud status check failed, relying on local state:", err);
      }
    }

    return { exists: false };
  }

  /**
   * Immediately records that student has started the exam
   * Locks state so any reload or reopening will be detected
   */
  async recordExamStart(studentData, examId = 'math-8-10.3') {
    const cleanRoll = String(studentData.roll || studentData.number).trim();
    const storageKey = this.getKey(cleanRoll, examId);
    const payload = {
      roll: cleanRoll,
      examId: examId,
      name: studentData.name,
      status: 'STARTED',
      startedAt: new Date().toISOString(),
      startTimestamp: Date.now(),
      fingerprint: this.deviceFingerprint,
      answers: {},
      violationReason: null,
      score: 0
    };

    // 1. Save to LocalStorage immediately
    const attempts = this.getAllLocalAttempts();
    attempts[storageKey] = payload;
    attempts[cleanRoll] = payload; // fallback
    this.saveAllLocalAttempts(attempts);

    // 2. Broadcast across tabs
    this.broadcast({
      type: 'EXAM_STARTED',
      roll: cleanRoll,
      examId,
      payload
    });

    // 3. Sync to Cloud DB (Supabase) if enabled
    if (CLOUD_CONFIG.enabled && CLOUD_CONFIG.supabaseUrl && CLOUD_CONFIG.supabaseAnonKey) {
      try {
        const url = `${CLOUD_CONFIG.supabaseUrl}/rest/v1/${CLOUD_CONFIG.tableName}`;
        await fetch(url, {
          method: 'POST',
          headers: {
            'apikey': CLOUD_CONFIG.supabaseAnonKey,
            'Authorization': `Bearer ${CLOUD_CONFIG.supabaseAnonKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify({
            roll_number: cleanRoll,
            exam_id: examId,
            student_name: studentData.name,
            status: 'STARTED',
            started_at: payload.startedAt,
            fingerprint: this.deviceFingerprint,
            payload
          })
        });
      } catch (err) {
        console.warn("Cloud start record failed:", err);
      }
    }

    return payload;
  }

  /**
   * Updates partial answers in local storage as student clicks them
   */
  updateCurrentAnswers(roll, answers, examId = 'math-8-10.3') {
    const cleanRoll = String(roll).trim();
    const attempts = this.getAllLocalAttempts();
    const storageKey = this.getKey(cleanRoll, examId);
    if (attempts[storageKey]) {
      attempts[storageKey].answers = answers;
    }
    if (attempts[cleanRoll]) {
      attempts[cleanRoll].answers = answers;
    }
    this.saveAllLocalAttempts(attempts);
  }

  /**
   * Finalizes the exam: saves score, violation reason, completion time
   */
  async saveAttemptResult(resultData, examId = (resultData.examId || 'math-8-10.3')) {
    const cleanRoll = String(resultData.roll || resultData.number).trim();
    const storageKey = this.getKey(cleanRoll, examId);
    const finalPayload = {
      ...resultData,
      examId,
      status: 'SUBMITTED',
      submittedAt: new Date().toISOString(),
      submittedTimestamp: Date.now(),
      fingerprint: this.deviceFingerprint
    };

    // 1. Save to LocalStorage
    const attempts = this.getAllLocalAttempts();
    attempts[storageKey] = finalPayload;
    attempts[cleanRoll] = finalPayload; // fallback
    this.saveAllLocalAttempts(attempts);

    // 2. Broadcast to all open tabs to lock them
    this.broadcast({
      type: 'EXAM_SUBMITTED',
      roll: cleanRoll,
      payload: finalPayload
    });

    // 3. Save to Supabase Cloud DB if enabled
    if (CLOUD_CONFIG.enabled && CLOUD_CONFIG.supabaseUrl && CLOUD_CONFIG.supabaseAnonKey) {
      try {
        const url = `${CLOUD_CONFIG.supabaseUrl}/rest/v1/${CLOUD_CONFIG.tableName}`;
        await fetch(url, {
          method: 'POST',
          headers: {
            'apikey': CLOUD_CONFIG.supabaseAnonKey,
            'Authorization': `Bearer ${CLOUD_CONFIG.supabaseAnonKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify({
            roll_number: cleanRoll,
            student_name: finalPayload.name,
            status: 'SUBMITTED',
            score: finalPayload.score,
            total_questions: finalPayload.totalQuestions,
            violation_reason: finalPayload.violationReason,
            time_taken_seconds: finalPayload.timeTakenSeconds,
            submitted_at: finalPayload.submittedAt,
            fingerprint: this.deviceFingerprint,
            payload: finalPayload
          })
        });
      } catch (err) {
        console.warn("Cloud final record failed:", err);
      }
    }

    return finalPayload;
  }

  /**
   * Optional helper to configure Cloud credentials programmatically
   */
  configureCloud(url, key, tableName = "exam_attempts") {
    CLOUD_CONFIG.supabaseUrl = url;
    CLOUD_CONFIG.supabaseAnonKey = key;
    CLOUD_CONFIG.tableName = tableName;
    CLOUD_CONFIG.enabled = !!(url && key);
  }
}

// Global instance
window.ExamStorage = new ExamStorageService();
