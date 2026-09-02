# Weekly Candidate Intel Scan — Cron Runbook

**Site:** culliton2026.org
**Owner:** Viet Nguyen
**Cadence:** Thursdays 7:00 AM PT (with dynamic cadence changes in the ballot-return window — see "General-election phase calendar")
**Last manually updated:** 2026-09-01
**Version:** 1.5

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

## General-election phase calendar

The cron's behavior changes across four phases keyed to the WA 2026 general election calendar ([WA SOS elections calendar](https://www.sos.wa.gov/elections/calendar), [WA SOS current election info](https://www.sos.wa.gov/elections/voters/helpful-information/current-election-information)). At the top of every scan, determine the current phase from today's date and adjust behavior accordingly.

| Phase | Dates | Cadence | Scan intensity | Digest cadence |
|---|---|---|---|---|
| **A. Post-primary lull** | Aug 21 → Sept 17 | Weekly Thursday | Light (endorsement watch, PDC drift) | Weekly |
| **B. Awareness ramp** | Sept 18 → Oct 15 | Weekly Thursday | Full (endorsements, IE money, debates, media) | Weekly |
| **C. Ballot-return window** | Oct 16 → Nov 3 | **Twice weekly** — Monday + Thursday 7am PT | Full + IE-money priority + late-hit watch | Twice weekly |
| **D. Certification window** | Nov 4 → Nov 24 | Every Monday | Results tracking, close-race watch, certification signals | Weekly |
| **E. Post-certification archive** | Nov 25+ | Monthly (first Thursday) | Freeze the site; log any post-election legal action; PDC final reports | Monthly |

**Key dates driving these boundaries:**

