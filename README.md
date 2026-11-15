# Strict Anti-Cheat Online Examination Portal
### All-Exams Institution Platform with Class 8 Math & Science

A production-ready, mobile-first, and desktop-compatible **Strict Anti-Cheat Examination System** and **Online Exam Portal**. Supports multiple exams, student portal, visual exam builder for teachers, and tamper-proof security.

Zero build tools required. Built with clean HTML5, Tailwind CSS via CDN, and Vanilla JavaScript. Deployable with a single drag-and-drop or push to **Vercel** or **Netlify**, with a modular async persistence hook for **Supabase/Firebase/REST DB**.

---

## 👩‍🏫 How Teachers Can Add Quizzes & Exams

Teachers can add new exams and quizzes in **two convenient ways**:

### Method 1: Visual Quiz Builder in Admin Dashboard (Zero Code)
1. Navigate to [`admin.html`](admin.html).
2. Enter the teacher passcode: `teacher2024`.
3. Click the purple button: **`+ নতুন পরীক্ষা যুক্ত করুন (Add Exam)`**.
4. Fill in:
   - **Exam Title, Subject, Class, Duration (Minutes), Pass Marks, and Status** (`Active` or `Upcoming`).
   - Add MCQs: Question statement, 4 options (A, B, C, D), radio button to mark the correct option, and detailed explanation (ব্যাখ্যা).
   - Click **`+ আরও একটি প্রশ্ন যোগ করুন`** to add more questions.
5. Click **`পোর্টালে সংরক্ষণ ও সক্রিয় করুন (Save & Publish)`**.
   - The exam appears immediately on students' portal!
   - You can also click **`কোড হিসেবে কপি করুন (Copy Code)`** to copy the formatted JavaScript snippet.

### Method 2: Modular Exam Files (Subject > Chapter > Quiz No)
Every exam has its own separate file organized in sub-folders:
`exams/[subject]/[chapter]/quiz_[number].js`

```text
exams/
├── math/
│   ├── chapter_10.3/
│   │   └── quiz_1.js     <-- Class 8 Math Chapter 10.3 (Active)
│   └── chapter_11/
│       └── quiz_1.js     <-- Class 8 Math Chapter 11 (Upcoming)
└── science/
    └── chapter_07/
        └── quiz_1.js     <-- Class 8 Science Chapter 7 (Upcoming)
```

To add a new quiz:
1. Copy [`exams/template_quiz.js`](exams/template_quiz.js) into your desired subject & chapter folder.
2. Edit questions, options, and explanations.
3. Include the script tag in `index.html` and `admin.html`:
   ```html
   <script src="exams/math/chapter_12/quiz_1.js"></script>
   ```

---

## 👨‍🎓 Registered Student Accounts (Hardcoded Authentication)

Students log in using their **Student Number** and **Password** (configured in [`js/students.js`](js/students.js)):

| Student Number | Password | Name | Status |
| :---: | :---: | :--- | :---: |
| **`01800000001`** | **`1234`** | Student One | Configured |

> **Adding More Students:** As you provide the numbers and passwords for the rest of the students, they will be added to `REGISTERED_STUDENTS` in [`js/students.js`](js/students.js).

---

## 🧭 Student Journey & Personal Portal Flow

1. **Authentication:** Student enters their Student Number (`01800000001`) and Password (`1234`).
2. **Personal Student Dashboard (`#portal-screen`):**
   - Displays Student's Name, Roll, Section, and Class.
   - Shows assigned examination: **Class 8 Math - Chapter 10.3 (বৃত্ত ও সিলিন্ডার)**.
3. **If Exam is Not Given Yet:**
   - Status badge shows: `⏳ পরীক্ষা বাকি রয়েছে (Ready to Take)`.
   - Action button: **"পরীক্ষা শুরু করুন (Start Exam Now)"**.
   - Initiates secure full-screen exam mode with strict anti-cheat tracking.
4. **If Exam is Already Given / Completed:**
   - Status badge shows: `✓ পরীক্ষা সম্পন্ন (Completed)` with their score (e.g. `16 / 20 (80%)`).
   - Retaking is strictly locked.
   - Action button: **"📊 ফলাফল ও সঠিক সমাধান দেখুন (View Results & Correct Answers)"**.
   - Displays all 20 questions with:
     - Student's selected option
     - **Green highlighted Correct Answer (সঠিক উত্তর)**
     - Detailed step-by-step mathematical solution (ব্যাখ্যা)

