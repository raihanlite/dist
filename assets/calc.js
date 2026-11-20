/* StudyKoro calculator core — shared by the SSC, HSC, CGPA and IELTS tools.
 * Loaded as /assets/calc.js. Each tool page calls one builder with its own
 * config (subject lists, groups, marks rules); all maths lives here.
 *
 * Rules, researched Nov 2026 (see the guide text on each tool page):
 * - SSC/HSC 5.00 scale: 80+ A+ 5.00, 70-79 A 4.00, 60-69 A- 3.50,
 *   50-59 B 3.00, 40-49 C 2.00, 33-39 D 1.00, below 33 F 0.00.
 * - SSC: 9 core subjects, GPA = (core points + 4th-subject bonus) / 9.
 *   HSC: 6 core subjects, GPA = (core points + 4th-subject bonus) / 6.
 *   Bonus = max(0, 4th-subject grade point - 2.00) — the FULL excess,
 *   so A+ adds 3.00, A adds 2.00, A- adds 1.50, B adds 1.00.
 *   An F in any core subject makes the whole GPA 0.00; an F in the
 *   4th subject only removes the bonus. GPA is capped at 5.00.
 * - CGPA: UGC uniform 4.00 scale (A+ 4.00, A 3.75, A- 3.50, B+ 3.25,
 *   B 3.00, B- 2.75, C+ 2.50, C 2.25, D 2.00, F 0.00).
 * - IELTS: commonly published raw-score to band tables (IELTS/British
 *   Council/IDP guidance); exact boundaries shift by about a mark
 *   between test versions, so results are estimates.
 */