- **Sept 18, 2026**: Military and overseas ballots mailed — the first ballots hit voters. Marks the start of the campaign's public-attention window.
- **Oct 16, 2026**: General-election ballots mailed to all registered voters. Every WA voter has a ballot in hand within a week. This is the highest-attention, highest-manipulation-risk window.
- **Oct 26, 2026**: Deadline for online/mail voter registration (in-person registration continues through Election Day).
- **Nov 3, 2026**: Election Day. Ballots must be postmarked or dropped in a box by 8pm PT.
- **Nov 23-24, 2026**: Late military/overseas ballots must be received by county elections offices ([866 Our Vote WA](https://866ourvote.org/state/washington/)). Certification follows immediately.
- **~Nov 24, 2026**: Counties certify. WA SOS certifies statewide shortly after.

### Phase transitions (auto-detect at Step 1)

Compute the phase at the top of Step 1 from today's date, using these boundaries:

```python
from datetime import date
today = date.today()
if   today < date(2026, 9, 18):  phase = "A_post_primary_lull"
elif today < date(2026, 10, 16): phase = "B_awareness_ramp"
elif today <= date(2026, 11, 3): phase = "C_ballot_return"
elif today <= date(2026, 11, 24): phase = "D_certification"
else:                              phase = "E_archive"
```

Persist `phase` and `phase_entered_date` to `intel_state.json` on transition. Include the current phase in every digest header (e.g., "Culliton 2026 intel — Phase C (ballot-return), Day 5 of 19"). This gives Viet an instant read on where in the campaign the cron thinks it is.

### Adding the Monday scan in Phase C

When the Thursday scan on **Oct 15** detects the transition into Phase C, it should:

1. Schedule a new cron using `pplx-tool schedule_cron` with cron expression `0 14 * * 1` (Monday 7am PT = 14:00 UTC), same task text as the Thursday cron, name "Culliton 2026 Monday ballot-return scan." Store the returned `cron_id` in `intel_state.json` as `monday_scan_cron_id`.
2. When the Monday scan on **Nov 9** (first Monday after Nov 3) runs and detects the transition into Phase D, it should delete the Monday cron using the stored ID.
3. Similarly, when the Thursday scan on **Nov 26** detects the transition into Phase E, downgrade the primary Thursday cron to monthly using `pplx-tool schedule_cron update` with cron `0 14 1-7 * 4` (first Thursday of the month, 14:00 UTC).

If `pplx-tool schedule_cron` calls fail, log in the digest and continue on the existing cadence — do NOT escalate to user.

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

Look for (all phases):
- **General-election endorsements** (BIAW, Realtors PAC, WEA-PAC, AFSCME, FOP, newspapers, bar associations, Seattle Times ed board, Stranger, Spokesman-Review, Tri-City Herald, Yakima Herald-Republic) — many groups re-endorse or issue fresh general-election endorsements after the primary
- **Public statements** on tax policy, ESSB 6346, Culliton, Quinn
- **Court rulings or opinions** authored or joined (for sitting judges/justices)
- **Fundraising surges or drops** (new PDC reports)
- **General-election IE activity** filed for or against any advancing candidate
- **Debate schedules, forum appearances, TV/radio interviews**
- **Media hits** that materially change viability or lean confidence

**Phase B addenda (Sept 18 → Oct 15) — awareness ramp:**
- **Voter pamphlet copy**: WA SOS posts the general-election voter pamphlet statements. Cross-check what each of the 10 advancing candidates chose to lead with in their general-election statement vs. their primary statement. Material shift in tone or emphasis is a REVIEW item; identical repost is a MECHANICAL cross-link.
- **Endorsement re-issuance**: Track which orgs re-endorse for the general vs. only endorsed for primary. New general endorsements are MECHANICAL; withdrawn endorsements are REVIEW.
- **Head-to-head polling** (if any surfaces — rare for WA judicial races): REVIEW.

**Phase C addenda (Oct 16 → Nov 3) — ballot-return window (Monday + Thursday):**
- **IE money is priority #1**. Query PDC's C-6 independent expenditure endpoint (Socrata `mvw3-b9tk`) for any new filings mentioning our 10 candidates' names or seat numbers. Late-cycle IE dumps are the highest-leverage last-minute signal.
- **Late-hit watch**: any negative attack ad, mailer, or media hit landing in the last 2 weeks. These are the highest bad-faith risk and the highest chance of moving a race. Log the source, the funder, and the claim. If the claim is defamatory or factually testable, run one search to confirm/deny and note in `late_hit_log` in `intel_state.json`.
- **Debate coverage**: TVW, Seattle CityClub, WSBA candidate forums typically schedule in this window. Log any that occurred, with links to recordings if available.
- **Ballot-drop-rate coverage**: county elections offices publish daily return rates. Not per-candidate signal, but relevant context. One-line note in the digest.
- **Voter deadline reminders**: Oct 26 (mail/online registration deadline). Do NOT push voter-mobilization content — this site is not a GOTV site — but log the deadline pass so the digest header reflects it.

**Phase D addenda (Nov 4 → Nov 24) — certification window (Monday only):**
- **Results tracking**: pull nightly county-tabulated results from WA SOS results feed. Update a lightweight `general_result_progress` field on each of the 10 candidates with `{as_of, votes, pct, rank, source}`. This is MECHANICAL. Do NOT set a final `general_result` field until certification.
- **Close-race watch**: any race inside 2 percentage points at any point in the count is REVIEW-flagged for Viet's attention.
- **Recount thresholds**: WA mandatory recount at 0.5% margin (machine) or 0.25% (manual). If any of our races enters recount territory, REVIEW with primary source.
- **Post-certification finalization** (~Nov 24): once WA SOS certifies statewide, set `general_result` on each candidate mirroring the `primary_result` schema. This is MECHANICAL once certified. Add certification-day badges via the generator: "Elected to Position N (pct%)" or "Lost in general election (pct%)."

**Phase E addenda (Nov 25+) — archive:**
- Freeze the site. Change the homepage eyebrow to "2026 Washington Supreme Court election · archived."
- Monthly scan looks for: post-election legal action (recount petitions, election contests), final PDC C-4 reports (typically due 21 days after election), any post-election coverage of how the winners rule on Culliton-adjacent cases.
- Runbook itself needs a v2.0 rewrite for the archive phase. Queue that as a REVIEW item to Viet on the first Phase E scan.

### Step 3 — Dedup findings

Hash each finding (SHA-256 of headline + URL). Skip anything in `recent_findings_hashes`. Add new hashes. Trim to last 90 days.

### Step 4 — Categorize each finding

**MECHANICAL (auto-apply):**
- **PDC fundraising totals** — handled by Step 2A's `refresh_pdc.py`. Every `raised`/`as_of` change goes straight to commit, no review.
- **Filing status change** (filed C-3/C-4 amendment, appointed a new treasurer, etc.) → mechanical update to relevant field.
- **Confirmed endorsement from a recognized organization with a primary source** → append to endorsements list on candidate page.
- Minor notes additions and link updates.
- **Eliminated-candidate front-runner flag correction** (see Guardrail #8 below): if a candidate has `front_runner: true` but `primary_result.advanced_to_general: false`, auto-clear the flag and log it. This is not a lean change — it's a data-integrity correction.
- **Phase D**: nightly `general_result_progress` updates from WA SOS results feed. Final certified `general_result` once WA SOS certifies statewide (~Nov 24).

**REVIEW (queue for Viet):**
- Any **lean change** (scrap ↔ keep ↔ unclear) on an advancing candidate
- Any **confidence change** on an advancing candidate
- **front_runner flag** flips between two advancing candidates (which of the two general-election opponents has the edge)
- Any material contradiction of current candidate framing
- Any **legal/ethics issue** (judicial conduct commission filings, sanctions, lawsuits)
- Anything ambiguous
- **Phase C**: any late-hit attack ad or negative mailer with a testable factual claim; any withdrawn endorsement; any IE spend over $50k against a single candidate.
- **Phase D**: any race inside 2pp margin during count; any recount trigger; any election-contest filing.

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

Use the `custom-notifications` skill and `pplx-tool send_notification` (see the skill's guide for arguments — `send_notification` is no longer a direct connector). Digest title format:

> `Culliton 2026 intel — Phase {X} ({phase_name}), {N} new signals, {M} pending review`

Digest body (adjust per phase):

- **Phase header**: current phase, day-of-phase, next phase-transition date, upcoming deadlines (e.g., "Ballots mail Oct 16 (T-6 days)")
- **PDC refresh summary** (top 3 movers, with note if any eliminated candidate moved — for the record)
- **Phase C only — IE money watch**: any new C-6 filings, running total of IE spend for/against each of the 10 candidates
- **Phase C only — Late-hit log**: any negative attacks landed this scan cycle, with claim + primary-source check result
- **Phase D only — Results tracking**: running vote count per race, current margin, close-race flags, recount triggers
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
5. **Token budget** (phase-dependent): Phase A ~20 queries per scan, Phase B ~30, Phase C ~50 per Monday/Thursday run (IE money + late-hit watch expand the surface), Phase D ~25, Phase E ~10. Hard ceiling: 75 per run. If you hit the ceiling, summarize the remaining candidates in one paragraph and exit.
6. **Don't touch widget logic, balance-of-power section, or HTML/CSS.** This cron is data-only. Exception: the generator's badge/aggregate logic is data-adjacent and may be updated when the data model changes — but flag those changes in the digest as "generator update," not a routine intel change.
7. **Stale-review sweep (NEW in v1.4).** At the top of Step 1, iterate `pending_review_changes`. For any entry where `opened_date` is more than **6 weeks** old AND no new supporting evidence has surfaced in the last two scans, auto-close as `resolution: "closed_stale"` with a note explaining nothing corroborated it. Move to `resolved_review_changes`. Log in `auto_applied_changes_log`. Report in the digest under "Stale items auto-closed." Rationale: the Aug 2026 review queue accumulated 9 items over 10 weeks that were all resolvable at High confidence but were never surfaced because the cron kept punting. A pending item that hasn't moved in 6 weeks is either not that important or was superseded by events (e.g., primary results). Don't let the queue rot.
8. **Eliminated-candidate front-runner correction (NEW in v1.4).** At the top of Step 1, iterate all candidates. Any candidate with `front_runner: true` AND `primary_result.advanced_to_general: false` gets auto-cleared to `front_runner: false` as MECHANICAL. Log it. Rationale: after the Aug 2026 primary, J. Michael Diaz's `front_runner` flag stayed `true` for four weeks post-loss. The balance-of-power widget used that flag as its default P3 pick and kept surfacing an eliminated candidate as the establishment front-runner. This is a data-integrity correction, not a lean change — it does not require review. **Do the correction even if the widget code already filters by `advanced_to_general`; the flag is data and other consumers may exist.**
9. **Scan only advancing candidates in Step 2B.** Do NOT run weekly search on the 6 eliminated candidates. Their pages are frozen. If a genuinely material story surfaces about an eliminated candidate (e.g., criminal charges), Viet will bring it up manually.
10. **Primary-result immutability.** Once `primary_result` is set on a candidate, it does not change without an explicit Viet-approved review item citing an official amendment from the WA Secretary of State. Certified results are the source of truth.
11. **General-result immutability (NEW in v1.5).** Same rule for `general_result`. Interim `general_result_progress` snapshots (Phase D) are mutable and mechanical; the final `general_result` field is set exactly once, on WA SOS statewide certification, and does not change without a Viet-approved review item citing an official amendment.
12. **No GOTV or mobilization content (NEW in v1.5).** This site is an independent, nonpartisan voter guide. Do NOT add "vote by X date" banners, ballot-return countdowns, drop-box locators, or any language that reads as get-out-the-vote messaging. Log deadlines in the digest header for Viet's awareness, but do NOT surface them on the public site. Preserves nonpartisan positioning.
13. **Late-hit factual-claim discipline (NEW in v1.5, Phase C only).** If a late-hit attack surfaces a testable factual claim about one of our candidates (e.g., "Candidate X ruled that Y"), run one and only one search to check the claim against primary sources (court opinions, official records). Log the finding in `late_hit_log`. Do NOT publish a rebuttal on the site — the site is descriptive, not reactive. But do note the check in the digest so Viet has an informed read.

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

*Runbook version 1.5 — created 2026-05-21. v1.1 (2026-06-04): switched search tooling. v1.2 (2026-07-03): 16-candidate roster locked. v1.3 (2026-08-06): post-primary interim notes. v1.4 (2026-09-01): full post-primary rewrite, added stale-review sweep (Guardrail 7), eliminated-front-runner correction (Guardrail 8), scan-only-advancing policy (Guardrail 9), primary-result immutability (Guardrail 10), CDN cache-bust note, and the eliminated-candidate handling recommendation. v1.5 (2026-09-01): general-election phase calendar (A–E), phase-detection code, dynamic cadence including twice-weekly Monday+Thursday in Phase C ballot-return window, phase-specific scan addenda (voter pamphlet cross-check, IE money priority, late-hit watch, close-race and recount tracking, `general_result_progress` schema), phase-dependent token budgets, general-result immutability (Guardrail 11), no-GOTV-content policy (Guardrail 12), late-hit factual-claim discipline (Guardrail 13). Next expected rewrite: v2.0 for Phase E archive.*
