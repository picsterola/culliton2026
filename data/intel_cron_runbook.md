# Weekly Candidate Intel Scan — Cron Runbook

**Site:** culliton2026.org
**Owner:** Viet Nguyen
**Cadence:** Thursdays 7:00 AM PT
**Last manually updated:** 2026-09-01
**Version:** 1.4

## 🚨 Do NOT escalate to the user

Under ANY tool failure, missing file, unexpected candidate count, or other
disruption, DO NOT escalate. Proceed with the documented fallback and log the
issue in the digest. If you cannot proceed at all, send an in-app notification
noting what blocked you and leave state untouched. The one exception is a
catastrophic filesystem or auth failure where NO fallback path exists.

Sanity-check before assuming the file is corrupt:

```bash
python3 -c "import json; d=json.load(open('data/candidates.json')); print(len(d['candidates']))"
```

The file should contain **16 candidate records** (10 advancing + 6 eliminated,
preserved for historical context). If it prints anything other than 16, THEN
AND ONLY THEN investigate. A wrong variable name in a scratch script is not
evidence that the input file is broken. Don't assume corruption.

## Purpose

Maintain currency of candidate signals on culliton2026.org by scanning for new developments each week. Auto-apply mechanical updates. Queue substantive changes for Viet's approval.

## Post-primary scope (as of Aug 21, 2026 certification)

The August 4 primary is certified. The candidate universe now splits two ways:

- **10 advancing candidates** (on the November 3 general ballot): scan weekly, full attention.
- **6 eliminated candidates**: minimal maintenance. Their pages are preserved as public record with an "Eliminated in primary" badge. Do NOT run weekly search on them. Do NOT refresh their PDC totals. Log them once in the digest under "Quiet (eliminated)" and move on.

Every candidate record carries a `primary_result` object:

```json
"primary_result": {
  "election_date": "2026-08-04",
  "certified_date": "2026-08-21",
  "certified_by": "Washington Secretary of State",
  "position": 3,
  "pct": 31.25,
  "votes": 545782,
  "rank": 3,
  "advanced_to_general": false,
  "sources": ["https://www.sos.wa.gov/..."]
}
```

Use `primary_result.advanced_to_general === true` as the filter for "in scope."

### The 10 advancing candidates

| Pos | Candidate | Current lean | Confidence | Primary rank |
|---|---|---|---|---|
| 1 | Colleen Melody | Scrap | High | 1st (52.90%) |
| 1 | Scott Edwards | Keep | High | 2nd (29.39%) |
| 3 | David Stevens | Keep | High | 1st (35.19%) |
| 3 | Jaime Hawk | Scrap | Medium-High | 2nd (33.27%) |
| 4 | Ian Birk | Scrap | High | Auto-advanced (no primary) |
| 4 | Sean O'Donnell | Unclear | Medium-Low | Auto-advanced (no primary) |
| 5 | Theo Angelis | Scrap | High | 1st (35.84%) |
| 5 | David Larson | Keep | High | 2nd (32.17%) |
| 7 | Debra Stephens | Keep | Medium-High | 1st (54.37%) |
| 7 | Todd Bloom | Keep | High | 2nd (27.13%) |

### The 6 eliminated candidates (historical, no weekly scan)

| Pos | Candidate | Primary rank |
|---|---|---|
| 1 | Laura Colberg | 3rd (17.47%) |
| 3 | J. Michael Diaz | 3rd (31.25%) |
| 5 | Sharonda Amamilo | 3rd (21.33%) |
| 5 | Greg Miller | 4th (10.44%) |
| 7 | Karim Merchant | 3rd (12.03%) |
| 7 | David Shelvey | 4th (6.24%) |

## Inputs

- `/home/user/workspace/culliton2026/data/candidates.json` — 16 candidate records (10 advancing + 6 eliminated)
- `/home/user/workspace/culliton2026/data/justices.json` — off-ballot court composition
- `/home/user/workspace/culliton2026/data/intel_state.json` — open questions, dedup hashes, change log

## Procedure (each Thursday)

### Step 1 — Load state and check dedup

Read `intel_state.json`. Update `last_scan` to today. Increment `weeks_open` on each open question.

