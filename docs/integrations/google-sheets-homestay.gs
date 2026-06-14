/**
 * MillionStay — Homestay Student Applications ⇄ Google Sheets sync.
 *
 * Real-time Sheets → DB: editing the `status` or `notes` cell of a row that has
 * a `request_ref` PATCHes the MillionStay External API. A menu action pulls the
 * latest list down to seed/refresh the sheet.
 *
 * Setup: see docs/integrations/google-sheets-homestay.md.
 * Credentials live in Script Properties: API_BASE, API_KEY, API_SECRET.
 */

// Only these columns push back to the DB. Header names must match the sheet.
var WRITABLE_COLUMNS = ['status', 'notes'];
var KEY_COLUMN = 'request_ref';

function props_() {
  return PropertiesService.getScriptProperties();
}

function headers_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function colIndex_(headers, name) {
  return headers.indexOf(name); // 0-based; -1 if missing
}

// ── Menu ──────────────────────────────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('MillionStay')
    .addItem('Pull latest', 'pullLatest')
    .addToUi();
}

// One-time: install the editable trigger (simple onEdit can't call UrlFetchApp).
function installTrigger() {
  var ss = SpreadsheetApp.getActive();
  // Avoid duplicates.
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'onEditInstallable') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onEditInstallable').forSpreadsheet(ss).onEdit().create();
  SpreadsheetApp.getActive().toast('Edit trigger installed.');
}

// ── Push: Sheets → DB ─────────────────────────────────────────────────────────
function onEditInstallable(e) {
  var sheet = e.range.getSheet();
  var row = e.range.getRow();
  if (row === 1) return; // header

  var headers = headers_(sheet);
  var editedCol = e.range.getColumn() - 1; // 0-based
  var editedHeader = headers[editedCol];
  if (WRITABLE_COLUMNS.indexOf(editedHeader) === -1) return; // PII / non-writable

  var refCol = colIndex_(headers, KEY_COLUMN);
  if (refCol === -1) return;
  var ref = String(sheet.getRange(row, refCol + 1).getValue()).trim();
  if (!ref) return; // no request_ref → ignore

  var payload = {};
  WRITABLE_COLUMNS.forEach(function (h) {
    var c = colIndex_(headers, h);
    if (c !== -1) {
      var v = sheet.getRange(row, c + 1).getValue();
      payload[h] = v === '' ? null : v;
    }
  });

  try {
    var resp = apiFetch_('/homestay-student-requests/by-ref/' + encodeURIComponent(ref), 'patch', payload);
    var code = resp.getResponseCode();
    if (code >= 200 && code < 300) {
      sheet.getRange(row, editedCol + 1).setNote('✓ synced ' + new Date().toLocaleString());
    } else {
      sheet.getRange(row, editedCol + 1).setNote('✗ ' + code + ': ' + resp.getContentText());
    }
  } catch (err) {
    sheet.getRange(row, editedCol + 1).setNote('✗ ' + err);
  }
}

// ── Pull: DB → Sheets (seed/refresh) ──────────────────────────────────────────
function pullLatest() {
  var resp = apiFetch_('/homestay-student-requests', 'get');
  if (resp.getResponseCode() !== 200) {
    SpreadsheetApp.getUi().alert('Pull failed: ' + resp.getContentText());
    return;
  }
  var rows = JSON.parse(resp.getContentText());
  if (!rows.length) {
    SpreadsheetApp.getActive().toast('No requests returned.');
    return;
  }
  var sheet = SpreadsheetApp.getActiveSheet();
  var cols = Object.keys(rows[0]);
  var values = [cols].concat(rows.map(function (r) {
    return cols.map(function (c) { return r[c] == null ? '' : r[c]; });
  }));
  sheet.clearContents();
  sheet.getRange(1, 1, values.length, cols.length).setValues(values);
  SpreadsheetApp.getActive().toast('Pulled ' + rows.length + ' requests.');
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
function apiFetch_(path, method, body) {
  var p = props_();
  var base = p.getProperty('API_BASE');
  var options = {
    method: method,
    muteHttpExceptions: true,
    contentType: 'application/json',
    headers: {
      'X-API-Key': p.getProperty('API_KEY'),
      'X-API-Secret': p.getProperty('API_SECRET'),
    },
  };
  if (body) options.payload = JSON.stringify(body);
  return UrlFetchApp.fetch(base + path, options);
}
