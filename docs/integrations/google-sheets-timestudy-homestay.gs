/**
 * MillionStay — Time Study (Homestay) form responses → MillionStay applications.
 *
 * Two-stage pipeline, runnable from the spreadsheet menu OR fully automated via
 * installable triggers:
 *   1. importTimeStudy()    — `Form Responses` → `MillionStay` tab. Rebuilds the
 *                             MillionStay tab from the raw form sheet, keeping
 *                             only rows whose PROGRAM & SERVICE LIST mentions a
 *                             homestay placement / settlement (airport pickup is
 *                             derived into its own column). Header aliases are
 *                             resolved via STRUCTURED so form wording changes are
 *                             absorbed in one place.
 *   2. pushToMillionStay()  — `MillionStay` tab → DB. POSTs each row to the
 *                             External API (`POST /api/ext/v1/homestay-student-requests`),
 *                             which creates a homestay_student_requests row with
 *                             status "Submitted", no e-sign / email side effects.
 *                             Idempotent via `external_ref`.
 *
 * Automation: installAutoSync() wires an onFormSubmit trigger (real-time) AND an
 * hourly time-based trigger (safety net), both calling syncAll() = import + push
 * under a LockService guard. Trigger contexts have no UI, so all user feedback
 * goes through alert_()/toast_() which fall back to Logger when getUi() throws.
 *
 * Setup: see docs/integrations/google-sheets-timestudy-homestay.md.
 * Credentials live in Script Properties: API_BASE, API_KEY, API_SECRET.
 */

var SRC_TAB = 'Form Responses';
var DEST_TAB = 'MillionStay';

var STRUCTURED = [
  ['TS Submission Date', ['Submission Date']],
  ['TS Service List', ['PROGRAM & SERVICE LIST']],
  ['Family name (surname)', ['Last Name']],
  ['Given name', ['First Name']],
  ['Other name', ['Other Name']],
  ['Date of birth', ['Date of Birth']],
  ['Gender', ['Sex']],
  ['Nationality', ['Nationality']],
  ['Email', ['Email']],
  ['Phone', ['Contact Number(in Australia)', 'Contact Number(Home country)']],
  ['Native language', []],
  ['English level', ['Current English level']],
  ['Visa type', ['Visa Type']],
  ['How did you hear about us?', ['Referral Source']],
  ['Messenger / SNS', ['SNS Type']],
  ['Messenger / SNS ID', ['SNS ID']],
  ['Relationship hoped with host', []],
  ['Additional comment', ['Note', 'Other enquiries']],
  ['Street address', ['Street Address']],
  ['Street address line 2', ['Street Address Line 2']],
  ['City', ['City']],
  ['State / Province', ['State / Province']],
  ['Postal / Zip code', ['Postal / Zip Code']],
  ['Country', ['Country']],
  ['School name', ['Institute']],
  ['Course name', ['Course(Program)']],
  ['Course start date', ['Start or Intake date', 'Preferred Starting Date']],
  ['Campus location', ['Campus(Location)']],
  ['Homestay start date', ['Homestay start date']],
  ['Duration (weeks)', ['Homestay duration(minium of 4 weeks)', 'Enrolment duration']],
  ['Room preference', ['Homestay Type']],
  ['Meals', []],
  ['Allergic to dogs/cats', ['Are you allergic to dogs/ cats?']],
  ['Can live with pets', ['Can you live with pets?']],
  ['Do you smoke', ['Do you smoke?']],
  ['Can live with smokers', ['Can you live with people who smoke?']],
  ['Can live with other students', ['Can you live with other students?']],
  ['Can live with children', ['Can you live with children in your homestay?']],
  ['Religious/cultural/personal beliefs', ['Do you have religious/cultural/personal beliefs that your homestay should know about?']],
  ['Allergies / special diet', ['Any known allergies, or special diet requirements:']],
  ['Food you do not eat', ['Any food that you do not eat:']],
  ['Hobbies', ['What are your hobbies?']],
  ['Other requirements', ['Other requirements:']],
  ['Self-introduction to host', ['Briefly Introduce yourself to your host family.']],
  ['Airport pickup required', ['Pickup Option']],
  ['Arrival date', ['Arrival date', 'Arrival Date']],
  ['Arrival time', ['Arrival time']],
  ['Flight no.', ['Flight Number']],
  ['Emergency contact name', ['Full Name(Emergency)']],
  ['Emergency contact relationship', ['Relationship']],
  ['Emergency contact number', ['Contact number(Emergency)']],
  ['Emergency contact email', []],
  ['Guardian service', []],
  ['Settlement support', []],
  ['Are you an agent or using an agent?', ['Are you an agent or use agent?']],
  ['Agent name', ['Agent Name:']],
  ['Staff name', ['Staff Name:']],
  ['Staff email address', ['Staff Email Address:']],
  ['Staff contact number', ['Staff Contact No:']],
];
var KEEP_EXTRAS = ['Are you in Australia?'];

