/**
 * ============================================================================
 * ZERO-COST JOB APPLICATION AUTOMATION SYSTEM — v3.4 Final All-in-One
 * ============================================================================
 * Stack: Google Sheets + Google Apps Script + Gemini API (Free Tier)
 *
 * SAFETY & PRIVACY GUARANTEES:
 *  1. DRAFTS-ONLY: Never auto-sends emails (uses GmailApp.createDraft / createDraftReply).
 *  2. ACCOUNT LOCK: Verifies active Gmail user matches Settings!B2 before any action.
 *  3. KEY ISOLATION: Stores Gemini API key in Script Properties (never in cells/code).
 *  4. ZERO HARDCODED CLIENT DATA: Reads all config & profile data from sheet tabs.
 *
 * REQUIRED TABS:
 *  - Settings
 *  - Client Profile
 *  - Email Jobs
 *  - Portal Jobs
 *  - Portal Apply Kits (auto-created on first run)
 *  - Summary
 * ============================================================================
 */

const CONFIG = {
  TABS: {
    SETTINGS: 'Settings',
    PROFILE: 'Client Profile',
    EMAIL_JOBS: 'Email Jobs',
    PORTAL_JOBS: 'Portal Jobs',
    PORTAL_KITS: 'Portal Apply Kits',
    SUMMARY: 'Summary'
  },
  PROP_API_KEY: 'GEMINI_API_KEY',
  DEFAULT_MODEL: 'gemini-3.5-flash-lite',
  DEFAULT_PAUSE_MS: 4500,
  DEFAULT_FOLLOWUP_DAYS: 7,
  DEFAULT_COVER_LETTER_FOLDER: 'Portal Cover Letters',
  KITS_ROW_HEIGHT_PX: 36,
  BATCH_LIMIT: 5
};

// ----------------------------------------------------------------------------
// 1. CUSTOM MENU
// ----------------------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Job Automation')
    .addItem('1. Set Gemini API Key', 'setGeminiApiKey')
    .addSeparator()
    .addItem('2. Draft Next 5 Email Applications', 'draftNext5EmailApplications')
    .addItem('3. Test 1 Email Draft Only', 'test1EmailDraftOnly')
    .addSeparator()
    .addItem('4. Sync Gmail Replies, Sent & Follow-ups Now', 'syncAllJobsManual')
    .addItem('5. Draft Due Follow-up Emails', 'draftDueFollowUps')
    .addItem('6. Install / Reset Hourly Auto-Sync Trigger', 'installHourlyTrigger')
    .addSeparator()
    .addItem('7. Generate Portal Apply Kits (Next 5)', 'generateNext5PortalApplyKits')
    .addItem('8. Test 1 Portal Apply Kit Only', 'test1PortalApplyKitOnly')
    .addItem('9. Check Expired / Closed Job Links', 'checkExpiredJobLinks')
    .addToUi();
}

// ----------------------------------------------------------------------------
// 2. MENU ENTRYPOINTS
// ----------------------------------------------------------------------------

function setGeminiApiKey() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Set Gemini API Key',
    'Paste your free Google AI Studio Gemini API key (stored privately in Script Properties):',
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) return;

  const key = (response.getResponseText() || '').trim();
  if (!key) {
    ui.alert('No API key entered. Nothing was changed.');
    return;
  }
  PropertiesService.getScriptProperties().setProperty(CONFIG.PROP_API_KEY, key);
  ui.alert('Gemini API key saved securely in Script Properties.');
}

function draftNext5EmailApplications() {
  draftEmailApplications_(CONFIG.BATCH_LIMIT, true);
}

function test1EmailDraftOnly() {
  draftEmailApplications_(1, true);
}

function syncAllJobsManual() {
  syncAllJobs(true);
}

function generateNext5PortalApplyKits() {
  generatePortalApplyKits_(CONFIG.BATCH_LIMIT, true);
}

function test1PortalApplyKitOnly() {
  generatePortalApplyKits_(1, true);
}

