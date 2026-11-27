---
name: zero-cost-job-automation
description: Set up, audit, operate, and scale a $0/month Google Sheets + Google Apps Script (v3.4) + Gemini API + Simplify Copilot job application automation workflow for individual candidates or multi-client career consulting, with Drafts-Only safety, Account Lock, Portal Apply Kits, expired link checks, and Master Autofill Profile creation.
---

# Zero-Cost Job Application Automation (v3.4)

Use this skill whenever helping a user or career consultant build, deploy, audit, troubleshoot, or scale a **$0/month job application automation system** powered by Google Sheets, Google Apps Script (`Code.gs` v3.4), the free-tier Gemini API (`gemini-3.5-flash-lite`), and the free Simplify Copilot Chrome extension.
## Step 0: Mandatory Pre-Flight Prerequisites (Always Run First)

Before deploying `Code.gs`, drafting emails, or generating Portal Apply Kits, verify that the user has completed these manual one-time prerequisites. If any item is missing, guide the user through completing it first:

1. **Dedicated Chrome Profile & Gmail:** Open the candidate's Gmail in its own Chrome profile so Gmail, Drive, Apps Script, and Simplify sessions never collide.
2. **Google Drive Folder & Verified Docs:** Create one folder in the candidate's Drive with a clean ATS `CV.pdf` and supporting PDFs (diplomas, licenses, language scores, references), and copy its URL.
3. **Free Gemini API Key:** Create a free API key at `aistudio.google.com` (stored later via **Job Automation -> 1. Set Gemini API Key**, never in cells or code).
4. **Base Google Sheet (5 Tabs):** Create a blank Sheet with `Settings`, `Client Profile`, `Email Jobs`, `Portal Jobs`, and `Summary` (`Portal Apply Kits` is auto-created by `Code.gs`).
5. **One-Time Apps Script Setup & Authorization:** Paste `Code.gs` in **Extensions -> Apps Script**, reload the Sheet, set the API key, and complete Google's one-time OAuth approval.
6. **Free Simplify Copilot (For Portal Jobs):** Install Simplify Copilot, upload only the clean ATS `CV.pdf`, and skip paid upgrades.
## Non-Negotiable Guardrails

1. **Zero-Cost Stack ($0/month):**

   * Use free Google Workspace (Sheets, Gmail, Drive, Apps Script), free Google AI Studio API keys (`gemini-3.5-flash-lite`), and free Simplify Copilot form autofill only.

   * Instruct users to skip paid Simplify+ / Autopilot upgrades; `Portal Apply Kits` replaces paid AI cover-letter and answer generation at $0.

2. **Drafts-Only Safety Rule:**

   * Never auto-send emails or replies. Always use `GmailApp.createDraft()` and `thread.createDraftReply()` so a human reviews and clicks Send.

3. **Account Safety Lock:**

   * Always verify `Session.getActiveUser().getEmail()` against `Settings!B2` before running any Gmail or Drive action.

   * For multi-client agencies, enforce one Chrome profile, one Sheet, and one Script Properties API key per client.

4. **Zero Fabrication & Strict Privacy:**

   * Never invent dates, CGPA, registration numbers, language test scores, or employer details. If a required fact is missing or conflicts across documents, flag the discrepancy explicitly and ask the user.

   * Never store government IDs (passport numbers, national IDs, tax IDs, or TRF numbers) inside tracker sheets, `Client Profile`, `Master Autofill Profile` docs, or public repositories.

5. **Simplify Resume Hygiene:**

   * Never upload a cluttered "all-details" or Master Autofill PDF into Simplify Copilot's Resume slot. Always keep a clean, ATS-formatted `CV.pdf` in Simplify, and keep the Master Autofill Profile as a separate Google Doc reference.

## System Architecture (6-Tab Sheet + `Code.gs` v3.4)

### Required Sheet Tabs

1. **`Settings`**:

   * `B2`: Allowed Gmail Account (Account Safety Lock)

   * `B3`: Candidate Drive Folder URL or ID

   * `B4`: Default CV Filename (e.g., `CV.pdf`)

   * `B5`: Gemini Model (`gemini-3.5-flash-lite`)

   * `B6`: API Pause in ms (`4500`)

   * `B7`: Follow-up Delay in Days (`7`)

   * `B8`: Enable Hourly Automation (`TRUE` / `FALSE`)

   * `B9`: Portal Cover Letters Subfolder Name (`Portal Cover Letters`)

   * `B12:B19`: Document Map (Col A keyword → Col B exact Drive filename for automatic reply attachments)

2. **`Client Profile`**:

   * `B2`: Candidate Full Name

   * `B3`: Target Roles / Tracks

   * `B4`: Target Countries & Work Authorization / Sponsorship Status

   * `B5`: Email Signature

   * `B6`: Verified CV / Profile Summary Text (all verified facts, zero government IDs)