// 실패 알림을 받을 주소(선택). 비워두면 메일 안 보냄.
var ALERT_EMAIL = '';

function onOpen() {
  SpreadsheetApp.getUi().createMenu('MillionStay')
    .addItem('1. Import Time Study (Homestay) responses', 'importTimeStudy')
    .addItem('2. Push to MillionStay (create applications)', 'pushToMillionStay')
    .addSeparator()
    .addItem('▶ Sync now (import + push)', 'syncAll')
    .addItem('Auto-sync 켜기 (폼 제출 시 + 1시간마다)', 'installAutoSync')
    .addItem('Auto-sync 끄기', 'removeAutoSync')
    .addToUi();
}
function onEditInstallable() {}
function norm(h) { return String(h).trim().toLowerCase(); }

// ── UI-safe helpers (트리거 컨텍스트에선 getUi()가 예외 → 로그로 폴백) ─────────
function alert_(msg) { try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); } }
function toast_(msg) { try { SpreadsheetApp.getActive().toast(msg); } catch (e) { Logger.log(msg); } }

function apiFetch_(path, method, body) {
  var p = PropertiesService.getScriptProperties();
  var options = {
    method: method, muteHttpExceptions: true, contentType: 'application/json',
    headers: { 'X-API-Key': p.getProperty('API_KEY'), 'X-API-Secret': p.getProperty('API_SECRET') },
  };
  if (body) options.payload = JSON.stringify(body);
  return UrlFetchApp.fetch(p.getProperty('API_BASE') + path, options);
}

// ════════════════════════════════════════════════════════════════════════════
//  자동 동기화 (트리거가 호출) — import + push 를 락으로 보호하며 순차 실행
// ════════════════════════════════════════════════════════════════════════════
function syncAll() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) { Logger.log('syncAll: 이미 실행 중 — 건너뜀'); return; }
  try {
    importTimeStudy();
    pushToMillionStay();
  } catch (e) {
    Logger.log('syncAll 실패: ' + e);
    if (ALERT_EMAIL) {
      try { MailApp.sendEmail(ALERT_EMAIL, 'MillionStay 자동 동기화 실패', String(e)); } catch (_) {}
    }
  } finally {
    lock.releaseLock();
  }
}

// 한 번만 실행: 폼 제출(실시간) + 1시간(안전망) 트리거 설치
function installAutoSync() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncAll') ScriptApp.deleteTrigger(t); // 중복 제거
  });
  var ss = SpreadsheetApp.getActive();
  ScriptApp.newTrigger('syncAll').forSpreadsheet(ss).onFormSubmit().create(); // 실시간
  ScriptApp.newTrigger('syncAll').timeBased().everyHours(1).create();          // 안전망
  toast_('Auto-sync 설치됨: 폼 제출 시 + 1시간마다');
}

function removeAutoSync() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncAll') { ScriptApp.deleteTrigger(t); n++; }
  });
  toast_('Auto-sync 제거됨 (' + n + '개 트리거)');
}