---

## 🔒 Security Architecture & Anti-Cheat Mechanisms

### 1. One-Time Exam Link & Multi-Browser Lock
- **Pre-Exam Gate:** Requires the student's **Full Name** and **Roll Number / Student ID** (or pre-populates via `?roll=101&name=Karim` URL parameters).
- **Single-Attempt Client Lock:** Verifies `localStorage.getItem('exam_math_10_3_state')` on load. If the roll number has already completed the exam, it skips the quiz completely and displays the **Permanent Results Screen**.
- **Real-Time Cross-Tab Lock:** Uses the HTML5 `BroadcastChannel` API (`math_exam_security_channel`) to immediately lock and terminate duplicate attempts opened in secondary tabs of the same browser.
- **Server-Side Cloud Ready Hook:** Modular async functions `checkAttemptStatus(roll)`, `recordExamStart(payload)`, and `saveAttemptResult(payload)` query and synchronize with Supabase PostgreSQL to prevent cross-browser evasion (e.g., attempting in Edge, then opening Opera or Incognito).
- **State Lock on Start:** The exact second "Start Exam" is clicked, status is recorded as `STARTED`. If the student refreshes or closes the page midway, the system locks them out and marks the exam as `Auto-submitted: Interrupted / Page Reloaded during Active Exam`.

### 2. Strict Auto-Submit Triggers (Mobile & Desktop)
When the exam is running (`quizActive = true`), any of the following events **immediately captures all selected answers**, applies visual blackout, logs the exact violation reason, and routes to the Results Screen:
1. **Tab Switch / App Minimization / Mobile Home Button:**
   - Monitored through `document.addEventListener('visibilitychange')` checking `document.visibilityState === 'hidden'`.
2. **Window Focus Loss (PC Sidebars, Opera GX Panels, Split-Screen, Alt+Tab, 2nd Monitor):**
   - Monitored through `window.addEventListener('blur')`.
   - Continuous `setInterval` every `400ms` polling `!document.hasFocus()` to trap browser panels (Opera AI/Messenger, Edge Copilot sidebar) that may bypass standard blur events.
3. **Browser / Android Back Button Trap:**
   - Double dummy history state pushed via `history.pushState()`.
   - Trapped via `window.addEventListener('popstate')`, triggering `Auto-submitted: Pressed Back button`.
4. **Fullscreen Exit Enforcement:**
   - Fullscreen requested upon clicking "Start Exam" (`requestFullscreen()` with webkit/moz vendor fallbacks).
   - Trapped via `fullscreenchange` / `webkitfullscreenchange`. Exiting fullscreen triggers `Auto-submitted: Exited Fullscreen Mode`.
5. **20-Minute Countdown Expiry:**
   - Auto-submits precisely when the countdown timer reaches `00:00`.

### 3. Anti-Screenshot, Anti-Copy & Anti-DevTools Protection
1. **Instant Visual Blackout:**
   - High-priority `#blackout-overlay` with CSS `.blackout-active` (`filter: brightness(0) blur(35px); opacity: 0;`).
   - Triggered on the exact millisecond of focus loss or screenshot keypress, preventing Snipping Tool or mobile screen-recorders from grabbing question content.
2. **Keyboard Shortcut Blocking:**
   - Blocks `PrintScreen` (keyCode 44), `F12`, `Ctrl+Shift+I/J/C`, `Win+Shift+S`, `Ctrl+Shift+S`, `Ctrl+U`, `Ctrl+P`, `Ctrl+C`, `Ctrl+V`, `Ctrl+X`.
   - On screenshot or restricted keypress, overwrites the clipboard with a security notice and auto-submits.
3. **Dynamic Unremovable Watermark:**
   - Renders 48 diagonal watermark tiles with `Student Name + Roll Number + Timestamp + Anti-Cheat Protected` across the entire viewport.
   - Protected by a `MutationObserver` that auto-submits if DevTools is used to hide or remove the watermark node.
4. **DOM Restrictions:**
   - Text selection disabled (`user-select: none`).
   - Right-click context menu disabled.
   - Print stylesheets disabled (`@media print { body { display: none !important; } }`), except for the verified single-card result slip.

---

