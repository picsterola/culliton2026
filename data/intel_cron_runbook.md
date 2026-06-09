# Weekly Candidate Intel Scan — Cron Runbook

**Site:** culliton2026.org
**Owner:** Viet Nguyen
**Cadence:** Thursdays 7:00 AM PT
**Last manually updated:** 2026-06-04

## Purpose

Maintain currency of candidate signals on culliton2026.org by scanning for new developments each week. Auto-apply mechanical updates. Queue substantive changes for Viet's approval.

## Inputs

- `/home/user/workspace/culliton2026/data/candidates.json` — current ground truth, 16 candidates
- `/home/user/workspace/culliton2026/data/justices.json` — off-ballot court composition
- `/home/user/workspace/culliton2026/data/intel_state.json` — open questions, dedup hashes, change log
- `/home/user/workspace/culliton2026/data/PDC_fundraising_2026-05-19.xlsx` — most recent PDC snapshot

## Scope: 16 candidates

| Pos | Candidate | Current lean | Confidence | Key signal to watch |
|---|---|---|---|---|
| 1 | Colleen Melody | Scrap | High | Endorsements, IE filings |
| 1 | Scott Edwards | Keep | High | Fundraising surge, viability |
| 1 | Laura Colberg | Unclear | Low | Filing status, lean signals |
| 3 | Maria Diaz | Scrap | High | Endorsements |
| 3 | Steven Hawk | Scrap | Medium | Viability vs Diaz |
| 3 | David Stevens | Keep | High | Fundraising progress |
| 4 | Ian Birk | Scrap | High | IE money landing |
| 4 | Sean O'Donnell | Unclear | Low | **PRIORITY: lean resolution** |
| 4 | (others if filed) | — | — | — |
| 5 | Theo Angelis | Scrap | High | Incumbent activity |
| 5 | David Larson | Keep | High | Closing gap with Angelis |
| 5 | Sharonda Amamilo | Unclear | Low | Lean signals |
| 5 | Greg Miller | Unclear | Low | Filing/lean |
| 7 | Debra Stephens | Keep | Medium | **Fundraising in earnest?** |
| 7 | Todd Bloom | Keep | High | **PDC filing status** |
| 7 | Karim Merchant | Unclear | Low | Filing, lean |
| 7 | David Shelvey | Unclear | Low | Filing, lean |

## Procedure (each Thursday)

### Step 1 — Load state and check dedup

Read `intel_state.json`. Update `last_scan` to today. Increment `weeks_open` on each open question.

### Step 2A — Refresh PDC fundraising totals (deterministic, ~30 sec)

Run the standalone refresh script BEFORE the per-candidate scan:

```bash
cd /home/user/workspace/culliton2026
python3 scripts/refresh_pdc.py
```

This script queries the Washington PDC's open-data endpoint on data.wa.gov (Socrata dataset `kv7h-kjye`) and sums each candidate's 2026 cash contributions by `filer_id`. It updates `c.pdc.raised` and `c.pdc.as_of` in `candidates.json` for all 13 candidates that have filer IDs registered. Three candidates (Shelvey, Merchant, Bloom) have no filer_id yet because they haven't filed any contributions; the script silently skips them.

**Treat any candidate whose `raised` value moved as a MECHANICAL update** (auto-apply per Step 5). The script's stdout lists each change for inclusion in the commit message. If the refresh script fails entirely (network down, Socrata 5xx), proceed with the rest of the scan and report the failure in the digest. Do NOT block on it.

Note: if a new candidate has filed and now has contributions in PDC, their row will still skip (no `filer_id` set). Use Step 9's handling to queue the new filer_id for Viet's review.

### Step 2B — Per-candidate lightweight scan (~5 min each)

For each candidate above, run web search covering the **last 7 days**:

- `search_web` with `queries=["{candidate name} Washington Supreme Court 2026"]` and `recency_filter="week"`
- `search_web` with `queries=["{candidate name} endorsement", "{candidate name} ruling", "{candidate name} statement"]` and `recency_filter="week"`
- Quick PDC.wa.gov check for new C-3 / C-4 filings via `fetch_url`

**Note:** The previous version of this runbook called `pplx search web` with `--recency week`. That CLI is not available in this sandbox. Use the agent's native `search_web` tool with `recency_filter="week"` instead. If `search_web` itself is ever unavailable, fall back to `fetch_url` on the candidate's campaign site, voter pamphlet URL, and PDC profile, but do NOT block the scan.

Look for:
- **Endorsements** (BIAW, Realtors PAC, WEA-PAC, AFSCME, FOP, newspapers, bar associations)
- **Public statements** on tax policy, ESSB 6346, Culliton, Quinn
- **Court rulings or opinions** authored or joined (for sitting judges/justices)
- **Fundraising surges or drops** (new PDC reports)
- **Filing changes** (new candidates entering, withdrawals)
- **Media hits** that materially change viability or lean confidence
- **IE activity** filed against or for any candidate

### Step 3 — Dedup findings

Hash each finding (SHA-256 of headline + URL). Skip anything in `recent_findings_hashes`. Add new hashes to the list. Trim list to last 90 days.