// ── Time Study → MillionStay sheet (rebuild) ──────────────────────────────────
function importTimeStudy() {
  var ss = SpreadsheetApp.getActive();
  var src = ss.getSheetByName(SRC_TAB);
  if (!src) { alert_('탭 없음: ' + SRC_TAB); return; }
  var dest = ss.getSheetByName(DEST_TAB) || ss.insertSheet(DEST_TAB);
  if (dest.getName() !== DEST_TAB) return;

  var rows = src.getDataRange().getDisplayValues();
  if (rows.length < 2) { toast_('소스 데이터 없음'); return; }
  var H = rows[0];
  var idx = {};
  for (var c = 0; c < H.length; c++) { var n = norm(H[c]); (idx[n] = idx[n] || []).push(c); }
  function valOf(row, cands) {
    for (var k = 0; k < cands.length; k++) {
      var list = idx[norm(cands[k])];
      if (list) for (var j = 0; j < list.length; j++) { var val = row[list[j]]; if (val !== '' && val != null) return val; }
    }
    return '';
  }
  var consumed = {};
  STRUCTURED.forEach(function (e) { e[1].forEach(function (h) { (idx[norm(h)] || []).forEach(function (c) { consumed[c] = true; }); }); });
  var extras = [];
  KEEP_EXTRAS.forEach(function (h) { (idx[norm(h)] || []).forEach(function (c) { if (!consumed[c]) { extras.push({ header: h, col: c }); consumed[c] = true; } }); });
  var destHeaders = STRUCTURED.map(function (e) { return e[0]; }).concat(extras.map(function (x) { return 'TS · ' + x.header; }));

  var out = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var service = String(valOf(r, ['PROGRAM & SERVICE LIST']));
    if (!/homestay placement/i.test(service) && !/settlement/i.test(service)) continue;
    var rowOut = STRUCTURED.map(function (e) {
      if (e[0] === 'Airport pickup required') { var p = valOf(r, e[1]); return p || (/airport pick/i.test(service) ? 'Yes' : ''); }
      if (e[0] === 'Settlement support') return /(settlement|local support|現地)/i.test(service) ? 'Yes' : '';
      return valOf(r, e[1]);
    });
    extras.forEach(function (x) { rowOut.push(r[x.col]); });
    out.push(rowOut);
  }
  dest.clearContents();
  dest.getRange(1, 1, 1, destHeaders.length).setValues([destHeaders]);
  if (out.length) dest.getRange(2, 1, out.length, destHeaders.length).setValues(out);
  toast_('Import 완료: ' + out.length + '행 · 필드 ' + destHeaders.length + '개');
}