3. **`Email Jobs` (Cols A–U)**: Direct HR/recruiter email outreach pipeline (`P` = Status, `Q` = Draft ID, `R` = Thread ID, `S` = Follow-up 1 Date, `T` = Follow-up 1 Sent, `U` = Human Action Needed).

4. **`Portal Jobs` (Cols A–Z)**: ATS/career-portal pipeline (`D` = Status, `L` = Portal Ref ID, `N` = Kit Generated, `O` = Cover Letter PDF Link, `T` = Follow-up 1 Date, `U` = Follow-up 1 Sent, `V` = Thread ID, `Z` = Human Action Needed).

5. **`Portal Apply Kits`**: Auto-created by `Code.gs` with `=HYPERLINK` buttons (`Open Job Portal`, `Open Cover Letter PDF`), tailored Cover Letter, 3 ready-to-paste portal answers, and permanently compacted **36px** row height (`WrapStrategy.CLIP` + `SpreadsheetApp.flush()` + `setRowHeightsForced`).

6. **`Summary`**: Open-ended range formulas (`P2:P`, `D2:D`, `S2:S`, `T2:T`, `U2:U`, `Z2:Z`) including a dedicated `Closed` row so totals stay 100% balanced as rows are added.

## Workflow 1: Onboarding a New Candidate

1. **Audit Drive Documents:** Inspect the candidate's Drive folder to verify `CV.pdf`, academic transcripts/diplomas, professional licenses/registrations, language scores, and reference letters. Record exact issue/expiry dates and flag any date conflicts or expired documents.

2. **Configure `Settings` & `Client Profile`:** Populate `Settings!B2:B9`, map supporting documents in `Settings!B12:B19`, and populate `Client Profile!B2:B6` using only verified facts.

3. **Deploy `Code.gs` v3.4:** Provide the complete, ready-to-paste `Code.gs` for `Extensions → Apps Script` (`Ctrl+A → Ctrl+V → Ctrl+S`).

4. **Store API Key Safely:** Instruct the user to run **Job Automation → 1. Set Gemini API Key** with a free Google AI Studio key.

5. **Smoke Test Before Scaling:**

   * Run **3. Test 1 Email Draft Only** and confirm the Gmail draft has the right subject, signature, and `CV.pdf` attachment.

   * Run **8. Test 1 Portal Apply Kit Only** and confirm `Portal Apply Kits` renders with compact 36px rows and a working Drive PDF link.

6. **Activate Automation:** Run **6. Install / Reset Hourly Auto-Sync Trigger**.

## Workflow 2: Creating a Master Autofill Profile Doc

When asked to prepare a candidate for Simplify Copilot and ATS portal forms (Workday, Greenhouse, Lever, SmartRecruiters, Taleo):

1. Extract verified facts from the candidate's Drive documents and `Client Profile` tab:

   * Personal & Contact (Full name, email, phone, location, LinkedIn, DOB if verified on official transcript/diploma; **omit** passport/national ID numbers)

   * Target Preferences (Target roles, countries, visa/sponsorship disclosure, notice period, salary expectations if verified)

   * Education (Exact institution, degree, start/end dates, graduation/result date, CGPA/percentage)

   * Work Experience (Chronological roles with exact start/end months/years and verified achievements)

   * Licenses, Registrations & Certificates (Exact registration number, issuing body, issue & expiry dates; flag expired ones)

   * Ready-to-Paste Standard Portal Answers (Work authorization, relocation readiness, career summary, why international role)

   * Discrepancy & Missing-Data Checklist (Any conflicting dates or missing documents to resolve before applying)

2. Save as a clean Google Doc inside the candidate's Drive folder with source document links.

3. Remind the user to keep `CV.pdf` in Simplify's Resume upload slot and use the Master Autofill Doc purely as a quick copy-paste reference for one-time Simplify profile setup and portal edge-case fields.

## Workflow 3: Daily Operations & Maintenance

* **Before generating Portal Kits:** Run **9. Check Expired / Closed Job Links** (0 API calls) to filter out 404/filled roles automatically.

* **Direct Email Outreach:** Run **2. Draft Next 5 Email Applications**, review in Gmail Drafts, and click Send.

* **Portal Applications:** Run **7. Generate Portal Apply Kits (Next 5)**, click `Open Job Portal`, let Simplify Copilot autofill standard fields, paste the tailored answers from `Portal Apply Kits`, upload `CV.pdf` + the auto-saved Cover Letter PDF, and submit.

* **Automatic Tracking:** Hourly `syncAllJobs()` detects sent emails, auto-detects submitted portal confirmations from Gmail (0 API calls), classifies employer replies, drafts suggested responses with matched Drive attachments, and keeps `Portal Apply Kits` compact at 36px.

* **Weekly Follow-ups:** Run **5. Draft Due Follow-up Emails**, review drafts, and send.