function installHourlyTrigger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settings = loadSettings_(ss);
  if (!verifyAccountLock_(settings, true)) return;

  const existing = ScriptApp.getProjectTriggers();
  existing.forEach(t => {
    if (t.getHandlerFunction() === 'syncAllJobs') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('syncAllJobs')
    .timeBased()
    .everyHours(1)
    .create();

  SpreadsheetApp.getUi().alert(
    'Hourly Auto-Sync Trigger installed.\n\nsyncAllJobs() will run every hour when Settings!B8 is TRUE.'
  );
}

// ----------------------------------------------------------------------------
// 3. SETTINGS, PROFILE & ACCOUNT SAFETY LOCK
// ----------------------------------------------------------------------------

function loadSettings_(ss) {
  const sheet = ss.getSheetByName(CONFIG.TABS.SETTINGS);
  if (!sheet) throw new Error('Missing required tab: Settings');

  const vals = sheet.getRange('A1:B25').getValues();
  const getVal = row1Based => (vals[row1Based - 1] && vals[row1Based - 1][1] !== undefined)
    ? String(vals[row1Based - 1][1]).trim()
    : '';

  const docMap = {};
  for (let r = 11; r <= 18; r++) { // Rows 12..19 (0-based 11..18)
    const keyword = vals[r] && vals[r][0] ? String(vals[r][0]).trim().toLowerCase() : '';
    const fileName = vals[r] && vals[r][1] ? String(vals[r][1]).trim() : '';
    if (keyword && fileName) {
      docMap[keyword] = fileName;
    }
  }

  return {
    allowedEmail: getVal(2).toLowerCase(),
    driveFolderId: extractDriveFolderId_(getVal(3)),
    defaultCvFile: getVal(4) || 'CV.pdf',
    geminiModel: getVal(5) || CONFIG.DEFAULT_MODEL,
    apiPauseMs: parseInt(getVal(6), 10) || CONFIG.DEFAULT_PAUSE_MS,
    followupDays: parseInt(getVal(7), 10) || CONFIG.DEFAULT_FOLLOWUP_DAYS,
    hourlyEnabled: getVal(8).toUpperCase() !== 'FALSE',
    coverLetterSubfolder: getVal(9) || CONFIG.DEFAULT_COVER_LETTER_FOLDER,
    docMap: docMap
  };
}

function loadClientProfile_(ss) {
  const sheet = ss.getSheetByName(CONFIG.TABS.PROFILE);
  if (!sheet) throw new Error('Missing required tab: Client Profile');

  const vals = sheet.getRange('B2:B6').getValues();
  return {
    fullName: String(vals[0][0] || '').trim(),
    targetRoles: String(vals[1][0] || '').trim(),
    targetCountries: String(vals[2][0] || '').trim(),
    emailSignature: String(vals[3][0] || '').trim(),
    cvText: String(vals[4][0] || '').trim()
  };
}

function verifyAccountLock_(settings, showUiAlert) {
  const activeEmail = (Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (!settings.allowedEmail) {
    const msg = 'Account Safety Lock Error: Please set Allowed Gmail Account in Settings!B2.';
    if (showUiAlert) SpreadsheetApp.getUi().alert(msg);
    Logger.log(msg);
    return false;
  }
  if (activeEmail && activeEmail !== settings.allowedEmail) {
    const msg =
      'ACCOUNT SAFETY LOCK TRIGGERED!\n\n' +
      'Active Gmail: ' + activeEmail + '\n' +
      'Allowed Gmail (Settings!B2): ' + settings.allowedEmail + '\n\n' +
      'Execution aborted to prevent drafting from the wrong account.';
    if (showUiAlert) SpreadsheetApp.getUi().alert(msg);
    Logger.log(msg);
    return false;
  }
  return true;
}

function extractDriveFolderId_(input) {
  if (!input) return '';
  const match = input.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];
  const idMatch = input.match(/[a-zA-Z0-9_-]{20,}/);
  return idMatch ? idMatch[0] : input;
}

function findFileInFolder_(folderId, fileName) {
  if (!folderId || !fileName) return null;
  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFilesByName(fileName);
  if (files.hasNext()) return files.next();

  // Case-insensitive fallback scan inside the folder
  const all = folder.getFiles();
  const target = fileName.toLowerCase();
  while (all.hasNext()) {
    const f = all.next();
    if (f.getName().toLowerCase() === target) return f;
  }
  return null;
}

function getOrCreateSubfolder_(parentFolderId, subfolderName) {
  const parent = DriveApp.getFolderById(parentFolderId);
  const existing = parent.getFoldersByName(subfolderName);
  if (existing.hasNext()) return existing.next();
  return parent.createFolder(subfolderName);
}

// ----------------------------------------------------------------------------
// 4. GEMINI API CLIENT (FREE TIER, RETRY ON 429, NO DEPRECATED PARAMS)
// ----------------------------------------------------------------------------

function callGemini_(promptText, settings, expectJson) {
  const apiKey = PropertiesService.getScriptProperties().getProperty(CONFIG.PROP_API_KEY);
  if (!apiKey) {
    throw new Error('Gemini API key not set. Run "Job Automation -> 1. Set Gemini API Key" first.');
  }

  const model = settings.geminiModel || CONFIG.DEFAULT_MODEL;
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(apiKey);

  const payload = {
    contents: [{ parts: [{ text: promptText }] }]
  };
  if (expectJson) {
    payload.generationConfig = { responseMimeType: 'application/json' };
  }

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = UrlFetchApp.fetch(url, options);
    const code = res.getResponseCode();
    const body = res.getContentText();

    if (code === 200) {
      const parsed = JSON.parse(body);
      const text = parsed &&
        parsed.candidates &&
        parsed.candidates[0] &&
        parsed.candidates[0].content &&
        parsed.candidates[0].content.parts &&
        parsed.candidates[0].content.parts[0] &&
        parsed.candidates[0].content.parts[0].text;
      if (!text) throw new Error('Gemini returned empty text response.');
      return text.trim();
    }

    if (code === 429 || code >= 500) {
      const waitMs = Math.pow(2, attempt) * 2000;
      Logger.log('Gemini HTTP ' + code + ' on attempt ' + attempt + '. Waiting ' + waitMs + 'ms...');
      Utilities.sleep(waitMs);
      continue;
    }

    throw new Error('Gemini API error HTTP ' + code + ': ' + body.slice(0, 300));
  }

  throw new Error('Gemini API failed after ' + maxAttempts + ' attempts (rate limit or server error).');
}

function parseJsonSafe_(rawText) {
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(cleaned);
}

// ----------------------------------------------------------------------------
// 5. DIRECT EMAIL APPLICATION DRAFTER (DRAFTS ONLY)
// ----------------------------------------------------------------------------

