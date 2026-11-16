/**
 * Security Engine for Anti-Cheat Online Exam
 * Enforces:
 * 1. Tab Switch / App Minimization / Screen Lock detection
 * 2. Window Blur & 400ms Focus Polling (Sidebars, Split-screen, Alt+Tab)
 * 3. Browser Back Button Trap (popstate)
 * 4. Fullscreen Enforcement (Desktop & Android)
 * 5. Instant Visual Blackout on focus loss / screenshot attempt
 * 6. Keyboard & Screenshot shortcuts blocking (PrintScreen, Snipping tool, DevTools, Ctrl+C/V/P/U)
 * 7. Clipboard sanitization on screenshot attempt
 * 8. Dynamic Unremovable Watermark Overlay with MutationObserver
 * 9. DevTools open detection
 * 10. Right click, selectstart, dragstart prevention
 */

class ExamSecurityEngine {
  constructor() {
    this.quizActive = false;
    this.focusPollInterval = null;
    this.watermarkObserver = null;
    this.fullscreenGracePeriod = false;
    this.watermarkElement = null;
    this.blackoutOverlay = null;
    this.audioContext = null;
    this.devToolsDetectionInterval = null;
    this.boundHandlers = {};
  }

  initDOMReferences() {
    this.blackoutOverlay = document.getElementById('blackout-overlay');
    this.watermarkContainer = document.getElementById('watermark-container');
  }

  /**
   * Called when student clicks "Start Exam"
   */
  async activateSecurity(studentInfo, onViolationCallback, options = {}) {
    this.initDOMReferences();
    this.onViolation = onViolationCallback;
    this.studentInfo = studentInfo;
    this.quizActive = true;
    this.fullscreenGracePeriod = true;
    this.enableWatermark = options.enableWatermark ?? false;

    // 1. Enter Fullscreen Mode
    await this.requestFullScreenMode();

    // End fullscreen transition grace period after 1200ms
    setTimeout(() => {
      this.fullscreenGracePeriod = false;
    }, 1200);

    // 2. Set up Browser Back Button Trap
    this.trapBackButton();

    // 3. Mount Dynamic Watermark (only if enabled, ultra-subtle, no technical jargon)
    if (this.enableWatermark) {
      this.setupDynamicWatermark(studentInfo);
    } else {
      this.clearWatermark();
    }

    // 4. Attach Event Listeners
    this.attachSecurityListeners();

    // 5. Start Focus Polling (every 400ms)
    this.startFocusPolling();

    // 6. Start DevTools detector
    this.startDevToolsDetection();

    // 7. Initialize Audio Alert Context
    this.initAudioContext();
  }