## 📚 Examination Details (Class 8 Math - Chapter 10.3)
- **Topic:** বৃত্ত ও সিলিন্ডার (Circle & Cylinder - NCTB Syllabus)
- **Total Questions:** 20 Multiple Choice Questions (MCQs)
- **Time Allocated:** 20 Minutes (1 minute per question)
- **Passing Score:** 8 / 20 (40%)
- **Topics Covered:**
  - বৃত্তের ব্যাস, ব্যাসার্ধ ও জ্যা ($d = 2r$, $r = d/2$)
  - পরিধি ($C = 2\pi r = \pi d$) ও ক্ষেত্রফল ($A = \pi r^2$)
  - পাই ($\pi$) এর ধারণা ও ঐতিহাসিক আসন্ন মান ($22/7$ বা $3.1416$)
  - সিলিন্ডারের ভূমির ক্ষেত্রফল ($\pi r^2$) ও বক্রতলের ক্ষেত্রফল ($2\pi rh$)
  - সিলিন্ডারের সমগ্রতলের ক্ষেত্রফল ($2\pi r(r + h)$)
  - সিলিন্ডারের আয়তন ($V = \pi r^2 h$)
  - বাস্তব সমস্যা: চাকার পরিধি ও ঘূর্ণন সংখ্যা, বৃত্তাকার পার্কের বেষ্টনী খরচ, ফাঁপা লোহার পাইপের উপাদান আয়তন, অর্ধবৃত্তস্থ কোণের পরিমাপ।

---

## 🚀 Quick Start / Local Testing

### Option 1: Python HTTP Server
```bash
# In the project directory:
python -m http.server 8000
```
Then visit `http://localhost:8000` in Google Chrome, Microsoft Edge, Opera, Brave, or Firefox.

### Option 2: Node.js (npx serve)
```bash
npx serve .
```

### URL Parameter Support
You can pre-fill or distribute individualized exam links:
```text
http://localhost:8000/?roll=STD-801&name=Tanvir+Ahmed
```

---

## 🌐 Cloud Persistence Setup (Supabase)

1. Create a free project at [supabase.com](https://supabase.com).
2. Go to the **SQL Editor** in your Supabase dashboard and run the SQL code from [`supabase-schema.sql`](supabase-schema.sql).
3. In **Project Settings -> API**, copy your **Project URL** and **anon public key**.
4. Open `js/storage.js` and update the `CLOUD_CONFIG` object:
   ```javascript
   const CLOUD_CONFIG = {
     enabled: true,
     supabaseUrl: "https://your-project-id.supabase.co",
     supabaseAnonKey: "your-anon-public-key",
     tableName: "exam_attempts"
   };
   ```
*If left `enabled: false`, the system functions in full local simulation mode using `localStorage` and `BroadcastChannel`.*

---

## 🚢 Deployment

### Deploy to Vercel
1. Install Vercel CLI (`npm i -g vercel`) or push the code to a GitHub repository.
2. Run `vercel` in the root folder, or import the GitHub repo in [vercel.com](https://vercel.com).
3. Settings are pre-configured in `vercel.json` with security headers (`X-Frame-Options: DENY`, `no-cache`).

### Deploy to Netlify
1. Drag and drop the project folder directly into [app.netlify.com/drop](https://app.netlify.com/drop).
2. Or connect your GitHub repository; Netlify will read `netlify.toml` automatically.

---

## 🧪 Anti-Cheat Test Suite
To verify security triggers during testing:
1. **Tab Switch Test:** Start an exam, open a new tab (`Ctrl+T`). Observe instant blackout and auto-submit with `"Auto-submitted: Tab Switched / App Minimized / Screen Locked"`.
2. **Sidebar / Focus Loss Test:** In Edge/Opera, open the browser AI sidebar or click into another application on a secondary screen. Observe auto-submit within 400ms.
3. **Back Button Test:** Press browser back button or Android back gesture. Observe `Auto-submitted: Pressed Back button`.
4. **Fullscreen Exit Test:** Press `Esc` or swipe down to leave fullscreen. Observe `Auto-submitted: Exited Fullscreen Mode`.
5. **PrintScreen Test:** Press the `PrintScreen` key. Observe instant blackout, sanitized clipboard, and auto-submit.
6. **Reload Lock Test:** Refresh during active exam. Notice you are redirected straight to Results Screen with `"Auto-submitted: Interrupted / Page Reloaded during Active Exam"`.