function draftEmailApplications_(limit, showUiAlert) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settings = loadSettings_(ss);
  if (!verifyAccountLock_(settings, showUiAlert)) return;

  const profile = loadClientProfile_(ss);
  const sheet = ss.getSheetByName(CONFIG.TABS.EMAIL_JOBS);
  if (!sheet) throw new Error('Missing required tab: Email Jobs');

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    if (showUiAlert) SpreadsheetApp.getUi().alert('No rows found in Email Jobs.');
    return;
  }

  const data = sheet.getRange(2, 1, lastRow - 1, 21).getValues();
  const seenKeys = new Set();

  // Index already drafted/sent rows to prevent duplicate applications
  data.forEach(row => {
    const status = String(row[15] || '').trim().toLowerCase(); // Col P
    if (status && status !== 'to apply') {
      const emailKey = (String(row[4] || '').trim().toLowerCase() + '|' + String(row[2] || '').trim().toLowerCase());
      const linkKey = String(row[8] || '').trim().toLowerCase();
      if (emailKey !== '|') seenKeys.add(emailKey);
      if (linkKey) seenKeys.add(linkKey);
    }
  });

  let draftedCount = 0;
  let skippedCount = 0;
  const errors = [];

  for (let i = 0; i < data.length && draftedCount < limit; i++) {
    const row = data[i];
    const rowNum = i + 2;
    const company = String(row[1] || '').trim();
    const roleTitle = String(row[2] || '').trim();
    const location = String(row[3] || '').trim();
    const employerEmail = String(row[4] || '').trim();
    const contactName = String(row[5] || '').trim();
    const visaNote = String(row[6] || '').trim();
    const closingDate = row[7];
    const jobLink = String(row[8] || '').trim();
    const jobNotes = String(row[9] || '').trim();
    const cvOverride = String(row[10] || '').trim();
    const status = String(row[15] || '').trim();

    if (status.toLowerCase() !== 'to apply') continue;
    if (!employerEmail || !company || !roleTitle) {
      skippedCount++;
      continue;
    }

    // Skip expired closing date
    if (isDateInPast_(closingDate)) {
      sheet.getRange(rowNum, 16).setValue('Closed');
      skippedCount++;
      continue;
    }

    // Duplicate check
    const emailKey = employerEmail.toLowerCase() + '|' + roleTitle.toLowerCase();
    const linkKey = jobLink.toLowerCase();
    if (seenKeys.has(emailKey) || (linkKey && seenKeys.has(linkKey))) {
      skippedCount++;
      continue;
    }

    try {
      const prompt = [
        'You are writing a concise, professional direct-email job application on behalf of a candidate.',
        'STRICT RULES:',
        '- Use ONLY facts verified in the Candidate Profile below. Never fabricate credentials, licenses, languages, or dates.',
        '- Keep the body crisp (150-210 words), natural, and tailored to the role and employer.',
        '- Do NOT include a signature block at the end (it will be appended automatically).',
        '- Return valid JSON with keys: "subject" and "body".',
        '',
        'CANDIDATE PROFILE:',
        'Name: ' + profile.fullName,
        'Target Roles: ' + profile.targetRoles,
        'Target Countries & Visa: ' + profile.targetCountries,
        profile.cvText,
        '',
        'JOB DETAILS:',
        'Company: ' + company,
        'Role Title: ' + roleTitle,
        'Location: ' + location,
        'Contact Name: ' + (contactName || 'Hiring Team'),
        'Visa/Sponsorship Note: ' + visaNote,
        'Job Description / Notes: ' + jobNotes
      ].join('\n');

      const raw = callGemini_(prompt, settings, true);
      const parsed = parseJsonSafe_(raw);
      const subject = String(parsed.subject || ('Application: ' + roleTitle + ' — ' + profile.fullName)).trim();
      let body = String(parsed.body || '').trim();
      if (profile.emailSignature) {
        body += '\n\n' + profile.emailSignature;
      }

      const cvFileName = cvOverride || settings.defaultCvFile;
      const cvFile = findFileInFolder_(settings.driveFolderId, cvFileName);
      const draftOptions = {};
      if (cvFile) {
        draftOptions.attachments = [cvFile.getBlob()];
      }

      // DRAFTS-ONLY: Never auto-send
      const draft = GmailApp.createDraft(employerEmail, subject, body, draftOptions);

      sheet.getRange(rowNum, 12).setValue(subject);                 // Col L: Subject Line
      sheet.getRange(rowNum, 13).setValue(formatDateYMD_(new Date())); // Col M: Date Drafted
      sheet.getRange(rowNum, 16).setValue('Drafted');               // Col P: Status
      sheet.getRange(rowNum, 17).setValue(draft.getId());           // Col Q: Gmail Draft ID

      seenKeys.add(emailKey);
      if (linkKey) seenKeys.add(linkKey);
      draftedCount++;

      if (draftedCount < limit) Utilities.sleep(settings.apiPauseMs);
    } catch (err) {
      errors.push('Row ' + rowNum + ' (' + company + '): ' + err.message);
    }
  }

  if (showUiAlert) {
    let summary = 'Email Drafting Complete (Drafts Only).\n\n' +
      'Drafts created: ' + draftedCount + '\n' +
      'Skipped / closed / duplicates: ' + skippedCount;
    if (errors.length) summary += '\n\nErrors:\n- ' + errors.join('\n- ');
    SpreadsheetApp.getUi().alert(summary);
  }
}