(function () {
  'use strict';

  /* ---------- grade scales ---------- */

  var BD5_GRADES = [
    { label: 'A+ (5.00)', value: 5 },
    { label: 'A (4.00)', value: 4 },
    { label: 'A- (3.50)', value: 3.5 },
    { label: 'B (3.00)', value: 3 },
    { label: 'C (2.00)', value: 2 },
    { label: 'D (1.00)', value: 1 },
    { label: 'F (0.00)', value: 0 }
  ];

  var UGC_GRADES = [
    { label: 'A+ (4.00)', value: 4 },
    { label: 'A (3.75)', value: 3.75 },
    { label: 'A- (3.50)', value: 3.5 },
    { label: 'B+ (3.25)', value: 3.25 },
    { label: 'B (3.00)', value: 3 },
    { label: 'B- (2.75)', value: 2.75 },
    { label: 'C+ (2.50)', value: 2.5 },
    { label: 'C (2.25)', value: 2.25 },
    { label: 'D (2.00)', value: 2 },
    { label: 'F (0.00)', value: 0 }
  ];

  // Marks (0-100 scale) to grade point on the Bangladesh 5.00 scale.
  function marksToPoint5(m) {
    if (m >= 80) return 5;
    if (m >= 70) return 4;
    if (m >= 60) return 3.5;
    if (m >= 50) return 3;
    if (m >= 40) return 2;
    if (m >= 33) return 1;
    return 0;
  }

  // Percentage (0-100) to grade point on the UGC 4.00 scale.
  function percentToUGC(p) {
    if (p >= 80) return 4;
    if (p >= 75) return 3.75;
    if (p >= 70) return 3.5;
    if (p >= 65) return 3.25;
    if (p >= 60) return 3;
    if (p >= 55) return 2.75;
    if (p >= 50) return 2.5;
    if (p >= 45) return 2.25;
    if (p >= 40) return 2;
    return 0;
  }

  /* ---------- IELTS conversion tables ---------- */

  var IELTS_LISTENING = [
    [39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6],
    [18, 5.5], [16, 5], [13, 4.5], [10, 4], [7, 3.5], [5, 3], [3, 2.5]
  ];
  var IELTS_READING = {
    academic: [
      [39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6],
      [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5]
    ],
    general: [
      [40, 9], [39, 8.5], [37, 8], [36, 7.5], [34, 7], [32, 6.5], [30, 6],
      [27, 5.5], [23, 5], [19, 4.5], [15, 4], [12, 3.5], [9, 3], [6, 2.5], [4, 2]
    ]
  };

  function ieltsRawToBand(raw, section, module) {
    var score = Math.min(40, Math.max(0, Math.floor(raw) || 0));
    var table = section === 'listening' ? IELTS_LISTENING : IELTS_READING[module];
    for (var i = 0; i < table.length; i++) {
      if (score >= table[i][0]) return table[i][1];
    }
    return 2; // below the lowest row
  }

  // Official IELTS rounding: .25 rounds up to the next half band,
  // .75 rounds up to the next whole band.
  function ieltsOverall(l, r, w, s) {
    var average = (l + r + w + s) / 4;
    var fraction = average % 1;
    if (fraction < 0.25) return Math.floor(average);
    if (fraction < 0.75) return Math.floor(average) + 0.5;
    return Math.ceil(average);
  }

  /* ---------- small DOM helpers ---------- */

  function $(id) { return document.getElementById(id); }

  function gradeOptions(grades) {
    return '<option value="">Select grade</option>' +
      grades.map(function (g) {
        return '<option value="' + g.value + '">' + g.label + '</option>';
      }).join('');
  }

  function showHint(resultEl, msg) {
    resultEl.innerHTML = '<p class="sk-msg">' + msg + '</p>';
  }

  function showResult(resultEl, parts) {
    resultEl.innerHTML = '<div class="sk-result">' + parts.join('') + '</div>';
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------- GPA tool: SSC + HSC ----------
   * cfg = {
   *   rootId, groupId, subjectsId, fourthId, fourthInputsId,
   *   calcId, resetId, resultId,
   *   coreCount: 9 (SSC) | 6 (HSC),
   *   marksMax: function (subject) -> 100 (SSC) | 200, or 100 for ICT (HSC),
   *   groups: { key: {
   *     fixed: [subject names, one row each],
   *     pickers: [{ options: [subject names] }],   // one row each; the
   *        subject itself is chosen from the list (duplicates blocked)
   *     fourthBase: [extra 4th-subject options],
   *     fourthFromPickers: true|false  // unpicked picker options join the 4th list
   *   } }
   * }
   * Every row takes a letter grade OR marks; choosing one clears the other.
   * The result updates live once every core row is filled.
   */
  function gpaTool(cfg) {
    var root = $(cfg.rootId);
    if (!root) return;
    var groupEl = $(cfg.groupId);
    var subjectsEl = $(cfg.subjectsId);
    var fourthEl = $(cfg.fourthId);
    var fourthInputsEl = $(cfg.fourthInputsId);
    var resultEl = $(cfg.resultId);
    // What the tool calls its counted subjects (SSC: "core subject", HSC: "main subject").
    var subjectWord = cfg.subjectWord || 'core subject';

    function group() { return cfg.groups[groupEl.value]; }

    // One subject row: subject name on its own line, then grade and marks
    // side by side, each with a small visible label and an "or" between
    // them — grade and marks are alternatives, and the old bare <label>
    // for the subject name was not attached to any control.
    function rowHtml(kind, index, subject, pickerOptions) {
      var label;
      if (kind === 'picker') {
        label = '<select class="sk-subject" data-picker="' + index + '" aria-label="Subject">' +
          pickerOptions.map(function (s) {
            return '<option' + (s === subject ? ' selected' : '') + '>' + esc(s) + '</option>';
          }).join('') + '</select>';
      } else {
        label = '<span class="sk-subject-name">' + esc(subject) + '</span>';
      }
      var max = cfg.marksMax(subject);
      return '<div class="sk-row" data-subject="' + esc(subject) + '">' + label +
        '<div class="sk-inputs">' +
        '<span class="sk-mini"><span class="sk-mini-label">Grade</span>' +
        '<select class="sk-grade" aria-label="' + esc(subject) + ' grade">' + gradeOptions(BD5_GRADES) + '</select></span>' +
        '<span class="sk-or">or</span>' +
        '<span class="sk-mini"><span class="sk-mini-label">Marks</span>' +
        '<input type="number" class="sk-marks" min="0" max="' + max + '" placeholder="Marks 0-' + max +
        '" aria-label="' + esc(subject) + ' marks"></span>' +
        '</div></div>';
    }

    function pickerValues() {
      return Array.prototype.slice.call(subjectsEl.querySelectorAll('[data-picker]'))
        .map(function (sel) { return sel.value; });
    }

    // Rebuild picker options so no subject can be chosen twice.
    function refreshPickers() {
      var chosen = pickerValues();
      subjectsEl.querySelectorAll('[data-picker]').forEach(function (sel) {
        var idx = Number(sel.getAttribute('data-picker'));
        var options = group().pickers[idx].options;
        var current = sel.value;
        sel.innerHTML = options
          .filter(function (s) { return s === current || chosen.indexOf(s) === -1; })
          .map(function (s) {
            return '<option' + (s === current ? ' selected' : '') + '>' + esc(s) + '</option>';
          }).join('');
        sel.closest('.sk-row').setAttribute('data-subject', current);
      });
    }

    function fourthOptions() {
      var g = group();
      var opts = (g.fourthBase || []).slice();
      if (g.fourthFromPickers) {
        var chosen = pickerValues();
        g.pickers.forEach(function (p) {
          p.options.forEach(function (s) {
            if (chosen.indexOf(s) === -1 && opts.indexOf(s) === -1) opts.push(s);
          });
        });
      }
      return opts;
    }

    var lastFourth = null;

    function renderFourthOptions() {
      var current = fourthEl.value;
      fourthEl.innerHTML = '<option value="">No 4th subject</option>' +
        fourthOptions().map(function (s) {
          return '<option' + (s === current ? ' selected' : '') + '>' + esc(s) + '</option>';
        }).join('');
      if (fourthOptions().indexOf(current) === -1) fourthEl.value = '';
      // Only rebuild the 4th-subject inputs when the subject actually
      // changed — otherwise a core-subject edit would wipe the 4th grade.
      if (fourthEl.value !== lastFourth) {
        lastFourth = fourthEl.value;
        renderFourthInputs();
      }
    }

    function renderFourthInputs() {
      if (!fourthEl.value) { fourthInputsEl.innerHTML = ''; return; }
      var subject = fourthEl.value;
      var max = cfg.marksMax(subject);
      fourthInputsEl.innerHTML =
        '<div class="sk-row" data-subject="' + esc(subject) + '">' +
        '<span class="sk-subject-name">' + esc(subject) + '</span>' +
        '<div class="sk-inputs">' +
        '<span class="sk-mini"><span class="sk-mini-label">Grade</span>' +
        '<select class="sk-grade" id="' + cfg.rootId + '-opt-grade" aria-label="' + esc(subject) + ' grade">' +
        gradeOptions(BD5_GRADES) + '</select></span>' +
        '<span class="sk-or">or</span>' +
        '<span class="sk-mini"><span class="sk-mini-label">Marks</span>' +
        '<input type="number" class="sk-marks" id="' + cfg.rootId + '-opt-marks" min="0" max="' + max +
        '" placeholder="Marks 0-' + max + '" aria-label="' + esc(subject) + ' marks"></span>' +
        '</div></div>';
      wireRow(fourthInputsEl.querySelector('.sk-row'));
    }

    // Grade and marks are alternatives: filling one clears the other.
    function wireRow(row) {
      var sel = row.querySelector('.sk-grade');
      var inp = row.querySelector('.sk-marks');
      sel.addEventListener('change', function () { if (sel.value !== '') inp.value = ''; });
      inp.addEventListener('input', function () { if (inp.value !== '') sel.value = ''; });
    }

    function render() {
      var g = group();
      var html = '';
      g.fixed.forEach(function (name) { html += rowHtml('fixed', 0, name); });
      (g.pickers || []).forEach(function (p, i) {
        html += rowHtml('picker', i, p.options[i] || p.options[0], p.options);
      });
      subjectsEl.innerHTML = html;
      subjectsEl.querySelectorAll('.sk-row').forEach(wireRow);
      refreshPickers();
      // A fresh form (group change or Reset) starts with no 4th subject.
      fourthEl.value = '';
      lastFourth = '';
      renderFourthOptions();
      resultEl.innerHTML = '';
    }

    // null = not entered yet. An empty field is never a grade — and never an F.
    function pointOf(row) {
      var subject = row.getAttribute('data-subject');
      var gradeEl = row.querySelector('.sk-grade');
      var marksEl = row.querySelector('.sk-marks');
      if (gradeEl.value !== '') return parseFloat(gradeEl.value);
      if (marksEl.value !== '') {
        var marks = parseFloat(marksEl.value);
        if (isNaN(marks)) return null;
        return marksToPoint5(marks / (cfg.marksMax(subject) / 100));
      }
      return null;
    }

    // showHint=true only for the Calculate button; live updates stay quiet.
    function calculate(withHint) {
      var rows = Array.prototype.slice.call(subjectsEl.querySelectorAll('.sk-row'));
      var points = rows.map(pointOf);
      if (points.some(function (p) { return p === null; })) {
        resultEl.innerHTML = withHint
          ? '<p class="sk-msg">Fill in every ' + subjectWord + ' first — an empty field is not a grade.</p>'
          : '';
        return;
      }
      var failed = points.some(function (p) { return p === 0; });
      var total = points.reduce(function (a, b) { return a + b; }, 0);
      var bonus = 0;
      if (fourthEl.value) {
        var fourthRow = fourthInputsEl.querySelector('.sk-row');
        var optPoint = fourthRow ? pointOf(fourthRow) : null;
        if (optPoint !== null) bonus = Math.max(0, optPoint - 2);
      }
      var gpa = Math.min((total + bonus) / cfg.coreCount, failed ? 0 : 5);
      var status = failed
        ? '<span class="sk-bad">Failed — an F in any core subject makes the overall GPA 0.00</span>'
        : (gpa >= 5 ? '<span class="sk-ok">Golden A+</span>' : '<span class="sk-ok">Passed</span>');
      showResult(resultEl, [
        '<p class="sk-result-label">Your GPA</p>',
        '<p class="sk-result-value">' + (failed ? '0.00' : gpa.toFixed(2)) + '</p>',
        '<p class="sk-result-note">' + status + '</p>',
        '<p class="sk-result-note">Total grade points: ' + total.toFixed(2) +
          ' · 4th-subject bonus: +' + bonus.toFixed(2) +
          ' · ' + cfg.coreCount + ' core subjects</p>'
      ]);
    }

    groupEl.addEventListener('change', render);
    // Route through renderFourthOptions so lastFourth stays in sync;
    // calling renderFourthInputs directly would desync it and the next
    // core-subject edit would rebuild (and wipe) the 4th inputs.
    fourthEl.addEventListener('change', renderFourthOptions);
    $(cfg.calcId).addEventListener('click', function () { calculate(true); });
    $(cfg.resetId).addEventListener('click', render);
    subjectsEl.addEventListener('input', function () { calculate(false); });
    subjectsEl.addEventListener('change', function () {
      refreshPickers();
      renderFourthOptions();
      calculate(false);
    });
    fourthInputsEl.addEventListener('input', function () { calculate(false); });
    fourthInputsEl.addEventListener('change', function () { calculate(false); });
    render();
  }

  /* ---------- CGPA tool ----------
   * UGC 4.00 scale. Each course takes a letter grade OR a marks percentage.
   * Semester GPA = Σ(credit × grade point) / Σcredits.
   * Cumulative CGPA adds previous semesters the same way.
   */
  function cgpaTool(cfg) {
    var root = $(cfg.rootId);
    if (!root) return;
    var courses = [];
    var semesters = [];

    // No grade is preselected: the old A+ default made every new course
    // look already filled in. The first option is an empty placeholder.
    var gradeEl = $(cfg.gradeId);
    gradeEl.innerHTML = '<option value="">Select grade</option>' +
      UGC_GRADES.map(function (g) {
        return '<option value="' + g.value + '">' + g.label + '</option>';
      }).join('');

    var nameEl = $(cfg.nameId);
    var creditEl = $(cfg.creditId);
    var marksEl = $(cfg.marksId);
    var coursesEl = $(cfg.coursesId);
    var coursesEmptyEl = $(cfg.coursesEmptyId);
    var courseMsgEl = $(cfg.courseMsgId);
    var semNameEl = $(cfg.semNameId);
    var semGpaEl = $(cfg.semGpaId);
    var semCreditEl = $(cfg.semCreditId);
    var semestersEl = $(cfg.semestersId);
    var semMsgEl = $(cfg.semMsgId);
    var resultEl = $(cfg.resultId);
    var targetEl = $(cfg.targetId);
    var futureEl = $(cfg.futureId);
    var targetResultEl = $(cfg.targetResultId);

    gradeEl.addEventListener('change', function () { if (gradeEl.value !== '') marksEl.value = ''; });
    marksEl.addEventListener('input', function () {
      if (marksEl.value !== '') gradeEl.value = '';
      else gradeEl.value = ''; // marks cleared: no grade selected either
    });

    function semesterGpa() {
      var credits = courses.reduce(function (a, c) { return a + c.credit; }, 0);
      if (!credits) return null;
      var points = courses.reduce(function (a, c) { return a + c.credit * c.grade; }, 0);
      return { gpa: points / credits, credits: credits, points: points };
    }

    function cumulative() {
      var current = semesterGpa();
      var credits = semesters.reduce(function (a, s) { return a + s.credits; }, 0) + (current ? current.credits : 0);
      if (!credits) return null;
      var points = semesters.reduce(function (a, s) { return a + s.credits * s.gpa; }, 0) + (current ? current.points : 0);
      return { cgpa: points / credits, credits: credits, points: points };
    }

    function classOf(cgpa) {
      if (cgpa >= 3) return 'First Class';
      if (cgpa >= 2.25) return 'Second Class';
      if (cgpa >= 2) return 'Third Class';
      return 'Below Third Class';
    }

    function renderLists() {
      coursesEl.hidden = courses.length === 0;
      coursesEmptyEl.hidden = courses.length > 0;
      coursesEl.innerHTML = courses.map(function (c, i) {
        var label = UGC_GRADES.filter(function (g) { return g.value === c.grade; })[0];
        return '<li><span>' + esc(c.name) + '</span><span>' + c.credit + ' cr — ' +
          (label ? esc(label.label) : c.grade) +
          '</span><button type="button" class="sk-remove" data-course="' + i + '" aria-label="Remove course">&times;</button></li>';
      }).join('');

      semestersEl.hidden = semesters.length === 0;
      semestersEl.innerHTML = semesters.map(function (s, i) {
        return '<li><span>' + esc(s.name) + '</span><span>GPA ' + s.gpa.toFixed(2) + ' — ' + s.credits + ' cr' +
          '</span><button type="button" class="sk-remove" data-semester="' + i + '" aria-label="Remove semester">&times;</button></li>';
      }).join('');
    }

    function renderResult() {
      var current = semesterGpa();
      var cum = cumulative();
      if (!current && !cum) { resultEl.innerHTML = ''; renderTarget(); return; }
      var parts = [];
      if (current) {
        parts.push('<p class="sk-result-label">Semester GPA</p><p class="sk-result-value">' + current.gpa.toFixed(2) + '</p>');
      }
      if (cum) {
        parts.push('<p class="sk-result-note">Cumulative CGPA: <strong>' + cum.cgpa.toFixed(2) +
          '</strong> over ' + cum.credits + ' credits · ' + classOf(cum.cgpa) + '</p>');
      }
      showResult(resultEl, parts);
      renderTarget();
    }

    function renderTarget() {
      var target = parseFloat(targetEl.value);
      var future = parseFloat(futureEl.value);
      var cum = cumulative();
      if (isNaN(target) || isNaN(future) || future <= 0 || !cum) { targetResultEl.innerHTML = ''; return; }
      var needed = (target * (cum.credits + future) - cum.points) / future;
      var message;
      if (needed > 4) {
        message = 'A ' + target.toFixed(2) + ' CGPA is not reachable in the next ' + future +
          ' credits — you would need a ' + needed.toFixed(2) + ' GPA, above the 4.00 maximum.';
      } else if (needed <= 0) {
        message = 'You have already secured a ' + target.toFixed(2) + ' CGPA even if the remaining ' + future + ' credits go badly.';
      } else {
        message = 'You need an average GPA of <strong>' + needed.toFixed(2) + '</strong> over the next ' +
          future + ' credits to reach a ' + target.toFixed(2) + ' CGPA.';
      }
      targetResultEl.innerHTML = '<p class="sk-msg">' + message + '</p>';
    }

    $(cfg.addId).addEventListener('click', function () {
      var credit = parseFloat(creditEl.value);
      var grade;
      if (marksEl.value !== '') {
        var pct = parseFloat(marksEl.value);
        if (isNaN(pct) || pct < 0 || pct > 100) {
          courseMsgEl.textContent = 'Enter marks as a percentage between 0 and 100.';
          return;
        }
        grade = percentToUGC(pct);
      } else {
        grade = parseFloat(gradeEl.value);
      }
      if (isNaN(grade)) {
        courseMsgEl.textContent = 'Choose a grade or enter marks for the course.';
        return;
      }
      if (isNaN(credit) || credit <= 0) {
        courseMsgEl.textContent = 'Enter credit hours above 0 to add the course.';
        return;
      }
      courseMsgEl.textContent = '';
      courses.push({
        name: nameEl.value.trim() || 'Course ' + (courses.length + 1),
        credit: credit,
        grade: grade
      });
      nameEl.value = '';
      creditEl.value = '';
      marksEl.value = '';
      renderLists();
      renderResult();
    });

    $(cfg.semAddId).addEventListener('click', function () {
      var gpa = parseFloat(semGpaEl.value);
      var credits = parseFloat(semCreditEl.value);
      if (isNaN(gpa) || gpa < 0 || gpa > 4 || isNaN(credits) || credits <= 0) {
        semMsgEl.textContent = 'Enter a GPA (0–4) and credit hours above 0 to add the semester.';
        return;
      }
      semMsgEl.textContent = '';
      semesters.push({ name: semNameEl.value.trim() || 'Semester ' + (semesters.length + 1), gpa: gpa, credits: credits });
      semNameEl.value = '';
      semGpaEl.value = '';
      semCreditEl.value = '';
      renderLists();
      renderResult();
    });

    root.addEventListener('click', function (event) {
      var courseIndex = event.target.getAttribute && event.target.getAttribute('data-course');
      var semesterIndex = event.target.getAttribute && event.target.getAttribute('data-semester');
      if (courseIndex !== null && courseIndex !== undefined) { courses.splice(Number(courseIndex), 1); renderLists(); renderResult(); }
      if (semesterIndex !== null && semesterIndex !== undefined) { semesters.splice(Number(semesterIndex), 1); renderLists(); renderResult(); }
    });

    targetEl.addEventListener('input', renderTarget);
    futureEl.addEventListener('input', renderTarget);
    renderLists();
  }

  /* ---------- IELTS tool ----------
   * Raw Listening/Reading scores (0-40) convert to bands; Writing and
   * Speaking bands are entered directly. The overall band is the average
   * of the four, rounded by the official IELTS rule — and it is only
   * shown when all four modules are set (an unset module is not a zero).
   */
  function ieltsTool(cfg) {
    var root = $(cfg.rootId);
    if (!root) return;
    var module = 'academic';
    var listeningEl = $(cfg.listeningId);
    var readingEl = $(cfg.readingId);
    var listeningBandEl = $(cfg.listeningBandId);
    var readingBandEl = $(cfg.readingBandId);
    var writingEl = $(cfg.writingId);
    var speakingEl = $(cfg.speakingId);
    var resultEl = $(cfg.resultId);

    var bandOptions = ['<option value="0">Not set</option>'];
    for (var b = 0.5; b <= 9; b += 0.5) bandOptions.push('<option value="' + b + '">' + b.toFixed(1) + '</option>');
    writingEl.innerHTML = bandOptions.join('');
    speakingEl.innerHTML = bandOptions.join('');

    function update() {
      var listeningSet = listeningEl.value !== '';
      var readingSet = readingEl.value !== '';
      var listening = listeningSet ? ieltsRawToBand(parseInt(listeningEl.value, 10), 'listening', module) : null;
      var reading = readingSet ? ieltsRawToBand(parseInt(readingEl.value, 10), 'reading', module) : null;
      listeningBandEl.textContent = 'Band: ' + (listeningSet ? listening.toFixed(1) : '-');
      readingBandEl.textContent = 'Band: ' + (readingSet ? reading.toFixed(1) : '-');

      var writing = parseFloat(writingEl.value) || 0;
      var speaking = parseFloat(speakingEl.value) || 0;

      if (!listeningSet || !readingSet || writing === 0 || speaking === 0) {
        showHint(resultEl, 'Set all four modules — Listening, Reading, Writing and Speaking — to see your overall band.');
        return;
      }

      var overall = ieltsOverall(listening, reading, writing, speaking);
      var note = overall >= 8 ? 'Expert / Very Good user — outstanding.'
        : overall >= 7 ? 'Good user — competitive for top universities.'
        : overall >= 6 ? 'Competent user — meets most undergraduate requirements.'
        : 'Modest user — more practice needed.';

      showResult(resultEl, [
        '<p class="sk-result-label">Overall band score</p>',
        '<p class="sk-result-value">' + overall.toFixed(1) + '</p>',
        '<p class="sk-result-note">' + note + '</p>',
        '<p class="sk-result-note">L ' + listening.toFixed(1) + ' — R ' + reading.toFixed(1) +
          ' — W ' + writing.toFixed(1) + ' — S ' + speaking.toFixed(1) + '</p>'
      ]);
    }

    root.querySelectorAll('[data-module]').forEach(function (button) {
      button.addEventListener('click', function () {
        module = button.getAttribute('data-module');
        root.querySelectorAll('[data-module]').forEach(function (other) {
          other.setAttribute('aria-pressed', String(other === button));
        });
        update();
      });
    });

    [listeningEl, readingEl].forEach(function (el) { el.addEventListener('input', update); });
    [writingEl, speakingEl].forEach(function (el) { el.addEventListener('change', update); });
  }

  window.Calc = {
    gpaTool: gpaTool,
    cgpaTool: cgpaTool,
    ieltsTool: ieltsTool,
    marksToPoint5: marksToPoint5,
    percentToUGC: percentToUGC,
    ieltsRawToBand: ieltsRawToBand,
    ieltsOverall: ieltsOverall
  };
})();