  /**
   * Request fullscreen with vendor fallbacks
   */
  async requestFullScreenMode() {
    const el = document.documentElement;
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      } else if (el.mozRequestFullScreen) {
        await el.mozRequestFullScreen();
      } else if (el.msRequestFullscreen) {
        await el.msRequestFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen request declined or unsupported on this device:", err);
      // If iOS Safari or unsupported, we log and proceed with other strict checks
    }
  }

  isFullScreen() {
    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
  }

  /**
   * Push dummy state so back button triggers popstate
   */
  trapBackButton() {
    try {
      window.history.pushState({ page: "exam-secure-mode", lock: true }, "", location.href);
      window.history.pushState({ page: "exam-running", lock: true }, "", location.href);
    } catch (e) {
      console.warn("History pushState failed:", e);
    }
  }

  clearWatermark() {
    if (this.watermarkObserver) {
      this.watermarkObserver.disconnect();
      this.watermarkObserver = null;
    }
    if (this.watermarkContainer) {
      this.watermarkContainer.innerHTML = '';
      this.watermarkContainer.classList.add('hidden');
    }
  }

  /**
   * Renders ultra-subtle security watermark with student details
   * (Faint, clean, non-distracting, no confusing technical text)
   */
  setupDynamicWatermark(studentInfo) {
    if (!this.watermarkContainer) return;

    const name = studentInfo.name || "Student";
    const roll = studentInfo.roll || "00";
    const markText = `${name} • Roll: ${roll}`;

    this.watermarkContainer.innerHTML = '';
    this.watermarkContainer.classList.remove('hidden');
    this.watermarkContainer.className = 'fixed inset-0 pointer-events-none select-none z-10 overflow-hidden flex flex-wrap items-center justify-around gap-16 p-8';
    this.watermarkContainer.style.opacity = '0.04';
    this.watermarkContainer.setAttribute('aria-hidden', 'true');

    // Create subtle, small watermark elements
    for (let i = 0; i < 36; i++) {
      const span = document.createElement('div');
      span.className = 'transform -rotate-15 text-slate-500 text-xs tracking-wider whitespace-nowrap select-none font-medium';
      span.textContent = markText;
      this.watermarkContainer.appendChild(span);
    }

    // Tamper Protection: MutationObserver
    if (window.MutationObserver) {
      if (this.watermarkObserver) {
        this.watermarkObserver.disconnect();
      }

      this.watermarkObserver = new MutationObserver((mutations) => {
        if (!this.quizActive || !this.enableWatermark) return;
        // Check if watermark was removed
        const isHidden = !document.body.contains(this.watermarkContainer);

        if (isHidden) {
          this.triggerViolation("Auto-submitted: Security Watermark Tampering Detected");
        }
      });

      this.watermarkObserver.observe(document.body, {
        childList: true
      });
    }
  }

  /**
   * Instantly applies black screen / blur blackout
   */
  applyInstantBlackout(active = true) {
    if (this.blackoutOverlay) {
      if (active) {
        this.blackoutOverlay.classList.remove('hidden');
        this.blackoutOverlay.style.opacity = '1';
        this.blackoutOverlay.style.filter = 'brightness(0) blur(30px)';
      } else {
        this.blackoutOverlay.classList.add('hidden');
        this.blackoutOverlay.style.opacity = '0';
      }
    }
    const examScreen = document.getElementById('exam-screen');
    if (examScreen) {
      if (active) {
        examScreen.classList.add('blackout-active');
      } else {
        examScreen.classList.remove('blackout-active');
      }
    }
  }

  /**
   * Sanitize clipboard to block screenshot or text theft
   */
  sanitizeClipboard() {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText("🚫 Anti-Cheat Security Notice: Screenshots, copying, and unauthorized shortcuts are strictly prohibited during the examination. Your exam has been locked.");
      }
    } catch (e) {
      // Clipboard write might need focused document
    }
  }

  /**
   * Attach all anti-cheat event listeners
   */
  attachSecurityListeners() {
    // 1. Visibility Change (Tab switch, App minimize, Mobile home button, Screen lock)
    this.boundHandlers.onVisibilityChange = () => {
      if (!this.quizActive) return;
      if (document.visibilityState === 'hidden' || document.hidden) {
        this.applyInstantBlackout(true);
        this.triggerViolation("Auto-submitted: Tab Switched / App Minimized / Screen Locked");
      }
    };
    document.addEventListener('visibilitychange', this.boundHandlers.onVisibilityChange);

    // 2. Window Blur (Focus loss to another window, sidebar, split screen, Opera GX panel, Alt+Tab)
    this.boundHandlers.onWindowBlur = () => {
      if (!this.quizActive) return;
      this.applyInstantBlackout(true);
      this.triggerViolation("Auto-submitted: Window Lost Focus / Sidebar / Split-Screen Detected");
    };
    window.addEventListener('blur', this.boundHandlers.onWindowBlur);

    // 3. Browser Back Button / History navigation
    this.boundHandlers.onPopState = (e) => {
      if (!this.quizActive) return;
      // Re-push to trap
      try {
        window.history.pushState({ page: "exam-locked" }, "", location.href);
      } catch (err) {}
      this.triggerViolation("Auto-submitted: Pressed Back Button");
    };
    window.addEventListener('popstate', this.boundHandlers.onPopState);

    // 4. Fullscreen Change / Exit
    this.boundHandlers.onFullscreenChange = () => {
      if (!this.quizActive || this.fullscreenGracePeriod) return;
      // If fullscreen was supported and is now exited
      const supportsFS = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
      if (supportsFS && !this.isFullScreen()) {
        this.applyInstantBlackout(true);
        this.triggerViolation("Auto-submitted: Exited Fullscreen Mode");
      }
    };
    document.addEventListener('fullscreenchange', this.boundHandlers.onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', this.boundHandlers.onFullscreenChange);
    document.addEventListener('mozfullscreenchange', this.boundHandlers.onFullscreenChange);
    document.addEventListener('MSFullscreenChange', this.boundHandlers.onFullscreenChange);

    // 5. Keydown / Shortcut Interceptor
    this.boundHandlers.onKeyDown = (e) => {
      if (!this.quizActive) return;

      const key = e.key;
      const code = e.keyCode || e.which;
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const alt = e.altKey;

      // PrintScreen / Snipping Tool
      if (key === 'PrintScreen' || code === 44 || (alt && key === 'PrintScreen')) {
        e.preventDefault();
        e.stopPropagation();
        this.applyInstantBlackout(true);
        this.sanitizeClipboard();
        this.triggerViolation("Auto-submitted: PrintScreen Key Pressed");
        return false;
      }

      // Windows Snipping Tool (Win + Shift + S or Ctrl + Shift + S)
      if ((ctrl || alt || e.metaKey) && shift && (key === 'S' || key === 's' || code === 83)) {
        e.preventDefault();
        e.stopPropagation();
        this.applyInstantBlackout(true);
        this.sanitizeClipboard();
        this.triggerViolation("Auto-submitted: Screenshot Shortcut Attempt (Shift+S)");
        return false;
      }

      // F12 (DevTools)
      if (key === 'F12' || code === 123) {
        e.preventDefault();
        e.stopPropagation();
        this.applyInstantBlackout(true);
        this.triggerViolation("Auto-submitted: F12 Developer Tools Attempt");
        return false;
      }

      // DevTools shortcuts: Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
      if (ctrl && shift && ['I', 'i', 'J', 'j', 'C', 'c'].includes(key)) {
        e.preventDefault();
        e.stopPropagation();
        this.applyInstantBlackout(true);
        this.triggerViolation("Auto-submitted: Inspect Element / DevTools Shortcut");
        return false;
      }

      // View Source (Ctrl+U)
      if (ctrl && (key === 'u' || key === 'U' || code === 85)) {
        e.preventDefault();
        e.stopPropagation();
        this.triggerViolation("Auto-submitted: View Page Source Attempt (Ctrl+U)");
        return false;
      }

      // Print (Ctrl+P)
      if (ctrl && (key === 'p' || key === 'P' || code === 80)) {
        e.preventDefault();
        e.stopPropagation();
        this.applyInstantBlackout(true);
        this.triggerViolation("Auto-submitted: Print Attempt (Ctrl+P)");
        return false;
      }

      // Copy / Cut / Paste / Select All (Ctrl+C, Ctrl+X, Ctrl+V, Ctrl+A)
      if (ctrl && ['c', 'C', 'x', 'X', 'v', 'V', 'a', 'A'].includes(key)) {
        e.preventDefault();
        e.stopPropagation();
        this.sanitizeClipboard();
        this.triggerViolation("Auto-submitted: Copy/Paste/Clipboard Shortcut Attempt");
        return false;
      }

      // Save page (Ctrl+S)
      if (ctrl && (key === 's' || key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };
    window.addEventListener('keydown', this.boundHandlers.onKeyDown, true);

    // KeyUp listener specifically for PrintScreen which triggers on release on some OS
    this.boundHandlers.onKeyUp = (e) => {
      if (!this.quizActive) return;
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault();
        this.applyInstantBlackout(true);
        this.sanitizeClipboard();
        this.triggerViolation("Auto-submitted: PrintScreen Key Released");
      }
    };
    window.addEventListener('keyup', this.boundHandlers.onKeyUp, true);

    // 6. Right-Click Context Menu Prevention
    this.boundHandlers.onContextMenu = (e) => {
      if (this.quizActive) {
        e.preventDefault();
        return false;
      }
    };
    document.addEventListener('contextmenu', this.boundHandlers.onContextMenu);

    // 7. Text Selection Prevention
    this.boundHandlers.onSelectStart = (e) => {
      if (this.quizActive) {
        e.preventDefault();
        return false;
      }
    };
    document.addEventListener('selectstart', this.boundHandlers.onSelectStart);

    // 8. Drag Prevention
    this.boundHandlers.onDragStart = (e) => {
      if (this.quizActive) {
        e.preventDefault();
        return false;
      }
    };
    document.addEventListener('dragstart', this.boundHandlers.onDragStart);

    // 9. Window resize / split-screen detection
    this.boundHandlers.onResize = () => {
      if (!this.quizActive || this.fullscreenGracePeriod) return;
      // If user splits screen or docks dev tools, fullscreen collapses
      const supportsFS = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
      if (supportsFS && !this.isFullScreen()) {
        this.triggerViolation("Auto-submitted: Screen Resized / Split-Screen / Exited Fullscreen");
      }
    };
    window.addEventListener('resize', this.boundHandlers.onResize);
  }

  /**
   * Continuous 400ms Polling: checks document.hasFocus()
   * Specifically catches Opera GX side panels, Edge Sidebar, external monitor clicks
   */
  startFocusPolling() {
    if (this.focusPollInterval) clearInterval(this.focusPollInterval);

    this.focusPollInterval = setInterval(() => {
      if (!this.quizActive) return;
      if (!document.hasFocus()) {
        this.applyInstantBlackout(true);
        this.triggerViolation("Auto-submitted: Window Lost Focus (Sidebar / Browser Panel / Split Screen)");
      }
    }, 400);
  }

  /**
   * DevTools Detection via console format timing trick
   */
  startDevToolsDetection() {
    if (this.devToolsDetectionInterval) clearInterval(this.devToolsDetectionInterval);

    let devtoolsOpen = false;
    const threshold = 160;

    this.devToolsDetectionInterval = setInterval(() => {
      if (!this.quizActive) return;

      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;

      if (widthThreshold || heightThreshold) {
        if (!this.isFullScreen() && !this.fullscreenGracePeriod) {
          this.triggerViolation("Auto-submitted: Developer Tools Docking Detected");
        }
      }
    }, 1000);
  }

  initAudioContext() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
      }
    } catch (e) {
      console.warn("AudioContext init failed:", e);
    }
  }

  playViolationAlarm() {
    try {
      if (!this.audioContext) return;
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, this.audioContext.currentTime); // A4
      osc.frequency.exponentialRampToValueAtTime(880, this.audioContext.currentTime + 0.3);
      osc.frequency.exponentialRampToValueAtTime(220, this.audioContext.currentTime + 0.6);

      gain.gain.setValueAtTime(0.3, this.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.8);

      osc.connect(gain);
      gain.connect(this.audioContext.destination);

      osc.start();
      osc.stop(this.audioContext.currentTime + 0.8);
    } catch (e) {
      console.warn("Audio alarm failed:", e);
    }
  }

  /**
   * Central violation handler: terminates exam immediately
   */
  triggerViolation(reason) {
    if (!this.quizActive) return;

    // Immediately freeze active exam state
    this.quizActive = false;
    this.playViolationAlarm();
    this.cleanup();

    if (typeof this.onViolation === 'function') {
      this.onViolation(reason);
    }
  }

  /**
   * Stop all security monitors and teardown
   */
  cleanup() {
    this.quizActive = false;

    if (this.focusPollInterval) {
      clearInterval(this.focusPollInterval);
      this.focusPollInterval = null;
    }

    if (this.devToolsDetectionInterval) {
      clearInterval(this.devToolsDetectionInterval);
      this.devToolsDetectionInterval = null;
    }

    // Completely clear and hide watermark so Results Screen is 100% clean
    this.clearWatermark();

    // Note: Keep listeners or remove them cleanly
    if (this.boundHandlers.onVisibilityChange) {
      document.removeEventListener('visibilitychange', this.boundHandlers.onVisibilityChange);
    }
    if (this.boundHandlers.onWindowBlur) {
      window.removeEventListener('blur', this.boundHandlers.onWindowBlur);
    }
    if (this.boundHandlers.onKeyDown) {
      window.removeEventListener('keydown', this.boundHandlers.onKeyDown, true);
    }
    if (this.boundHandlers.onKeyUp) {
      window.removeEventListener('keyup', this.boundHandlers.onKeyUp, true);
    }
    if (this.boundHandlers.onResize) {
      window.removeEventListener('resize', this.boundHandlers.onResize);
    }
  }
}

// Global instance
window.ExamSecurity = new ExamSecurityEngine();