// ----------------------------------------------------------------------------
// 6. PORTAL APPLY KITS (OPTION 2 — COVER LETTER PDF + 3 ANSWERS + 36PX COMPACT)
// ----------------------------------------------------------------------------

function generatePortalApplyKits_(limit, showUiAlert) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settings = loadSettings_(ss);
  if (!verifyAccountLock_(settings, showUiAlert)) return;

  const profile = loadClientProfile_(ss);
  const portalSheet = ss.getSheetByName(CONFIG.TABS.PORTAL_JOBS);
  if (!portalSheet) throw new Error('Missing required tab: Portal Jobs');

  const kitsSheet = ensurePortalKitsSheet_(ss);
  const lastRow = portalSheet.getLastRow();
  if (lastRow < 2) {
    if (showUiAlert) SpreadsheetApp.getUi().alert('No rows found in Portal Jobs.');
    return;
  }

  const data = portalSheet.getRange(2, 1, lastRow - 1, 26).getValues();
  const clFolder = settings.driveFolderId
    ? getOrCreateSubfolder_(settings.driveFolderId, settings.coverLetterSubfolder)
    : null;

  let createdCount = 0;
  let closedCount = 0;
  const errors = [];

  for (let i = 0; i < data.length && createdCount < limit; i++) {
    const row = data[i];
    const rowNum = i + 2;
    const jobId = String(row[0] || ('P-' + rowNum)).trim();
    const company = String(row[1] || '').trim();
    const roleTitle = String(row[2] || '').trim();
    const status = String(row[3] || '').trim();         // Col D
    const location = String(row[4] || '').trim();
    const visaNote = String(row[6] || '').trim();
    const closingDate = row[7];                          // Col H
    const jobLink = String(row[8] || '').trim();         // Col I
    const jobNotes = String(row[10] || '').trim();       // Col K
    const kitGenerated = String(row[13] || '').trim();   // Col N

    if (status.toLowerCase() !== 'to apply') continue;
    if (kitGenerated.toUpperCase() === 'YES') continue;
    if (!company || !roleTitle) continue;

    // Zero-cost pre-check for expired closing date or dead/closed URL
    const closedCheck = isJobLinkClosed_(jobLink, closingDate);
    if (closedCheck.closed) {
      portalSheet.getRange(rowNum, 4).setValue('Closed'); // Col D
      portalSheet.getRange(rowNum, 24).setValue('Auto-closed: ' + closedCheck.reason); // Col X
      portalSheet.getRange(rowNum, 25).setValue(formatDateYMD_(new Date()));           // Col Y
      closedCount++;
      continue;
    }

    try {
      const prompt = [
        'You are preparing a Portal Application Kit for an ATS/career-portal application.',
        'STRICT RULES:',
        '- Use ONLY facts verified in the Candidate Profile below. Never fabricate degrees, licenses, scores, or dates.',
        '- Return valid JSON with exact keys:',
        '  "coverLetter" (professional 220-280 word tailored cover letter, plain text with clean paragraph breaks),',
        '  "answerWhyRole" (70-110 words: why this role and company),',
        '  "answerRelocation" (50-80 words: relocation readiness & honest work-authorization/sponsorship answer),',
        '  "answerExperience" (80-120 words: most relevant verified experience & key achievements).',
        '',
        'CANDIDATE PROFILE:',
        'Name: ' + profile.fullName,
        'Target Roles: ' + profile.targetRoles,
        'Target Countries & Visa: ' + profile.targetCountries,
        profile.cvText,
        '',
        'JOB DETAILS:',
        'Company: ' + company,
        'Role Title: ' + roleTitle,
        'Location: ' + location,
        'Visa/Sponsorship Note: ' + visaNote,
        'Job Description / Notes: ' + jobNotes
      ].join('\n');

      const raw = callGemini_(prompt, settings, true);
      const parsed = parseJsonSafe_(raw);

      const coverLetter = String(parsed.coverLetter || '').trim();
      const answerWhy = String(parsed.answerWhyRole || '').trim();
      const answerReloc = String(parsed.answerRelocation || '').trim();
      const answerExp = String(parsed.answerExperience || '').trim();

      let pdfUrl = '';
      if (clFolder && coverLetter) {
        pdfUrl = createCoverLetterPdf_(clFolder, profile.fullName, company, roleTitle, coverLetter);
      }

      const newRowIdx = kitsSheet.getLastRow() + 1;
      const jobLinkFormula = jobLink
        ? '=HYPERLINK("' + escapeFormulaStr_(jobLink) + '", "Open Job Portal")'
        : 'No Link';
      const pdfFormula = pdfUrl
        ? '=HYPERLINK("' + escapeFormulaStr_(pdfUrl) + '", "Open Cover Letter PDF")'
        : 'Not Saved';

      kitsSheet.getRange(newRowIdx, 1, 1, 10).setValues([[
        jobId,
        company,
        roleTitle,
        jobLinkFormula,
        pdfFormula,
        coverLetter,
        answerWhy,
        answerReloc,
        answerExp,
        formatDateYMD_(new Date())
      ]]);

      portalSheet.getRange(rowNum, 14).setValue('YES');                         // Col N: Kit Generated
      if (pdfUrl) portalSheet.getRange(rowNum, 15).setValue(pdfUrl);            // Col O: Cover Letter PDF Link
      portalSheet.getRange(rowNum, 16).setValue(formatDateYMD_(new Date()));    // Col P: Kit Generated Date

      createdCount++;
      if (createdCount < limit) Utilities.sleep(settings.apiPauseMs);
    } catch (err) {
      errors.push('Row ' + rowNum + ' (' + company + '): ' + err.message);
    }
  }

  // Permanently force compact 36px rows (prevents \n cover letters from stretching rows)
  compactPortalKitsLayout_(ss);

  if (showUiAlert) {
    let msg = 'Portal Apply Kits Complete.\n\n' +
      'Kits generated: ' + createdCount + '\n' +
      'Expired/Closed roles auto-skipped: ' + closedCount;
    if (errors.length) msg += '\n\nErrors:\n- ' + errors.join('\n- ');
    SpreadsheetApp.getUi().alert(msg);
  }
}