### Step 4 — Categorize each finding

- **MECHANICAL (auto-apply):**
  - **PDC fundraising totals** — handled by Step 2A's `refresh_pdc.py`. Every `raised`/`as_of` change goes straight to commit, no review.
  - Filing status change (filed / withdrew) → update PDC link or front_runner flag
  - Confirmed endorsement from a recognized organization with a primary source → append to notes
  - Minor notes additions and link updates

- **REVIEW (queue for Viet):**
  - Any **lean change** (scrap ↔ keep ↔ unclear)
  - Any **confidence change** (high ↔ medium ↔ low)
  - **front_runner flag** flips
  - Anything that materially contradicts current candidate framing
  - Any **legal/ethics issue** (judicial conduct commission filings, sanctions, lawsuits)
  - Anything ambiguous

### Step 5 — Apply mechanical updates

For each MECHANICAL change:
1. Edit `candidates.json` directly with surgical precision (use `edit` tool, not full rewrite)
2. Log to `intel_state.json` → `auto_applied_changes_log` with timestamp, change, source URL
3. Commit and deploy

Git workflow:
```
cd /home/user/workspace/culliton2026
# Regenerate candidate pages + homepage aggregate to reflect any PDC or content changes
python3 scripts/generate_candidate_pages.py
git stash -u && git pull --rebase origin main && git stash pop
git add data/candidates.json data/intel_state.json candidate/ index.html sitemap.xml
git -c user.email="agent@perplexity.ai" -c user.name="Culliton Agent" commit -m "Weekly intel update YYYY-MM-DD: {brief summary}"
git push origin main
```
Use `api_credentials=["github"]`.

Then deploy via `pplx-tool deploy_website` with:
- `project_path`: `/home/user/workspace/culliton2026`
- `site_name`: `Culliton 2026`
- `entry_point`: `index.html`
- `should_validate`: `false`
- Asset ID: `b2d63cee-97eb-4325-bc0c-60be5be783b5`

### Step 6 — Queue review items

For each REVIEW change:
- Append to `intel_state.json` → `pending_review_changes` array
- Each entry: `{id, candidate, current_state, proposed_state, evidence_urls, reasoning, confidence, opened_date}`

### Step 7 — Check open questions for progress

For each entry in `open_questions`:
- Has any new finding moved the needle on this question?
- If YES, append finding to the question's progress log and update status to `progressing`
- If a definitive answer emerged, mark `status: "resolved"` with resolution note
- Special focus on `odonnell_lean` (high priority)

### Step 8 — Send digest

`send_notification` with:
- `title`: "Culliton 2026 weekly intel: {N} new signals, {M} pending review"
- `body`: Markdown digest containing:
  1. **Auto-applied this week** (bullet list with source links)
  2. **Pending your review** (bullet list with proposed changes + reasoning)
  3. **Open questions progress** (especially O'Donnell)
  4. **Quiet candidates** (no new signals — listed briefly)
- `url`: `https://www.culliton2026.org`
- `schedule_description`: "Thursdays · 7:00 AM PT"
- `channels`: `["in_app"]`

### Step 9 — If a candidate enters / withdraws

If a NEW candidate files for any of the 5 positions, this is a REVIEW item — do NOT auto-add to candidates.json. Queue for Viet's approval with full background research.

If a candidate withdraws, this is auto-apply: set `withdrawn: true` on the candidate record, note the withdrawal in notes field, but do NOT remove from candidates.json (preserves historical context).

## Guardrails (non-negotiable)

1. **Never auto-apply a lean change.** Always queue for review.
2. **Never auto-apply allegations or unverified claims.** If a media hit alleges misconduct, queue for review with source links.
3. **Every change must have a primary source URL.** No "according to general reporting." Cite the specific outlet, document, or filing.
4. **If the scan returns zero new findings for a week**, still send the digest — show open questions progress and confirm the scan ran. Silent crons get ignored.
5. **Token budget**: cap at ~40 search queries per scan (~2.5 per candidate average). If you blow past 60, summarize and exit rather than spiraling.
6. **Don't touch the widget logic, balance-of-power section, or any HTML/CSS.** This cron is data-only.

## Edge cases

- **PDC site down** → defer PDC checks to next week, note in digest
- **GitHub push conflict** → stash, pull, retry once; if fails again, queue all changes for review and abort deploy
- **Deploy fails** → keep changes committed locally, flag in digest, do not retry indefinitely
- **More than 10 review items queued** → digest body becomes summary; full list stays in `intel_state.json`

## Manual interventions Viet may do

- Edit `intel_state.json` directly to close an open question or change priorities
- Reject a pending review change (just say so in chat)
- Approve a pending review change (apply, commit, deploy)
- Ask for an ad-hoc scan on a specific candidate

---

*Runbook version 1.1 — created 2026-05-21, updated 2026-06-04 (switched search tooling from `pplx search web --recency week` to native `search_web` with `recency_filter="week"` after the pplx CLI was found unavailable in the sandbox). Update when scope changes (e.g., after July 21 PDC filing deadline, new candidates enter, etc.)*
