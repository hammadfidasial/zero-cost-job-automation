<img width="2730" height="1536" alt="banner jpg" src="https://github.com/user-attachments/assets/701dc423-673d-4f1a-817b-0b437eaa475d" />

# Zero-Cost Job Application Automation System (v3.4)

A **$0/month**, privacy-first job application automation stack built on **Google Sheets**, **Google Apps Script**, the **Google Gemini API** (free tier), and the free **[Simplify Copilot](https://simplify.jobs/copilot)** Chrome extension.

Designed for individual job seekers and career consultants managing multi-client international or visa-sponsored job searches—without paid SaaS subscriptions, scraping bots, or auto-send risks.

---

## Core Architecture & Safety Guardrails

| Component | Role | Monthly Cost |
| :--- | :--- | :--- |
| **Google Sheets** | Central 6-tab CRM, job pipeline, and live `Summary` dashboard | $0 |
| **Google Apps Script (`Code.gs`)** | Draft generator, Gmail thread sync, portal kit builder, link checker | $0 |
| **Gemini API (`gemini-3.5-flash-lite`)** | Tailored email drafts, cover letters, portal answers, reply classification | $0 (Free Tier via [Google AI Studio](https://aistudio.google.com/)) |
| **Simplify Copilot Chrome Extension** | Free unlimited browser form autofill ([Chrome Web Store](https://chromewebstore.google.com/detail/simplify-copilot-autofill/pbanhockgagggenencehbnadejlgchfc)) | $0 (Skip paid Simplify+ / Autopilot) |

### Non-Negotiable Safety Rules
1. **Drafts-Only Execution (Zero Auto-Send):** `Code.gs` exclusively uses `GmailApp.createDraft()` and `thread.createDraftReply()`. Every email and follow-up sits in Gmail Drafts for human review before sending.
2. **Account Safety Lock:** Before touching Gmail or Drive, the script verifies that `Session.getActiveUser().getEmail()` matches the email configured in `Settings!B2`. If a consultant opens the sheet under the wrong Chrome profile, execution aborts immediately.
3. **Isolated API Keys:** Gemini API keys are stored in `PropertiesService.getScriptProperties()`, never in sheet cells or source code. Duplicating a template sheet never leaks keys.
4. **Zero-Fabrication & Privacy Hygiene:** Prompts instruct Gemini to rely strictly on verified facts in `Client Profile`. Never store passport numbers, national IDs, or sensitive government identifiers inside tracker sheets, prompts, or repositories.

---

## What v3.4 Automates (9 Menu Commands)

Once `Code.gs` is installed, reload your Google Sheet to see the **Job Automation** menu:

| # | Menu Command | What It Does | API Cost |
| :--- | :--- | :--- | :--- |
| 1 | **Set Gemini API Key** | Saves your free Google AI Studio key into Script Properties. | None |
| 2 | **Draft Next 5 Email Applications** | Drafts up to 5 tailored Gmail applications from `Email Jobs` (`To Apply`) with CV attached. | 1 call / job |
| 3 | **Test 1 Email Draft Only** | Safe single-row test for verifying formatting, signature, and CV attachment. | 1 call |
| 4 | **Sync Gmail Replies, Sent & Follow-ups Now** | Detects `Sent` vs `Draft Deleted`, schedules `+7 days` follow-ups, auto-detects submitted `Portal Jobs` from Gmail confirmations, classifies incoming replies, and drafts suggested responses with requested Drive attachments. | Replies only |
| 5 | **Draft Due Follow-up Emails** | Creates polite Gmail reply drafts for `Sent` jobs where `Follow-up 1 Date <= Today`. | 1 call / due job |
| 6 | **Install / Reset Hourly Auto-Sync Trigger** | Installs a `ScriptLock`-protected hourly trigger for `syncAllJobs()`. | None |
| 7 | **Generate Portal Apply Kits (Next 5)** | Pre-checks each `Portal Jobs` URL for 404/closed status, generates a tailored Cover Letter + 3 ready-to-paste portal answers, saves a Cover Letter PDF to Drive (`Portal Cover Letters/`), inserts clickable `=HYPERLINK` buttons, and forces compact **36px** row height. | 1 call / open job |
| 8 | **Test 1 Portal Apply Kit Only** | Safe single-row test for `Portal Apply Kits` + Drive PDF creation. | 1 call |
| 9 | **Check Expired / Closed Job Links** | Scans `To Apply` URLs and closing dates (`YYYY-MM-DD`) across `Portal Jobs` and `Email Jobs`, flipping expired/404/filled roles to `Closed`. | **0 API calls** |

---

## Google Sheet Schema (6 Tabs)

Create a Google Sheet with these exact 6 tab names:

### 1. `Settings`
| Cell | Label (Column A) | Value (Column B) |
| :--- | :--- | :--- |
| `B2` | Allowed Gmail Account | `candidate@example.com` (Account Safety Lock) |
| `B3` | Candidate Drive Folder URL or ID | `https://drive.google.com/drive/folders/YOUR_FOLDER_ID` |
| `B4` | Default CV Filename | `CV.pdf` |
| `B5` | Gemini Model | `gemini-3.5-flash-lite` |
| `B6` | API Pause (ms) | `4500` |
| `B7` | Follow-up Delay (Days) | `7` |
| `B8` | Enable Hourly Automation | `TRUE` |
| `B9` | Portal Cover Letters Subfolder Name | `Portal Cover Letters` |
| `B12:B19` | Document Map (Keyword in Col A → Exact Drive Filename in Col B) | e.g., `License` → `License.pdf`, `Transcript` → `Transcript.pdf`, `IELTS` → `IELTS.pdf`, `Reference` → `References.pdf` |

### 2. `Client Profile`
| Cell | Field (Column A) | Value (Column B) |
| :--- | :--- | :--- |
| `B2` | Candidate Full Name | Full legal/professional name |
| `B3` | Target Roles / Tracks | e.g., `Process Engineer, CQV Engineer` |
| `B4` | Target Countries / Visa Status | e.g., `Ireland, Germany, Netherlands (Requires Work Permit / Sponsorship)` |
| `B5` | Email Signature | Multi-line professional signature (Name, Title, Phone, LinkedIn) |
| `B6` | Verified CV / Profile Summary Text | Full plain-text CV, verified credentials, dates, notice period, and factual constraints (no government IDs) |

### 3. `Email Jobs` (Columns A–U)
| Col | Header | Col | Header | Col | Header |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `A` | Job ID | `H` | Closing Date (`YYYY-MM-DD`) | `O` | Date Sent |
| `B` | Company | `I` | Job Link | `P` | Status (`To Apply`, `Drafted`, `Sent`, `Replied`, `Rejected`, `Not Eligible`, `Bounced`, `Closed`, `Draft Deleted`) |
| `C` | Role Title | `J` | Job Description / Notes | `Q` | Gmail Draft ID |
| `D` | Country / City | `K` | CV File Override | `R` | Gmail Thread ID |
| `E` | Employer Email | `L` | Subject Line | `S` | Follow-up 1 Date |
| `F` | Contact Name | `M` | Date Drafted | `T` | Follow-up 1 Sent |
| `G` | Visa / Sponsorship Note | `N` | Reply Classification | `U` | Human Action Needed (`YES` / blank) |

### 4. `Portal Jobs` (Columns A–Z)
| Col | Header | Col | Header | Col | Header |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `A` | Job ID | `J` | Portal Platform (Workday, Greenhouse, etc.) | `S` | Date Sent |
| `B` | Company | `K` | Job Description / Notes | `T` | Follow-up 1 Date |
| `C` | Role Title | `L` | Portal Ref ID | `U` | Follow-up 1 Sent |
| `D` | Status (`To Apply`, `Sent`, `Replied`, `Rejected`, `Not Eligible`, `Closed`) | `M` | CV File Override | `V` | Gmail Thread ID |
| `E` | Country / City | `N` | Kit Generated (`YES` / blank) | `W` | Reply Classification |
| `F` | Employer Email (Optional) | `O` | Cover Letter PDF Link | `X` | Notes / Sync Log |
| `G` | Visa / Sponsorship Note | `P` | Kit Generated Date | `Y` | Last Checked |
| `H` | Closing Date (`YYYY-MM-DD`) | `Q` | Candidate Account Used | `Z` | Human Action Needed (`YES` / blank) |
| `I` | Job Link | `R` | Confirmation Subject | | |

### 5. `Portal Apply Kits` (Auto-Created by `Code.gs`)
Automatically created and formatted with `WrapStrategy.CLIP` and forced **36px** row height (`setRowHeightsForced`) so multi-paragraph cover letters never stretch the sheet vertically.

Columns: `Job ID` | `Company` | `Role Title` | `Job Portal` (`=HYPERLINK`) | `Cover Letter PDF` (`=HYPERLINK`) | `Cover Letter Text` | `Answer 1: Why Role & Company` | `Answer 2: Relocation & Work Auth` | `Answer 3: Relevant Experience` | `Generated At`

### 6. `Summary` (100% Open-Ended Formulas)
Use open-ended ranges (`P2:P`, `D2:D`, `S2:S`, `T2:T`, `U2:U`, `Z2:Z`) so dashboards never miss rows as the tracker grows:

| Metric | Email Jobs Formula | Portal Jobs Formula |
| :--- | :--- | :--- |
| **Total Jobs** | `=COUNTA('Email Jobs'!B2:B)` | `=COUNTA('Portal Jobs'!B2:B)` |
| **To Apply** | `=COUNTIF('Email Jobs'!P2:P, "To Apply")` | `=COUNTIF('Portal Jobs'!D2:D, "To Apply")` |
| **Drafted** | `=COUNTIF('Email Jobs'!P2:P, "Drafted")` | `=0` |
| **Sent** | `=COUNTIF('Email Jobs'!P2:P, "Sent")` | `=COUNTIF('Portal Jobs'!D2:D, "Sent")` |
| **Replied** | `=COUNTIF('Email Jobs'!P2:P, "Replied")` | `=COUNTIF('Portal Jobs'!D2:D, "Replied")` |
| **Rejected** | `=COUNTIF('Email Jobs'!P2:P, "Rejected")` | `=COUNTIF('Portal Jobs'!D2:D, "Rejected")` |
| **Not Eligible** | `=COUNTIF('Email Jobs'!P2:P, "Not Eligible")` | `=COUNTIF('Portal Jobs'!D2:D, "Not Eligible")` |
| **Bounced** | `=COUNTIF('Email Jobs'!P2:P, "Bounced")` | `=0` |
| **Closed** | `=COUNTIF('Email Jobs'!P2:P, "Closed")` | `=COUNTIF('Portal Jobs'!D2:D, "Closed")` |
| **Follow-ups Due** | `=COUNTIFS('Email Jobs'!P2:P, "Sent", 'Email Jobs'!S2:S, "<="&TODAY(), 'Email Jobs'!S2:S, "<>", 'Email Jobs'!T2:T, "")` | `=COUNTIFS('Portal Jobs'!D2:D, "Sent", 'Portal Jobs'!T2:T, "<="&TODAY(), 'Portal Jobs'!T2:T, "<>", 'Portal Jobs'!U2:U, "")` |
| **Human Action Needed** | `=COUNTIF('Email Jobs'!U2:U, "YES")` | `=COUNTIF('Portal Jobs'!Z2:Z, "YES")` |

---
## Before You Start: Manual Prep vs. Auto-Created

Before running `Code.gs` or `SKILL.md`, complete these one-time manual steps so the automation has everything it needs:

| Step | Who Does It | What You Need to Do |
| :--- | :--- | :--- |
| **1. Dedicated Chrome Profile & Gmail** | Manual (You) | Sign in to the candidate's Gmail in its own Chrome profile (mandatory for multi-client agencies so sessions never mix). |
| **2. Google Drive Folder & Documents** | Manual (You) | Create one Drive folder containing a clean ATS `CV.pdf` plus verified supporting PDFs (diplomas, licenses, IELTS, references) and copy the folder URL. |
| **3. Free Gemini API Key** | Manual (You) | Generate a free key at [Google AI Studio](https://aistudio.google.com/). Never paste it into sheet cells or public repos. |
| **4. Base Google Sheet (5 Tabs)** | Manual (You) | Create a blank Google Sheet with 5 tabs: `Settings`, `Client Profile`, `Email Jobs`, `Portal Jobs`, and `Summary`. |
| **5. Paste `Code.gs` & Authorize** | Manual (One-Time) | Open **Extensions -> Apps Script**, paste `Code.gs` (`Ctrl+A -> Ctrl+V -> Ctrl+S`), reload the Sheet, run **Job Automation -> 1. Set Gemini API Key**, and accept Google's OAuth permission prompt. |
| **6. Free Simplify Copilot (Optional)** | Manual (You) | Install [Simplify Copilot](https://simplify.jobs/copilot) in the candidate's Chrome profile, upload only `CV.pdf`, and skip paid Simplify+ / Autopilot. |
| **7. Auto-Created by `Code.gs` & Skill** | **Automatic** | Creates the `Portal Apply Kits` tab (36px compact rows), `Portal Cover Letters/` Drive subfolder, Cover Letter PDFs, `Job Automation` menu, hourly sync trigger, Gmail drafts, and `Master Autofill Profile` Doc. |

## How to Use `SKILL.md` with AI Assistants (Gemini, Claude, ChatGPT & Codex)

| AI Platform | How to Load `SKILL.md` |
| :--- | :--- |
| **Gemini** | Save `SKILL.md` as a reusable Skill or paste it into a **Gemini Gem**. |
| **Claude (Web / Claude Code)** | Upload `SKILL.md` + `Code.gs` to a **Claude Project**, or place it at `.claude/skills/zero-cost-job-automation/SKILL.md`. |
| **ChatGPT** | Paste `SKILL.md` into **Custom GPT Instructions** (or a Project) and upload `Code.gs` as a Knowledge file. |
| **Codex / Cursor / AI IDEs** | Save `SKILL.md` in `.agents/skills/zero-cost-job-automation/SKILL.md` (or `.cursor/rules/`). |

### Copy-Paste Starter Prompt (Works in Any AI Tool)
> Follow `SKILL.md` (`zero-cost-job-automation` v3.4) strictly. Start with **Step 0: Mandatory Pre-Flight Prerequisites**—verify my Chrome profile, Drive folder (`CV.pdf` + supporting docs), free Gemini API key, and base 5-tab Google Sheet first. Once confirmed, help me populate `Settings`, `Client Profile`, `Summary` formulas, and a `Master Autofill Profile` Doc (excluding government IDs).
## 10-Minute Quickstart Setup

1. **Prepare Google Drive:** Create a dedicated folder in the candidate's Google Drive containing `CV.pdf` and supporting documents (licenses, diplomas, language certificates).
2. **Create the Google Sheet:** Set up the 6 tabs above and fill in `Settings` (`B2:B9`, `B12:B19`) and `Client Profile` (`B2:B6`).
3. **Install `Code.gs`:** Open **Extensions → Apps Script**, replace the default file contents with `Code.gs` (`Ctrl+A → Ctrl+V → Ctrl+S`), and reload the Google Sheet.
4. **Authorize & Set API Key:**
   - Generate a free API key at [Google AI Studio](https://aistudio.google.com/).
   - In the sheet menu, click **Job Automation → 1. Set Gemini API Key** and paste your key.
5. **Run Safe Tests:**
   - Add 1 row in `Email Jobs` (`Status = To Apply`) → run **3. Test 1 Email Draft Only** → inspect Gmail Drafts.
   - Add 1 row in `Portal Jobs` (`Status = To Apply`) → run **8. Test 1 Portal Apply Kit Only** → inspect `Portal Apply Kits` and Drive's `Portal Cover Letters/` folder.
6. **Enable Hourly Sync:** Click **6. Install / Reset Hourly Auto-Sync Trigger**.
7. **Pair with Free Simplify Copilot:**
   - Install [Simplify Copilot](https://simplify.jobs/copilot) in the candidate's Chrome profile.
   - Upload **only the clean ATS `CV.pdf`** into Simplify's Resume slot (never upload a raw data dump PDF).
   - Keep a separate **Master Autofill Profile** Google Doc in Drive for one-time copy-paste of exact degree dates, registration numbers, and custom portal answers (excluding passport/national ID numbers).

---

## Scaling for Career Consultants & Agencies

- Use **one dedicated Chrome profile per client** so Gmail, Drive, Apps Script authorization, and Simplify Copilot sessions never collide.
- Keep **one Sheet + one Script Properties API key per client** (`Settings!B2` enforces the Account Safety Lock).
- Use the included `SKILL.md` with your AI assistant to standardize onboarding, sheet auditing, and Master Autofill Profile creation across clients.

---
## Author

Built by **Hammad Hussain** — AI Automation Expert & Full-Stack Developer.

- GitHub: `https://github.com/hammadfidasial`

## License

MIT License — free to use, fork, and adapt for personal or agency recruiting workflows.