function ensurePortalKitsSheet_(ss) {
  let sheet = ss.getSheetByName(CONFIG.TABS.PORTAL_KITS);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.TABS.PORTAL_KITS);
    const headers = [[
      'Job ID', 'Company', 'Role Title', 'Job Portal', 'Cover Letter PDF',
      'Cover Letter Text', 'Answer 1: Why Role & Company',
      'Answer 2: Relocation & Work Auth', 'Answer 3: Relevant Experience', 'Generated At'
    ]];
    sheet.getRange(1, 1, 1, 10).setValues(headers).setFontWeight('bold').setBackground('#e8f0fe');
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, 10, 180);
    sheet.setColumnWidth(1, 90);
    sheet.setColumnWidth(4, 150);
    sheet.setColumnWidth(5, 175);
    sheet.setColumnWidth(6, 260);
  }
  return sheet;
}

function compactPortalKitsLayout_(ss) {
  const kitsSheet = ss.getSheetByName(CONFIG.TABS.PORTAL_KITS);
  if (!kitsSheet) return;
  const lastRow = kitsSheet.getLastRow();
  if (lastRow < 2) return;

  const numRows = lastRow - 1;
  const dataRange = kitsSheet.getRange(2, 1, numRows, 10);
  dataRange.setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  dataRange.setVerticalAlignment('middle');

  // Flush cell writes first, then force exact 36px height so \n line breaks never expand rows
  SpreadsheetApp.flush();
  kitsSheet.setRowHeightsForced(2, numRows, CONFIG.KITS_ROW_HEIGHT_PX);
}

function createCoverLetterPdf_(folder, candidateName, company, roleTitle, coverLetterText) {
  const safeName = (candidateName + ' - Cover Letter - ' + company + ' - ' + roleTitle)
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);

  const doc = DocumentApp.create(safeName);
  const body = doc.getBody();
  body.setMarginTop(54);
  body.setMarginBottom(54);
  body.setMarginLeft(60);
  body.setMarginRight(60);

  const p = body.appendParagraph(coverLetterText);
  p.setFontFamily('Arial');
  p.setFontSize(10.5);
  p.setLineSpacing(1.2);
  doc.saveAndClose();

  const tempFile = DriveApp.getFileById(doc.getId());
  const pdfBlob = tempFile.getAs(MimeType.PDF).setName(safeName + '.pdf');
  const pdfFile = folder.createFile(pdfBlob);
  tempFile.setTrashed(true);
  return pdfFile.getUrl();
}

// ----------------------------------------------------------------------------
// 7. EXPIRED / CLOSED JOB LINK CHECKER (ZERO GEMINI API COST)
// ----------------------------------------------------------------------------

function checkExpiredJobLinks() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settings = loadSettings_(ss);
  if (!verifyAccountLock_(settings, true)) return;

  const todayStr = formatDateYMD_(new Date());
  let checked = 0;
  let closedFound = 0;

  // Check Portal Jobs (Col D = Status, Col H = Closing Date, Col I = Job Link)
  const portalSheet = ss.getSheetByName(CONFIG.TABS.PORTAL_JOBS);
  if (portalSheet && portalSheet.getLastRow() >= 2) {
    const pData = portalSheet.getRange(2, 1, portalSheet.getLastRow() - 1, 26).getValues();
    for (let i = 0; i < pData.length; i++) {
      const status = String(pData[i][3] || '').trim().toLowerCase();
      if (status !== 'to apply') continue;
      checked++;
      const res = isJobLinkClosed_(String(pData[i][8] || '').trim(), pData[i][7]);
      portalSheet.getRange(i + 2, 25).setValue(todayStr);
      if (res.closed) {
        portalSheet.getRange(i + 2, 4).setValue('Closed');
        portalSheet.getRange(i + 2, 24).setValue('Auto-closed: ' + res.reason);
        closedFound++;
      }
    }
  }

  // Check Email Jobs (Col P = Status, Col H = Closing Date, Col I = Job Link)
  const emailSheet = ss.getSheetByName(CONFIG.TABS.EMAIL_JOBS);
  if (emailSheet && emailSheet.getLastRow() >= 2) {
    const eData = emailSheet.getRange(2, 1, emailSheet.getLastRow() - 1, 21).getValues();
    for (let i = 0; i < eData.length; i++) {
      const status = String(eData[i][15] || '').trim().toLowerCase();
      if (status !== 'to apply') continue;
      checked++;
      const res = isJobLinkClosed_(String(eData[i][8] || '').trim(), eData[i][7]);
      if (res.closed) {
        emailSheet.getRange(i + 2, 16).setValue('Closed');
        closedFound++;
      }
    }
  }

  SpreadsheetApp.getUi().alert(
    'Expired / Closed Link Check Complete (0 API calls).\n\n' +
    'To Apply links checked: ' + checked + '\n' +
    'Marked Closed: ' + closedFound
  );
}