**Also run the stale-review sweep (see Guardrail #7 below) BEFORE scanning:** any pending_review_changes with `opened_date` older than 6 weeks and no new supporting evidence gets auto-closed as `stale`, logged, and dropped from the queue. This prevents the "queue toothless" failure mode where high-confidence items sat in review for a month past the event that would have resolved them.

### Step 2A — Refresh PDC fundraising totals (deterministic, ~30 sec)

Run the standalone refresh script BEFORE the per-candidate scan:

```bash
cd /home/user/workspace/culliton2026
python3 scripts/refresh_pdc.py
```

This script queries the Washington PDC's open-data endpoint on data.wa.gov (Socrata dataset `kv7h-kjye`) and sums each candidate's 2026 cash contributions by `filer_id`.

**Post-primary behavior:** the script still refreshes ALL 16 candidates with filer IDs — eliminated candidates may still receive contributions or file amendments for weeks after their loss. Their totals stay accurate in the record. But **only the 10 advancing candidates flow into the homepage "Money on the field" aggregate** (see `build_pdc_aggregate_sentence` in the generator, which filters by `primary_result.advanced_to_general`). Eliminated candidates' PDC totals are historical, not "on the field."

**Treat any candidate whose `raised` value moved as a MECHANICAL update** (auto-apply per Step 5). If the refresh script fails entirely, proceed with the rest of the scan and report the failure in the digest. Do NOT block on it.

### Step 2B — Per-candidate lightweight scan

**Only for the 10 advancing candidates.** Do NOT scan eliminated candidates weekly.

For each of the 10 advancing candidates, run web search covering the **last 7 days** using the `pplx_sdk` primitives:

```python
python -m pplx_sdk.exec << 'PY'
save_and_print(pplx_sdk.search.web("{candidate name} Washington Supreme Court 2026 endorsement"))
PY
```

The runbook's older reference to `search_web` with `recency_filter="week"` is deprecated — that tool is no longer available. Use `pplx_sdk.search.web` (see the `search` skill for the full guide). Recency isn't a first-class filter; write queries that include time hints ("September 2026", "this week", "November general election") when you need recent results.

If `pplx_sdk` is unavailable, fall back to `pplx_sdk.content.fetch` on the candidate's campaign site, voter pamphlet URL, and PDC profile — but do NOT block the scan.

Look for:
- **General-election endorsements** (BIAW, Realtors PAC, WEA-PAC, AFSCME, FOP, newspapers, bar associations) — many groups re-endorse or issue fresh general-election endorsements after the primary
- **Public statements** on tax policy, ESSB 6346, Culliton, Quinn
- **Court rulings or opinions** authored or joined (for sitting judges/justices)
- **Fundraising surges or drops** (new PDC reports)
- **General-election IE activity** filed for or against any advancing candidate
- **Debate schedules, forum appearances, TV/radio interviews**
- **Media hits** that materially change viability or lean confidence

### Step 3 — Dedup findings

Hash each finding (SHA-256 of headline + URL). Skip anything in `recent_findings_hashes`. Add new hashes. Trim to last 90 days.

### Step 4 — Categorize each finding

**MECHANICAL (auto-apply):**
- **PDC fundraising totals** — handled by Step 2A's `refresh_pdc.py`. Every `raised`/`as_of` change goes straight to commit, no review.
- **Filing status change** (filed C-3/C-4 amendment, appointed a new treasurer, etc.) → mechanical update to relevant field.
- **Confirmed endorsement from a recognized organization with a primary source** → append to endorsements list on candidate page.
- Minor notes additions and link updates.
- **Eliminated-candidate front-runner flag correction** (see Guardrail #8 below): if a candidate has `front_runner: true` but `primary_result.advanced_to_general: false`, auto-clear the flag and log it. This is not a lean change — it's a data-integrity correction.

**REVIEW (queue for Viet):**
- Any **lean change** (scrap ↔ keep ↔ unclear) on an advancing candidate
- Any **confidence change** on an advancing candidate
- **front_runner flag** flips between two advancing candidates (which of the two general-election opponents has the edge)
- Any material contradiction of current candidate framing
- Any **legal/ethics issue** (judicial conduct commission filings, sanctions, lawsuits)
- Anything ambiguous

### Step 5 — Apply mechanical updates

For each MECHANICAL change:
1. Edit `candidates.json` directly with surgical precision (use `edit` tool, not full rewrite)
2. Log to `intel_state.json` → `auto_applied_changes_log` with timestamp, change, source URL
3. Regenerate pages, commit, push

Git workflow:
```bash
cd /home/user/workspace/culliton2026
python3 scripts/generate_candidate_pages.py
git stash -u && git pull --rebase origin main && git stash pop
git add data/candidates.json data/intel_state.json candidate/ index.html sitemap.xml
git -c user.email="agent@perplexity.ai" -c user.name="Culliton Agent" \
    commit -m "Weekly intel update YYYY-MM-DD: {brief summary}"
git push origin main
```
Use `api_credentials=["github"]`.

GitHub Pages rebuilds automatically ~30-45s after push. No separate deploy step is required for this project.

### Step 6 — Queue review items

For each REVIEW change:
- Append to `intel_state.json` → `pending_review_changes` array
- Each entry: `{id, candidate, current_state, proposed_state, evidence_urls, reasoning, confidence, opened_date}`
- Set `opened_date` to today (ISO 8601) so the stale-review sweep (Step 1) can age it out later.

### Step 7 — Check open questions for progress

For each entry in `open_questions`:
- Has any new finding moved the needle?
- If YES, append finding to the question's progress log and update status to `progressing`
- If a definitive answer emerged, mark `status: "resolved"` with resolution note
- Priority open questions after certification: `odonnell_lean` (P4 auto-advance means his lean determines the seat), general-election head-to-head reads for P1, P3, P5, P7.

### Step 8 — Send digest

Use the `custom-notifications` skill and `pplx-tool send_notification` (see the skill's guide for arguments — `send_notification` is no longer a direct connector). Digest body:

- **PDC refresh summary** (top 3 movers, with note if any eliminated candidate moved — for the record)
- **Auto-applied this week** (bullet list with source links)
- **Pending your review** (bullet list with proposed changes + reasoning)
- **Stale items auto-closed** (from Guardrail #7)
- **Open questions progress** (especially O'Donnell + general-election head-to-heads)
- **Quiet (advancing)** — briefly list any of the 10 with no new signals
- **Quiet (eliminated)** — one-line acknowledgment; do NOT enumerate

Channel: `in_app` only. URL: `https://www.culliton2026.org`.

### Step 9 — If a candidate enters, withdraws, or is DQ'd

The primary is over. New filings for these seats are no longer possible. If something exotic happens (a candidate withdraws between primary and general, a court DQs a candidate, an appointee replaces someone), queue for REVIEW with full research — do not auto-apply. Withdrawal → set `withdrawn: true` on the record, note in a `withdrawal_note` field with primary source, regenerate pages so the badge renders "Withdrew from general election," but do NOT remove the record from `candidates.json`.

## Guardrails (non-negotiable)

1. **Never auto-apply a lean change** on an advancing candidate. Always queue for review.
2. **Never auto-apply allegations or unverified claims.** Media hits alleging misconduct → queue for review with source links.
3. **Every change must have a primary source URL.** No "according to general reporting." Cite the specific outlet, document, or filing.
4. **If the scan returns zero new findings**, still send the digest — show open questions progress and confirm the scan ran. Silent crons get ignored.
5. **Token budget**: cap at ~30 search queries per scan (~3 per advancing candidate). Post-primary the surface area is smaller. If you blow past 45, summarize and exit.
6. **Don't touch widget logic, balance-of-power section, or HTML/CSS.** This cron is data-only. Exception: the generator's badge/aggregate logic is data-adjacent and may be updated when the data model changes — but flag those changes in the digest as "generator update," not a routine intel change.
7. **Stale-review sweep (NEW in v1.4).** At the top of Step 1, iterate `pending_review_changes`. For any entry where `opened_date` is more than **6 weeks** old AND no new supporting evidence has surfaced in the last two scans, auto-close as `resolution: "closed_stale"` with a note explaining nothing corroborated it. Move to `resolved_review_changes`. Log in `auto_applied_changes_log`. Report in the digest under "Stale items auto-closed." Rationale: the Aug 2026 review queue accumulated 9 items over 10 weeks that were all resolvable at High confidence but were never surfaced because the cron kept punting. A pending item that hasn't moved in 6 weeks is either not that important or was superseded by events (e.g., primary results). Don't let the queue rot.
8. **Eliminated-candidate front-runner correction (NEW in v1.4).** At the top of Step 1, iterate all candidates. Any candidate with `front_runner: true` AND `primary_result.advanced_to_general: false` gets auto-cleared to `front_runner: false` as MECHANICAL. Log it. Rationale: after the Aug 2026 primary, J. Michael Diaz's `front_runner` flag stayed `true` for four weeks post-loss. The balance-of-power widget used that flag as its default P3 pick and kept surfacing an eliminated candidate as the establishment front-runner. This is a data-integrity correction, not a lean change — it does not require review. **Do the correction even if the widget code already filters by `advanced_to_general`; the flag is data and other consumers may exist.**
9. **Scan only advancing candidates in Step 2B.** Do NOT run weekly search on the 6 eliminated candidates. Their pages are frozen. If a genuinely material story surfaces about an eliminated candidate (e.g., criminal charges), Viet will bring it up manually.
10. **Primary-result immutability.** Once `primary_result` is set on a candidate, it does not change without an explicit Viet-approved review item citing an official amendment from the WA Secretary of State. Certified results are the source of truth.

## Edge cases

- **PDC site down** → defer PDC checks to next week, note in digest
- **GitHub push conflict** → stash, pull, retry once; if fails again, queue all changes for review and abort deploy
- **CDN cache lag on JS/CSS updates** → if the cron updates any JS or CSS file, bump the `?v=YYYYMMDD` version pin on the `<script>`/`<link>` tag in `index.html` and the candidate-page template in `scripts/generate_candidate_pages.py`. Fastly/GitHub Pages caches these aggressively (~10 min TTL) and the version pin is how updates propagate immediately. This bit us in Sep 2026.
- **More than 10 review items queued** → digest body becomes summary; full list stays in `intel_state.json`
- **Withdrawn candidate** → see Step 9
- **DQ or court order removing a candidate from the ballot** → REVIEW item with full research; if confirmed by primary source, set `withdrawn: true` with `withdrawal_reason: "court order"` or similar

## Manual interventions Viet may do

- Edit `intel_state.json` directly to close an open question or change priorities
- Reject a pending review change (just say so in chat)
- Approve a pending review change (apply, commit, push)
- Ask for an ad-hoc scan on a specific candidate (advancing OR eliminated)
- Reopen an auto-closed stale item if new evidence surfaces

## Recommendation: how to handle eliminated candidates (adopted Sep 2026)

**Preserve as public record. Freeze from active scanning. Visibly mark on-page.**

Three alternatives were considered and rejected:

- **Delete the records.** Rejected. Erases journalistic ground truth. Voters and researchers may want to see who ran and what their lean was, even after they lost. Historical continuity matters.
- **Hide from the site entirely.** Rejected for the same reason, and because it would break inbound links (search engines, social shares, other coverage that linked to eliminated-candidate pages).
- **Keep scanning them weekly.** Rejected. Wastes token budget. The primary already answered the viability question for these candidates. If something material happens, Viet raises it.

The adopted policy: candidates with `primary_result.advanced_to_general: false` remain in `candidates.json` with a visible "Eliminated in primary (rank, %)" badge on their individual pages, but:

- Do NOT surface in the balance-of-power widget or its seat pickers (client-side JS already filters).
- Do NOT count in the homepage "Money on the field" PDC aggregate (generator already filters).
- Do NOT count in the "candidates advancing" stat (client-side JS already filters).
- Do NOT get scanned in Step 2B.
- Do NOT trigger notifications unless something genuinely material surfaces during an ad-hoc scan Viet requests.
- Pages remain reachable via direct URL and search engines for archival/reference use.

If a general-election candidate later withdraws or is DQ'd, they move to the same frozen state (Step 9).

---

*Runbook version 1.4 — created 2026-05-21. v1.1 (2026-06-04): switched search tooling. v1.2 (2026-07-03): 16-candidate roster locked. v1.3 (2026-08-06): post-primary interim notes. v1.4 (2026-09-01): full post-primary rewrite, added stale-review sweep (Guardrail 7), eliminated-front-runner correction (Guardrail 8), scan-only-advancing policy (Guardrail 9), primary-result immutability (Guardrail 10), CDN cache-bust note, and the eliminated-candidate handling recommendation.*
