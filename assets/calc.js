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
 * - Full marks in Marks mode (researched Nov 2026, board routines and
 *   marksheets): SSC Bangla and English are 200 each (two 100-mark
 *   papers), SSC ICT is 50, every other SSC subject is 100. HSC
 *   subjects are 200 each (two papers), HSC ICT is 100. Subject codes
 *   are the board codes from the marksheet (e.g. SSC Physics 136,
 *   HSC Physics 174/175). Physical Education (147) and Career
 *   Education (156) are continuous-assessment subjects at SSC and are
 *   not part of the 9-subject GPA.
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

  function gradeOptions(grades, selected) {
    return '<option value="">Select grade</option>' +
      grades.map(function (g) {
        return '<option value="' + g.value + '"' +
          (String(g.value) === String(selected) ? ' selected' : '') + '>' + g.label + '</option>';
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
   *   rootId, groupId, modeId, subjectsId, fourthId, fourthInputsId,
   *   calcId, resetId, resultId,
   *   coreCount: 9 (SSC) | 6 (HSC),
   *   marksMax: function (subject) -> full marks for marks mode,
   *   groups: { key: {
   *     fixed: [{ name, code, tag }],   // tag: 'Compulsory' or 'Group'
   *     pickers: [{ tag, def, fourth, options: [{ name, code }] }],
   *        // one row each; the subject itself is chosen from the list
   *        // (duplicates blocked). def is the default option's name;
   *        // without it the default is options[index]. fourth: false
   *        // keeps a picker (e.g. Religion) out of the 4th-subject list.
   *     fourthBase: [{ name, code }],  // extra 4th-subject options
   *     fourthFromPickers: true|false  // unpicked picker options join the 4th list
   *   } }
   * }
   * One input method at a time: a Grade/Marks toggle above the rows
   * shows only grade selects or only marks inputs. Switching keeps
   * everything already entered. Every row shows the board subject code
   * from the marksheet, and a Compulsory / Group / Optional tag, so the
   * difference between counted subjects and the 4th subject is visible.
   * The result updates live once every core row is filled.
   * Layout is the clean card style: the group tabs and the Grade/Marks
   * toggle sit side by side in one top row (stacked on phones). Subjects
   * render as rows in a bordered card, two boxes per row: the subject
   * name with its board code in small text underneath, and the grade or
   * marks input. No header row, no per-row tags. The 4th subject is one
   * row in its own card: a subject select beside the grade or marks
   * input, which shows "None" until a 4th subject is picked.
   */
  function gpaTool(cfg) {
    var root = $(cfg.rootId);
    if (!root) return;
    var groupEl = $(cfg.groupId);
    var modeEl = cfg.modeId ? $(cfg.modeId) : null;
    var subjectsEl = $(cfg.subjectsId);
    var fourthEl = $(cfg.fourthId);
    var fourthInputsEl = $(cfg.fourthInputsId);
    var resultEl = $(cfg.resultId);
    // What the tool calls its counted subjects (SSC: "core subject", HSC: "main subject").
    var subjectWord = cfg.subjectWord || 'core subject';
    var mode = 'grade'; // 'grade' | 'marks'
    var currentGroup = Object.keys(cfg.groups)[0]; // first group key is the default
    var values = {}; // subject name -> { grade: '', marks: '' }
    var pickerSel = {}; // picker index -> chosen subject name

    function group() { return cfg.groups[currentGroup]; }

    // Group tabs: one button per group, all visible at once, pressed state
    // on the current group. Labels come from cfg.groupLabels.
    function renderGroup() {
      var keys = Object.keys(cfg.groups);
      groupEl.innerHTML = keys.map(function (key) {
        var label = (cfg.groupLabels && cfg.groupLabels[key]) || key;
        return '<button type="button" data-group="' + esc(key) + '" aria-pressed="' +
          (key === currentGroup) + '">' + esc(label) + '</button>';
      }).join('');
    }

    function renderMode() {
      if (!modeEl) return;
      // No visible label: the two halves explain themselves.
      modeEl.innerHTML =
        '<div class="sk-segmented" role="group" aria-label="Input method">' +
        '<button type="button" data-mode="grade" aria-pressed="' + (mode === 'grade') + '">Grade</button>' +
        '<button type="button" data-mode="marks" aria-pressed="' + (mode === 'marks') + '">Marks</button>' +
        '</div>';
    }

    // One subject row's input: a grade select in Grade mode, a marks field
    // in Marks mode. The other method stays hidden, so the form never shows
    // two boxes per subject. No visible label: the select's "Select grade"
    // placeholder and the marks field's "Marks 0-N" placeholder say what
    // the box is, and the aria-label names the subject for screen readers.
    function inputHtml(subject, idSuffix) {
      var saved = values[subject.name] || { grade: '', marks: '' };
      var max = cfg.marksMax(subject);
      var ids = idSuffix ? ' id="' + cfg.rootId + idSuffix + '-grade"' : '';
      var idm = idSuffix ? ' id="' + cfg.rootId + idSuffix + '-marks"' : '';
      if (mode === 'marks') {
        return '<input type="number" class="sk-marks"' + idm + ' min="0" max="' + max + '" placeholder="Marks 0-' + max +
          '" aria-label="' + esc(subject.name) + ' marks" value="' + esc(saved.marks || '') + '">';
      }
      return '<select class="sk-grade"' + ids + ' aria-label="' + esc(subject.name) + ' grade">' +
        gradeOptions(BD5_GRADES, saved.grade || '') + '</select>';
    }

    // One subject row in the card: two boxes side by side. The subject box
    // shows the name with its board code in small text underneath (fixed
    // subjects), or is the subject picker itself (the options carry their
    // codes, e.g. "Biology (178/179)"). The second box is the single
    // input. No header row, no tags: the section heads carry the meaning.
    function rowHtml(kind, index, subject, pickerOptions, tag) {
      var box;
      if (kind === 'picker') {
        box = '<select class="sk-subject" data-picker="' + index + '" aria-label="Subject">' +
          pickerOptions.map(function (s) {
            return '<option value="' + esc(s.name) + '"' + (s.name === subject.name ? ' selected' : '') + '>' +
              esc(s.name) + (s.code ? ' (' + esc(s.code) + ')' : '') + '</option>';
          }).join('') + '</select>';
      } else {
        box = '<div class="sk-subject-box"><span class="sk-subject-name">' + esc(subject.name) + '</span>' +
          (subject.code ? '<span class="sk-code">' + esc(subject.code) + '</span>' : '') + '</div>';
      }
      var max = cfg.marksMax(subject);
      return '<div class="sk-row" data-subject="' + esc(subject.name) + '" data-max="' + max + '">' +
        box + '<div class="sk-inputs">' + inputHtml(subject) + '</div></div>';
    }

    function pickerValues() {
      return Array.prototype.slice.call(subjectsEl.querySelectorAll('[data-picker]'))
        .map(function (sel) { return sel.value; });
    }

    function pickerDefault(p, i) {
      if (p.def) return p.def;
      return (p.options[i] || p.options[0]).name;
    }

    // Remember what is on screen before a rebuild, so switching the
    // input method never wipes an entered grade, marks or subject choice.
    function saveState() {
      subjectsEl.querySelectorAll('[data-picker]').forEach(function (sel) {
        pickerSel[Number(sel.getAttribute('data-picker'))] = sel.value;
      });
      subjectsEl.querySelectorAll('.sk-row').forEach(function (row) {
        var name = row.getAttribute('data-subject');
        var gradeEl = row.querySelector('.sk-grade');
        var marksEl = row.querySelector('.sk-marks');
        var prev = values[name] || { grade: '', marks: '' };
        values[name] = {
          grade: gradeEl ? gradeEl.value : prev.grade,
          marks: marksEl ? marksEl.value : prev.marks
        };
      });
      var fourthRow = fourthInputsEl.querySelector('.sk-row');
      if (fourthRow) {
        var fname = fourthRow.getAttribute('data-subject');
        var fgradeEl = fourthRow.querySelector('.sk-grade');
        var fmarksEl = fourthRow.querySelector('.sk-marks');
        var fprev = values[fname] || { grade: '', marks: '' };
        values[fname] = {
          grade: fgradeEl ? fgradeEl.value : fprev.grade,
          marks: fmarksEl ? fmarksEl.value : fprev.marks
        };
      }
    }

    // Rebuild picker options so no subject can be chosen twice.
    function refreshPickers() {
      var chosen = pickerValues();
      subjectsEl.querySelectorAll('[data-picker]').forEach(function (sel) {
        var idx = Number(sel.getAttribute('data-picker'));
        var options = group().pickers[idx].options;
        var current = sel.value;
        sel.innerHTML = options
          .filter(function (s) { return s.name === current || chosen.indexOf(s.name) === -1; })
          .map(function (s) {
            return '<option value="' + esc(s.name) + '"' + (s.name === current ? ' selected' : '') + '>' +
              esc(s.name) + (s.code ? ' (' + esc(s.code) + ')' : '') + '</option>';
          }).join('');
        sel.closest('.sk-row').setAttribute('data-subject', current);
        var row = sel.closest('.sk-row');
        var currentSubject = options.filter(function (s) { return s.name === current; })[0];
        if (currentSubject) {
          row.setAttribute('data-max', cfg.marksMax(currentSubject));
          var marksEl = row.querySelector('.sk-marks');
          if (marksEl) marksEl.setAttribute('max', cfg.marksMax(currentSubject));
        }
      });
    }

    function fourthOptions() {
      var g = group();
      var opts = (g.fourthBase || []).slice();
      if (g.fourthFromPickers) {
        var chosen = pickerValues();
        g.pickers.forEach(function (p) {
          if (p.fourth === false) return;
          p.options.forEach(function (s) {
            if (chosen.indexOf(s.name) === -1 && opts.every(function (o) { return o.name !== s.name; })) opts.push(s);
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
          return '<option value="' + esc(s.name) + '"' + (s.name === current ? ' selected' : '') + '>' +
            esc(s.name) + (s.code ? ' (' + esc(s.code) + ')' : '') + '</option>';
        }).join('');
      if (fourthOptions().every(function (s) { return s.name !== current; })) fourthEl.value = '';
      // Only rebuild the 4th-subject inputs when the subject actually
      // changed — otherwise a core-subject edit would wipe the 4th grade.
      if (fourthEl.value !== lastFourth) {
        lastFourth = fourthEl.value;
        renderFourthInputs();
      }
    }

    // The 4th-subject row lives in a static shell in the page HTML: one
    // row in its own card, the subject select beside the grade or marks
    // input. This fills only the input box. Until a 4th subject is picked
    // the input shows "None", disabled, so the row is complete from the
    // start instead of appearing and disappearing.
    function renderFourthInputs() {
      var box = fourthInputsEl.querySelector('.sk-inputs');
      if (!box) return;
      var row = fourthInputsEl.querySelector('.sk-row');
      if (!fourthEl.value) {
        row.setAttribute('data-subject', '');
        row.setAttribute('data-max', '100');
        box.innerHTML = mode === 'marks'
          ? '<input type="number" class="sk-marks" disabled placeholder="—" aria-label="4th subject marks">'
          : '<select class="sk-grade" disabled aria-label="4th subject grade"><option value="">None</option></select>';
        return;
      }
      var subject = fourthOptions().filter(function (s) { return s.name === fourthEl.value; })[0];
      if (!subject) {
        row.setAttribute('data-subject', '');
        row.setAttribute('data-max', '100');
        box.innerHTML = '';
        return;
      }
      var max = cfg.marksMax(subject);
      row.setAttribute('data-subject', subject.name);
      row.setAttribute('data-max', max);
      box.innerHTML = inputHtml(subject, '-opt');
      wireRow(row);
    }

    function wireRow(row) {
      var sel = row.querySelector('.sk-grade');
      var inp = row.querySelector('.sk-marks');
      var name = row.getAttribute('data-subject');
      function save() {
        var prev = values[name] || { grade: '', marks: '' };
        values[name] = {
          grade: sel ? sel.value : prev.grade,
          marks: inp ? inp.value : prev.marks
        };
      }
      if (sel) sel.addEventListener('change', save);
      if (inp) inp.addEventListener('input', save);
    }

    function renderRows() {
      var g = group();
      var html = '';
      g.fixed.forEach(function (s) { html += rowHtml('fixed', 0, s, null, s.tag); });
      (g.pickers || []).forEach(function (p, i) {
        var current = pickerSel[i] || pickerDefault(p, i);
        var subject = p.options.filter(function (s) { return s.name === current; })[0] || p.options[0];
        html += rowHtml('picker', i, subject, p.options, p.tag);
      });
      subjectsEl.innerHTML = html;
      subjectsEl.querySelectorAll('.sk-row').forEach(wireRow);
      refreshPickers();
    }

    function render(resetForm) {
      renderRows();
      if (resetForm) {
        fourthEl.value = '';
        // Force renderFourthOptions to rebuild the 4th row into its None
        // state; the row shell itself stays in the page.
        lastFourth = null;
      }
      renderFourthOptions();
      resultEl.innerHTML = '';
    }

    // null = not entered yet. An empty field is never a grade — and never an F.
    function pointOf(row) {
      var gradeEl = row.querySelector('.sk-grade');
      var marksEl = row.querySelector('.sk-marks');
      if (gradeEl && gradeEl.value !== '') return parseFloat(gradeEl.value);
      if (marksEl && marksEl.value !== '') {
        var marks = parseFloat(marksEl.value);
        if (isNaN(marks)) return null;
        var max = parseFloat(row.getAttribute('data-max')) || 100;
        return marksToPoint5(marks / (max / 100));
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
      var failedNames = rows.filter(function (row, i) { return points[i] === 0; })
        .map(function (row) { return row.getAttribute('data-subject'); });
      var failed = failedNames.length > 0;
      var total = points.reduce(function (a, b) { return a + b; }, 0);
      var bonus = 0;
      if (fourthEl.value) {
        var fourthRow = fourthInputsEl.querySelector('.sk-row');
        var optPoint = fourthRow ? pointOf(fourthRow) : null;
        if (optPoint !== null) bonus = Math.max(0, optPoint - 2);
      }
      var gpa = Math.min((total + bonus) / cfg.coreCount, failed ? 0 : 5);
      var status = failed
        ? '<span class="sk-bad">Failed — F in ' + failedNames.map(esc).join(', ') + '</span>'
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

    groupEl.addEventListener('click', function (event) {
      var button = event.target.closest ? event.target.closest('[data-group]') : null;
      if (!button || button.getAttribute('data-group') === currentGroup) return;
      currentGroup = button.getAttribute('data-group');
      values = {}; pickerSel = {};
      renderGroup();
      render(true);
    });
    // Route through renderFourthOptions so lastFourth stays in sync;
    // calling renderFourthInputs directly would desync it and the next
    // core-subject edit would rebuild (and wipe) the 4th inputs.
    fourthEl.addEventListener('change', renderFourthOptions);
    $(cfg.calcId).addEventListener('click', function () { calculate(true); });
    $(cfg.resetId).addEventListener('click', function () {
      values = {}; pickerSel = {}; mode = 'grade';
      renderMode();
      render(true);
    });
    subjectsEl.addEventListener('input', function () { calculate(false); });
    subjectsEl.addEventListener('change', function () {
      refreshPickers();
      renderFourthOptions();
      calculate(false);
    });
    fourthInputsEl.addEventListener('input', function () { calculate(false); });
    fourthInputsEl.addEventListener('change', function () { calculate(false); });
    if (modeEl) {
      modeEl.addEventListener('click', function (event) {
        var button = event.target.closest ? event.target.closest('[data-mode]') : null;
        if (!button || button.getAttribute('data-mode') === mode) return;
        saveState();
        mode = button.getAttribute('data-mode');
        renderMode();
        renderRows();
        renderFourthInputs();
        calculate(false);
      });
    }
    renderGroup();
    renderMode();
    render(true);
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