function isJobLinkClosed_(url, closingDateVal) {
  if (isDateInPast_(closingDateVal)) {
    return { closed: true, reason: 'Closing date passed' };
  }
  if (!url || !/^https?:\/\//i.test(url)) {
    return { closed: false, reason: '' };
  }

  try {
    const res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const code = res.getResponseCode();
    if (code === 404 || code === 410) {
      return { closed: true, reason: 'HTTP ' + code };
    }
    if (code === 200) {
      const html = res.getContentText().toLowerCase();
      const closedPhrases = [
        'this position has been filled',
        'job is no longer available',
        'no longer accepting applications',
        'this job has expired',
        'posting has closed',
        'vacancy is closed',
        'position is no longer open'
      ];
      for (let i = 0; i < closedPhrases.length; i++) {
        if (html.indexOf(closedPhrases[i]) !== -1) {
          return { closed: true, reason: 'Page says: "' + closedPhrases[i] + '"' };
        }
      }
    }
  } catch (err) {
    // Network timeouts or bot blocks should NOT falsely close a live posting
    Logger.log('Link check skipped for ' + url + ': ' + err.message);
  }
  return { closed: false, reason: '' };
}

// ----------------------------------------------------------------------------
// 8. HOURLY / MANUAL GMAIL SYNC, PORTAL AUTO-DETECTION & REPLY CLASSIFIER
// ----------------------------------------------------------------------------

function syncAllJobs(showUiAlert) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    Logger.log('syncAllJobs skipped: another sync is currently running.');
    return;
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const settings = loadSettings_(ss);
    if (!showUiAlert && !settings.hourlyEnabled) return;
    if (!verifyAccountLock_(settings, !!showUiAlert)) return;

    const profile = loadClientProfile_(ss);
    const stats = {
      emailSentDetected: 0,
      draftsDeleted: 0,
      portalSentAutoDetected: 0,
      repliesClassified: 0
    };

    syncEmailJobsSentAndReplies_(ss, settings, profile, stats);
    detectSubmittedPortalJobs_(ss, settings, stats);
    syncPortalReplies_(ss, settings, profile, stats);
    compactPortalKitsLayout_(ss);

    if (showUiAlert) {
      SpreadsheetApp.getUi().alert(
        'Gmail Sync Complete.\n\n' +
        'Email Drafts -> Sent: ' + stats.emailSentDetected + '\n' +
        'Email Drafts Deleted: ' + stats.draftsDeleted + '\n' +
        'Portal Submissions Auto-Detected: ' + stats.portalSentAutoDetected + '\n' +
        'Incoming Replies Classified: ' + stats.repliesClassified
      );
    }
  } finally {
    lock.releaseLock();
  }
}

