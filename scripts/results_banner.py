"""Insert the post-election results banner and candidate archive notes (idempotent).
Edit data/general_results.json, then run this (generate_candidate_pages.py also calls it)."""
import json, os, re, glob, html
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B0, B1 = "<!-- RESULTS_BANNER:START -->", "<!-- RESULTS_BANNER:END -->"
A0, A1 = "<!-- ARCHIVE_NOTE:START -->", "<!-- ARCHIVE_NOTE:END -->"
SKIP = {"og-source.html"}

def load():
    return json.load(open(os.path.join(ROOT, "data", "general_results.json")))

def banner(r):
    items = []
    for pos, ((_, a, ap), (_, b, bp)) in r["races"].items():
        tag = '<span class="results-banner__close">Close</span>' if pos in r["close"] else ""
        items.append(f'      <li>Pos. {pos}: <b>{html.escape(a)}</b> {ap:.1f}%, {html.escape(b)} {bp:.1f}%{tag}</li>')
    return f"""{B0}
<aside class="results-banner" role="status" aria-label="Unofficial election results">
  <div class="results-banner__inner">
    <span class="results-banner__label">Unofficial results</span>
    <ul class="results-banner__races">
{chr(10).join(items)}
    </ul>
    <p class="results-banner__note">Counting continues. {html.escape(r['close_note'])} Nothing is official until the state certifies on {r['certify_date']}. <a href="{r['source_url']}">Secretary of State results</a>, as of {r['as_of'].rstrip('.')}.</p>
  </div>
</aside>
{B1}"""

def note(r, c):
    pos = str(c["position"]); race = r["races"].get(pos)
    res = ", ".join(f"{html.escape(n)} {p:.1f}%" for _, n, p in race) if race else ""
    if c["primary_result"].get("advanced_to_general"):
        line = f"Unofficial result: {res} ({r['as_of'].split(',')[0]})."
    else:
        pct = c["primary_result"].get("pct")
        line = f"Eliminated in the Aug. 4 primary ({pct:.1f}%). Unofficial Position {pos} result: {res} ({r['as_of'].split(',')[0]})."
    return f"""{A0}
<div class="archive-note" role="note"><strong>Archived after the Nov. 3 election.</strong>This page is frozen and won't be updated. {line} Fundraising and outside-money figures are as of Nov. 2. Final numbers: <a href="{r['source_url']}">Secretary of State</a>.</div>
{A1}"""

def put(s, block, start, end, anchor_re):
    if start in s:
        return re.sub(re.escape(start) + r".*?" + re.escape(end), lambda m: block, s, flags=re.S)
    m = re.search(anchor_re, s)
    if not m:
        return None
    return s[:m.end()] + "\n" + block + "\n" + s[m.end():]

def apply_all():
    r = load(); b = banner(r)
    cands = {c["slug"]: c for c in json.load(open(os.path.join(ROOT, "data", "candidates.json")))["candidates"]}
    done = []
    for p in sorted(glob.glob(os.path.join(ROOT, "*.html")) + glob.glob(os.path.join(ROOT, "candidate", "*.html"))):
        if os.path.basename(p) in SKIP: continue
        s = open(p, encoding="utf-8").read()
        s2 = put(s, b, B0, B1, r"<body[^>]*>")
        if s2 is None: print("WARN no <body>:", p); continue
        slug = os.path.splitext(os.path.basename(p))[0]
        if os.path.basename(os.path.dirname(p)) == "candidate" and slug in cands:
            s3 = put(s2, note(r, cands[slug]), A0, A1, r'<main class="candidate-detail">')
            if s3 is None: print("WARN no main:", p)
            else: s2 = s3
        if s2 != s:
            open(p, "w", encoding="utf-8").write(s2); done.append(os.path.relpath(p, ROOT))
    print(f"Results banner: {len(done)} file(s) updated")

if __name__ == "__main__":
    apply_all()