// ── MillionStay sheet → DB (create Homestay Student Applications) ──────────────
function pushToMillionStay() {
  var ss = SpreadsheetApp.getActive();
  var dest = ss.getSheetByName(DEST_TAB);
  if (!dest) { alert_('탭 없음: ' + DEST_TAB); return; }
  var p = PropertiesService.getScriptProperties();
  if (!p.getProperty('API_BASE') || !p.getProperty('API_KEY') || !p.getProperty('API_SECRET')) {
    alert_('Script Properties에 API_BASE / API_KEY / API_SECRET 를 먼저 설정하세요.'); return;
  }
  var data = dest.getDataRange().getDisplayValues();
  if (data.length < 2) { toast_('보낼 행이 없습니다.'); return; }
  var H = data[0], col = {};
  for (var c = 0; c < H.length; c++) col[H[c]] = c;
  function g(row, name) { return col[name] != null ? String(row[col[name]] || '') : ''; }

  var created = 0, dup = 0, err = 0;
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    var first = g(r, 'Given name'), last = g(r, 'Family name (surname)');
    if (!first && !last) continue;
    var airport = g(r, 'Airport pickup required');
    // 멱등 키: 제출일 + 이메일 + 성명 (같은 날 복수 신청 충돌 방지)
    var externalRef = [g(r, 'TS Submission Date'), g(r, 'Email'), first, last]
      .filter(function (x) { return x; }).join('|');
    var payload = {
      external_ref: externalRef,
      student_first_name: first, student_last_name: last,
      student_email: g(r, 'Email'), student_phone: g(r, 'Phone'),
      date_of_birth: g(r, 'Date of birth'), gender: g(r, 'Gender'), nationality: g(r, 'Nationality'),
      preferences: {
        other_name: g(r, 'Other name'), native_language: g(r, 'Native language'),
        english_level: g(r, 'English level'), visa_type: g(r, 'Visa type'),
        referral_source: g(r, 'How did you hear about us?'),
        sns: { type: g(r, 'Messenger / SNS'), id: g(r, 'Messenger / SNS ID') },
        relationship_with_host: g(r, 'Relationship hoped with host'),
        additional_comment: g(r, 'Additional comment'),
        home_address: {
          street: g(r, 'Street address'), street2: g(r, 'Street address line 2'),
          city: g(r, 'City'), state: g(r, 'State / Province'),
          postcode: g(r, 'Postal / Zip code'), country: g(r, 'Country'),
        },
        school: g(r, 'School name'), course_name: g(r, 'Course name'),
        course_start_date: g(r, 'Course start date'), campus_location: g(r, 'Campus location'),
        homestay_start_date: g(r, 'Homestay start date'), duration_weeks: g(r, 'Duration (weeks)'),
        room_type: g(r, 'Room preference'), meals: g(r, 'Meals'),
        allergic_to_pets: g(r, 'Allergic to dogs/cats'), can_live_with_pets: g(r, 'Can live with pets'),
        smoker: g(r, 'Do you smoke'), can_live_with_smokers: g(r, 'Can live with smokers'),
        can_live_with_students: g(r, 'Can live with other students'), can_live_with_children: g(r, 'Can live with children'),
        beliefs: g(r, 'Religious/cultural/personal beliefs'), dietary: g(r, 'Allergies / special diet'),
        food_avoided: g(r, 'Food you do not eat'), hobbies: g(r, 'Hobbies'),
        other_requirements: g(r, 'Other requirements'), self_introduction: g(r, 'Self-introduction to host'),
        airport_pickup_option: airport, arrival_date: g(r, 'Arrival date'),
        arrival_time: g(r, 'Arrival time'), flight_no: g(r, 'Flight no.'),
        emergency_contact: {
          name: g(r, 'Emergency contact name'), relationship: g(r, 'Emergency contact relationship'),
          contact_no: g(r, 'Emergency contact number'), email: g(r, 'Emergency contact email'),
        },
        agent: {
          uses_agent: g(r, 'Are you an agent or using an agent?'), agent_name: g(r, 'Agent name'),
          staff_name: g(r, 'Staff name'), staff_email: g(r, 'Staff email address'), staff_contact: g(r, 'Staff contact number'),
        },
        service_list: g(r, 'TS Service List'),
        addons: {
          settlement_support: g(r, 'Settlement support') === 'Yes',
          guardian_service: g(r, 'Guardian service') === 'Yes',
          airport_pickup: airport !== '' && airport !== 'Not required',
        },
      },
    };
    try {
      var resp = apiFetch_('/homestay-student-requests', 'post', payload);
      var code = resp.getResponseCode();
      var body = JSON.parse(resp.getContentText() || '{}');
      var cell = dest.getRange(i + 1, 1);
      if (code === 201 && body.created) { created++; cell.setNote('✓ created ' + body.request_ref); }
      else if (body.duplicate) { dup++; cell.setNote('• exists ' + body.request_ref); }
      else { err++; cell.setNote('✗ ' + code + ': ' + resp.getContentText()); }
    } catch (e) { err++; dest.getRange(i + 1, 1).setNote('✗ ' + e); }
  }
  toast_('생성 ' + created + ' · 기존 ' + dup + ' · 오류 ' + err);
}