function syncEmailJobsSentAndReplies_(ss, settings, profile, stats) {
  const sheet = ss.getSheetByName(CONFIG.TABS.EMAIL_JOBS);
  if (!sheet || sheet.getLastRow() < 2) return;

  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 21).getValues();
  const activeDraftIds = new Set(GmailApp.getDrafts().map(d => d.getId()));

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2;
    const company = String(row[1] || '').trim();
    const roleTitle = String(row[2] || '').trim();
    const employerEmail = String(row[4] || '').trim();
    const subject = String(row[11] || '').trim();
    const status = String(row[15] || '').trim();
    const draftId = String(row[16] || '').trim();
    let threadId = String(row[17] || '').trim();

    // A. Detect Drafted -> Sent vs Draft Deleted
    if (status === 'Drafted' && draftId && !activeDraftIds.has(draftId)) {
      const sentThreads = GmailApp.search('in:sent to:' + employerEmail + (subject ? ' subject:"' + subject.replace(/"/g, '') + '"' : ''), 0, 3);
      if (sentThreads.length > 0) {
        const sentThread = sentThreads[0];
        const sentDate = sentThread.getLastMessageDate();
        const followupDate = addDays_(sentDate, settings.followupDays);

        sheet.getRange(rowNum, 15).setValue(formatDateYMD_(sentDate));     // Col O: Date Sent
        sheet.getRange(rowNum, 16).setValue('Sent');                       // Col P: Status
        sheet.getRange(rowNum, 18).setValue(sentThread.getId());           // Col R: Thread ID
        sheet.getRange(rowNum, 19).setValue(formatDateYMD_(followupDate)); // Col S: Follow-up 1 Date
        threadId = sentThread.getId();
        stats.emailSentDetected++;
      } else {
        sheet.getRange(rowNum, 16).setValue('Draft Deleted');
        stats.draftsDeleted++;
        continue;
      }
    }

    // B. Check incoming replies on Sent rows
    if ((status === 'Sent' || sheet.getRange(rowNum, 16).getValue() === 'Sent') && threadId) {
      const classified = processThreadReply_(threadId, company, roleTitle, settings, profile);
      if (classified) {
        applyReplyClassification_(sheet, rowNum, classified, true);
        stats.repliesClassified++;
      }
    }
  }
}

/**
 * Zero-API-cost detector for submitted Portal Jobs via Gmail confirmation emails.
 */
function detectSubmittedPortalJobs_(ss, settings, stats) {
  const sheet = ss.getSheetByName(CONFIG.TABS.PORTAL_JOBS);
  if (!sheet || sheet.getLastRow() < 2) return;

  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 26).getValues();
  const recentThreads = GmailApp.search(
    'newer_than:14d ("thank you for applying" OR "application received" OR "we received your application" OR "application confirmation")',
    0,
    40
  );
  if (!recentThreads.length) return;

  const inboxItems = recentThreads.map(t => {
    const msgs = t.getMessages();
    const last = msgs[msgs.length - 1];
    return {
      thread: t,
      date: last.getDate(),
      subject: last.getSubject() || '',
      from: (last.getFrom() || '').toLowerCase(),
      haystack: (last.getSubject() + ' ' + last.getFrom() + ' ' + last.getPlainBody().slice(0, 1200)).toLowerCase()
    };
  });

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2;
    const company = String(row[1] || '').trim();
    const roleTitle = String(row[2] || '').trim();
    const status = String(row[3] || '').trim();
    const refId = String(row[11] || '').trim();

    if (status.toLowerCase() !== 'to apply' || !company) continue;

    const compLower = company.toLowerCase();
    const refLower = refId.toLowerCase();
    const roleTokens = roleTitle.toLowerCase().split(/\s+/).filter(w => w.length >= 4);

    const matched = inboxItems.find(item => {
      if (item.haystack.indexOf(compLower) === -1) return false;
      if (refLower && item.haystack.indexOf(refLower) !== -1) return true;
      if (roleTokens.length > 0) {
        const hits = roleTokens.filter(tok => item.haystack.indexOf(tok) !== -1).length;
        return hits >= Math.min(2, roleTokens.length);
      }
      return false;
    });

    if (matched) {
      const followupDate = addDays_(matched.date, settings.followupDays);
      sheet.getRange(rowNum, 4).setValue('Sent');                              // Col D: Status
      sheet.getRange(rowNum, 18).setValue(matched.subject);                    // Col R: Confirmation Subject
      sheet.getRange(rowNum, 19).setValue(formatDateYMD_(matched.date));       // Col S: Date Sent
      sheet.getRange(rowNum, 20).setValue(formatDateYMD_(followupDate));       // Col T: Follow-up 1 Date
      sheet.getRange(rowNum, 22).setValue(matched.thread.getId());             // Col V: Thread ID
      stats.portalSentAutoDetected++;
    }
  }
}

function syncPortalReplies_(ss, settings, profile, stats) {
  const sheet = ss.getSheetByName(CONFIG.TABS.PORTAL_JOBS);
  if (!sheet || sheet.getLastRow() < 2) return;

  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 26).getValues();
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2;
    const company = String(row[1] || '').trim();
    const roleTitle = String(row[2] || '').trim();
    const status = String(row[3] || '').trim();
    const employerEmail = String(row[5] || '').trim();
    let threadId = String(row[21] || '').trim(); // Col V

    if (status !== 'Sent') continue;

    if (!threadId && (employerEmail || company)) {
      const q = employerEmail
        ? 'from:' + employerEmail + ' newer_than:30d'
        : '"' + company.replace(/"/g, '') + '" newer_than:30d -in:sent';
      const threads = GmailApp.search(q, 0, 2);
      if (threads.length > 0) {
        threadId = threads[0].getId();
        sheet.getRange(rowNum, 22).setValue(threadId);
      }
    }

    if (threadId) {
      const classified = processThreadReply_(threadId, company, roleTitle, settings, profile);
      if (classified) {
        applyReplyClassification_(sheet, rowNum, classified, false);
        stats.repliesClassified++;
      }
    }
  }
}

function processThreadReply_(threadId, company, roleTitle, settings, profile) {
  const thread = GmailApp.getThreadById(threadId);
  if (!thread) return null;

  const messages = thread.getMessages();
  if (!messages.length) return null;

  const latest = messages[messages.length - 1];
  const fromLower = (latest.getFrom() || '').toLowerCase();
  if (fromLower.indexOf(settings.allowedEmail) !== -1) return null; // Last message is from candidate

  // Avoid re-drafting if a reply draft already exists on this thread
  const hasExistingDraft = messages.some(m => m.isDraft());
  if (hasExistingDraft) return null;

  const bodyText = (latest.getPlainBody() || '').slice(0, 2500);
  const prompt = [
    'Classify this employer email reply and optionally draft a concise human-reviewable reply.',
    'Allowed classifications: ACTION_REQUIRED, AUTO_REPLY, REJECTION, NOT_ELIGIBLE, BOUNCE.',
    'Available candidate documents (keywords): ' + Object.keys(settings.docMap).join(', '),
    'Return valid JSON with keys:',
    '  "classification": one of the 5 values above,',
    '  "needsHumanAction": true or false,',
    '  "requestedDocKeywords": array of matching keywords from the available list (or empty array),',
    '  "draftReply": concise reply body if classification is ACTION_REQUIRED (no signature, empty string otherwise).',
    '',
    'CANDIDATE PROFILE:',
    profile.fullName + ' | ' + profile.targetRoles,
    profile.cvText.slice(0, 1500),
    '',
    'EMPLOYER EMAIL (Company: ' + company + ', Role: ' + roleTitle + '):',
    'Subject: ' + latest.getSubject(),
    bodyText
  ].join('\n');

  const raw = callGemini_(prompt, settings, true);
  const parsed = parseJsonSafe_(raw);

  if (parsed.classification === 'ACTION_REQUIRED' && parsed.draftReply) {
    let replyBody = String(parsed.draftReply).trim();
    if (profile.emailSignature) replyBody += '\n\n' + profile.emailSignature;

    const attachments = [];
    const reqKeywords = Array.isArray(parsed.requestedDocKeywords) ? parsed.requestedDocKeywords : [];
    reqKeywords.forEach(kw => {
      const fileName = settings.docMap[String(kw || '').toLowerCase()];
      if (fileName) {
        const f = findFileInFolder_(settings.driveFolderId, fileName);
        if (f) attachments.push(f.getBlob());
      }
    });

    const opts = attachments.length ? { attachments: attachments } : {};
    // DRAFTS-ONLY: Never auto-send
    thread.createDraftReply(replyBody, opts);
  }

  return parsed;
}

function applyReplyClassification_(sheet, rowNum, classified, isEmailTab) {
  const cls = String(classified.classification || '').toUpperCase();
  let newStatus = '';
  if (cls === 'REJECTION') newStatus = 'Rejected';
  else if (cls === 'NOT_ELIGIBLE') newStatus = 'Not Eligible';
  else if (cls === 'BOUNCE') newStatus = 'Bounced';
  else if (cls === 'ACTION_REQUIRED') newStatus = 'Replied';

  if (isEmailTab) {
    sheet.getRange(rowNum, 14).setValue(cls); // Col N: Reply Classification
    if (newStatus) sheet.getRange(rowNum, 16).setValue(newStatus); // Col P: Status
    if (classified.needsHumanAction || cls === 'ACTION_REQUIRED') {
      sheet.getRange(rowNum, 21).setValue('YES'); // Col U: Human Action Needed
    }
  } else {
    sheet.getRange(rowNum, 23).setValue(cls); // Col W: Reply Classification
    if (newStatus) sheet.getRange(rowNum, 4).setValue(newStatus); // Col D: Status
    if (classified.needsHumanAction || cls === 'ACTION_REQUIRED') {
      sheet.getRange(rowNum, 26).setValue('YES'); // Col Z: Human Action Needed
    }
  }
}

// ----------------------------------------------------------------------------
// 9. DUE FOLLOW-UP DRAFTER (DRAFTS ONLY)
// ----------------------------------------------------------------------------

function draftDueFollowUps() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settings = loadSettings_(ss);
  if (!verifyAccountLock_(settings, true)) return;

  const profile = loadClientProfile_(ss);
  const sheet = ss.getSheetByName(CONFIG.TABS.EMAIL_JOBS);
  if (!sheet || sheet.getLastRow() < 2) {
    SpreadsheetApp.getUi().alert('No rows found in Email Jobs.');
    return;
  }

  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 21).getValues();
  const todayStr = formatDateYMD_(new Date());
  let drafted = 0;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2;
    const company = String(row[1] || '').trim();
    const roleTitle = String(row[2] || '').trim();
    const status = String(row[15] || '').trim();
    const threadId = String(row[17] || '').trim();
    const followupDate = row[18];
    const followupSent = String(row[19] || '').trim();

    if (status !== 'Sent' || !threadId || followupSent) continue;
    if (!followupDate || !isDateDueTodayOrPast_(followupDate)) continue;

    const thread = GmailApp.getThreadById(threadId);
    if (!thread) continue;

    const prompt = [
      'Write a brief, polite 60-90 word follow-up email checking on a job application submitted 7 days ago.',
      'Do NOT include a signature block. Return plain text only.',
      'Candidate: ' + profile.fullName,
      'Company: ' + company,
      'Role: ' + roleTitle
    ].join('\n');

    let body = callGemini_(prompt, settings, false);
    if (profile.emailSignature) body += '\n\n' + profile.emailSignature;

    // DRAFTS-ONLY: Never auto-send
    thread.createDraftReply(body);
    sheet.getRange(rowNum, 20).setValue('Drafted ' + todayStr); // Col T
    drafted++;
    Utilities.sleep(settings.apiPauseMs);
  }

  SpreadsheetApp.getUi().alert('Follow-up drafts created (Drafts Only): ' + drafted);
}

// ----------------------------------------------------------------------------
// 10. DATE & STRING UTILITIES
// ----------------------------------------------------------------------------

function formatDateYMD_(dateObj) {
  return Utilities.formatDate(dateObj, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function addDays_(dateObj, days) {
  const d = new Date(dateObj.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

function isDateInPast_(val) {
  if (!val) return false;
  const d = (val instanceof Date) ? val : new Date(String(val).trim() + 'T23:59:59');
  if (isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

function isDateDueTodayOrPast_(val) {
  if (!val) return false;
  const d = (val instanceof Date) ? val : new Date(String(val).trim() + 'T00:00:00');
  if (isNaN(d.getTime())) return false;
  return d.getTime() <= Date.now();
}

function escapeFormulaStr_(str) {
  return String(str || '').replace(/"/g, '""');
}
