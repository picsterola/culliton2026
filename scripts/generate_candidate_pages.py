#!/usr/bin/env python3
"""
Generate static candidate detail pages from data/candidates.json.

For each candidate, writes a fully server-side rendered HTML file to
/candidate/{slug}.html with:
- Unique <title>, meta description, Open Graph, Twitter Card tags
- Person + WebPage JSON-LD structured data
- Full rendered content (no JS dependency for content visibility)
- Canonical URLs pointing to https://www.culliton2026.org/candidate/{slug}.html
- Internal links to explainer anchors and back to index
- Outbound links to campaign sites and primary sources

Also updates sitemap.xml to include every candidate page.

Run with: python3 scripts/generate_candidate_pages.py
"""

import json
import os
import re
import sys
from datetime import date
from html import escape as html_escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(ROOT, "data", "candidates.json")
OUT_DIR = os.path.join(ROOT, "candidate")
SITEMAP_PATH = os.path.join(ROOT, "sitemap.xml")
INDEX_PATH = os.path.join(ROOT, "index.html")
BASE_URL = "https://www.culliton2026.org"


def esc(s):
    """HTML-escape a string, returning '' for None."""
    if s is None:
        return ""
    return html_escape(str(s), quote=True)


_SENT_SPLIT = re.compile(r'(?<=[.!?])\s+(?=[A-Z"\'“‘(])')


def paragraphize(text, css_class="", target_words=55, max_words=85):
    """Split a long single-block string into multiple <p> tags.

    Strategy: split into sentences, then greedily group sentences into
    paragraphs of roughly `target_words` words. Start a new paragraph
    once the running word count exceeds `target_words`. Never let a
    single paragraph exceed `max_words` unless one sentence is itself
    longer. If the input already contains blank-line paragraph breaks,
    honor them and split each chunk further if needed.
    """
    if not text:
        return ""
    text = str(text).strip()
    cls_attr = f' class="{html_escape(css_class, quote=True)}"' if css_class else ""

    # Honor any existing blank-line paragraph breaks first.
    pre_chunks = [p.strip() for p in re.split(r'\n\s*\n', text) if p.strip()]

    out_paras = []
    for chunk in pre_chunks:
        # Collapse single newlines to spaces inside a chunk.
        chunk = re.sub(r'\s+', ' ', chunk).strip()
        sentences = _SENT_SPLIT.split(chunk)
        if not sentences:
            continue
        # If the whole chunk is short, keep it as one paragraph.
        if sum(len(s.split()) for s in sentences) <= max_words:
            out_paras.append(chunk)
            continue
        cur = []
        cur_words = 0
        for s in sentences:
            sw = len(s.split())
            if cur and (cur_words + sw > target_words):
                out_paras.append(' '.join(cur).strip())
                cur = [s]
                cur_words = sw
            else:
                cur.append(s)
                cur_words += sw
        if cur:
            out_paras.append(' '.join(cur).strip())

    return "\n      ".join(f"<p{cls_attr}>{html_escape(p, quote=True)}</p>" for p in out_paras)


def lean_label(lean):
    return {
        "scrap": "Likely to scrap Culliton (clear the way for an income tax)",
        "keep": "Likely to keep Culliton (defeat the income tax)",
        "unclear": "Position not yet clear from public record",
    }.get(lean, "")


def lean_short_label(lean):
    return {
        "scrap": "Scrap the rule",
        "keep": "Keep the rule",
        "unclear": "Position not yet clear",
    }.get(lean, "")


def render_signals(signals):
    if not signals:
        return ""
    def signal_text(t):
        # Use paragraphize but with wider thresholds — most signals are
        # short enough to stay as one block.
        return paragraphize(t, css_class='signal__text', target_words=70, max_words=110)
    items = "".join(
        f"""
            <li class="signal">
              <span class="signal__type">{esc(s.get('type'))}</span>
              {signal_text(s.get('text'))}
            </li>"""
        for s in signals
    )
    return f"""
    <section class="signals">
      <h2 class="signals__heading">What the record actually shows</h2>
      <p class="signals__intro">
        Facts pulled from public sources: who appointed them, what they did before, what they've said or written, who's backing them. We're not predicting any vote. <a href="../explainer.html">Why these categories?</a>
      </p>
      <ul class="signal-list">{items}
      </ul>
    </section>"""


def render_deep_read(c):
    deep = c.get("deep_read")
    expanded = c.get("expanded_signals") or []
    if not deep and not expanded:
        return ""

    expanded_html = ""
    if expanded:
        items = "".join(
            f"""
            <li class="deep-read__signal">
              <div class="deep-read__signal-type">{esc(s.get('type'))}</div>
              {paragraphize(s.get('text'), css_class='deep-read__signal-text')}
            </li>"""
            for s in expanded
        )
        expanded_html = f"""
        <ul class="deep-read__signals">{items}
        </ul>"""

    deep_html = paragraphize(deep, css_class='deep-read__lede') if deep else ""

    return f"""
    <section class="deep-read deep-read--{esc(c.get('lean') or 'unclear')}">
      <div class="deep-read__eyebrow">Deep read</div>
      <h2 class="deep-read__heading">How this candidate is likely to rule, and why.</h2>
      {deep_html}{expanded_html}
      <p class="deep-read__footnote">An analytical read on public signals. Not a prediction of any individual vote.</p>
    </section>"""


def render_questions(questions):
    if not questions:
        return ""
    items = "".join(f"<li>{esc(q)}</li>" for q in questions)
    return f"""
    <section class="questions-block">
      <h3>Questions a voter might ask this candidate</h3>
      <ol>{items}</ol>
      <p class="questions-block__caveat">
        Phrased to comply with Washington's Code of Judicial Conduct, which prohibits
        candidates from pledging votes on specific cases or issues likely to come before
        the court. Methodology questions are permitted.
      </p>
    </section>"""


def render_sources(c):
    sources = list(c.get("sources") or []) + list(c.get("additional_sources") or [])
    if not sources:
        return ""
    items = "".join(
        f'<li><a href="{esc(s.get("url"))}" rel="noopener" target="_blank">{esc(s.get("label"))}</a></li>'
        for s in sources
    )
    response_url = f"../response.html?c={c['slug']}"
    return f"""
    <section class="sources-block">
      <h3>Sources</h3>
      <ul>
        {items}
        <li><a href="{response_url}">Are you {esc(c['name'])} or their campaign? Submit a response →</a></li>
      </ul>
    </section>"""


def render_campaign_cta(c):
    site = c.get("campaign_website")
    if site:
        return f"""
    <aside class="campaign-cta">
      <div class="campaign-cta__label">Campaign website</div>
      <div class="campaign-cta__actions">
        <a class="campaign-cta__btn campaign-cta__btn--primary" href="{esc(site)}" rel="noopener" target="_blank">
          Visit {esc(c['name'])}'s campaign site →
        </a>
      </div>
      <p class="campaign-cta__disclaimer">External link. We do not endorse any candidate. Listing campaign sites is purely informational.</p>
    </aside>"""

    status = c.get("campaign_website_status")
    if status in ("none", "broken"):
        note = c.get("campaign_website_note", "")
        note_text = f" {esc(note)}" if note else ""
        return f"""
    <aside class="campaign-cta campaign-cta--missing">
      <div class="campaign-cta__label">Campaign website</div>
      <p class="campaign-cta__missing-text">No active campaign site found.{note_text}</p>
    </aside>"""
    return ""


def render_lean_banner(c):
    lean = c.get("lean")
    if not lean:
        return ""
    confidence = c.get("lean_confidence")
    one_liner = c.get("one_liner")
    confidence_html = (
        f'<span class="lean-banner__confidence">Confidence: {esc(confidence)}</span>'
        if confidence
        else ""
    )
    one_liner_html = (
        f'<p class="lean-banner__one-liner">{esc(one_liner)}</p>'
        if one_liner
        else ""
    )
    return f"""
    <div class="lean-banner lean-banner--{esc(lean)}">
      <span class="lean-dot lean-dot--{esc(lean)} lean-banner__dot"></span>
      <div class="lean-banner__content">
        <div class="lean-banner__label">Our read on this candidate</div>
        <div class="lean-banner__short">{esc(c.get('lean_short') or '')}</div>
        {confidence_html}
        {one_liner_html}
      </div>
    </div>"""


def render_badges(c):
    badges = []
    if c.get("incumbent"):
        badges.append('<span class="badge badge--incumbent">Currently sitting</span>')
    appointed_by = (c.get("appointed_by") or "").lower()
    if "ferguson" in appointed_by:
        badges.append('<span class="badge">Ferguson appointee</span>')
    elif "inslee" in appointed_by:
        badges.append('<span class="badge">Inslee appointee</span>')
    return "".join(badges)


def _fmt_money(n):
    """Format a number as $X,XXX with no cents. None / non-numeric -> ''."""
    try:
        return f"${int(round(float(n))):,}"
    except (TypeError, ValueError):
        return ""


def _fmt_date_friendly(s):
    """Turn '2026-05-12' into 'May 12, 2026'. Leave anything else as-is."""
    if not s:
        return ""
    try:
        from datetime import datetime
        return datetime.strptime(str(s), "%Y-%m-%d").strftime("%b %-d, %Y")
    except Exception:
        return str(s)


def render_fundraising_dd(c):
    """Render the Fundraising cell. Prefer the structured `pdc` object
    (clickable dollar amount + 'as of' date + PDC link). Fall back to the
    free-text `fundraising` field if no `pdc` block exists."""
    pdc = c.get("pdc") or {}
    url = pdc.get("pdc_url")
    raised = pdc.get("raised")
    as_of = _fmt_date_friendly(pdc.get("as_of"))

    if url and raised is not None:
        amount = _fmt_money(raised)
        url_esc = html_escape(url, quote=True)
        return (
            f'<a class="fact-strip__money" href="{url_esc}" '
            f'target="_blank" rel="noopener" '
            f'aria-label="View latest PDC filing for {esc(c.get("name"))} (raised {amount})">'
            f'{amount}</a>'
            f'<span class="fact-strip__as-of"> raised as of {esc(as_of)}</span>'
        )
    if url and raised is None:
        # Not filed yet, but we have a PDC profile URL
        url_esc = html_escape(url, quote=True)
        return (
            f'<a class="fact-strip__money fact-strip__money--unfiled" href="{url_esc}" '
            f'target="_blank" rel="noopener">No filing yet</a>'
            + (f'<span class="fact-strip__as-of"> as of {esc(as_of)}</span>' if as_of else '')
        )
    # Fall back to free-text fundraising note
    return esc(c.get("fundraising"))


def render_fact_strip(c):
    return f"""
    <dl class="fact-strip">
      <div class="fact-strip__item"><dt>Seat</dt><dd>{esc(c.get('position_label'))} — {esc(c.get('seat_context'))}</dd></div>
      <div class="fact-strip__item"><dt>Appointing authority</dt><dd>{esc(c.get('appointed_by'))}</dd></div>
      <div class="fact-strip__item"><dt>Background</dt><dd>{esc(c.get('prior_practice'))}</dd></div>
      <div class="fact-strip__item"><dt>Reported endorsements</dt><dd>{esc(c.get('endorsements'))}</dd></div>
      <div class="fact-strip__item"><dt>Fundraising</dt><dd>{render_fundraising_dd(c)}</dd></div>
    </dl>"""


def build_meta_description(c):
    """Build a 150-160 char meta description that includes the candidate name,
    position, lean signal, and key fact."""
    parts = [
        c["name"],
        "is running for",
        c.get("position_label", "the Washington Supreme Court"),
    ]
    if c.get("seat_context"):
        parts.append(f"({c['seat_context']})")
    parts.append("in the 2026 election.")

    one_liner = c.get("one_liner")
    if one_liner:
        # Truncate one_liner to fit
        desc = " ".join(parts) + " " + one_liner
    else:
        lean = c.get("lean_short")
        if lean:
            desc = " ".join(parts) + f" Read: {lean}."
        else:
            desc = " ".join(parts)

    # Trim to ~160 chars
    if len(desc) > 160:
        desc = desc[:157].rstrip() + "..."
    return desc


def build_person_jsonld(c):
    """Build Person + WebPage JSON-LD for this candidate."""
    page_url = f"{BASE_URL}/candidate/{c['slug']}.html"

    person = {
        "@type": "Person",
        "@id": f"{page_url}#person",
        "name": c["name"],
        "jobTitle": c.get("current_role", "Candidate, Washington Supreme Court"),
        "description": c.get("one_liner", ""),
    }
    if c.get("photo"):
        person["image"] = f"{BASE_URL}/{c['photo']}"
    if c.get("campaign_website"):
        person["url"] = c["campaign_website"]
    person["affiliation"] = {
        "@type": "Organization",
        "name": "Washington Supreme Court",
        "url": "https://www.courts.wa.gov/",
    }

    webpage = {
        "@type": "WebPage",
        "@id": f"{page_url}#webpage",
        "url": page_url,
        "name": f"{c['name']} — 2026 Washington Supreme Court candidate",
        "isPartOf": {"@id": f"{BASE_URL}/#website"},
        "about": {"@id": f"{page_url}#person"},
        "breadcrumb": {"@id": f"{page_url}#breadcrumb"},
    }

    breadcrumb = {
        "@type": "BreadcrumbList",
        "@id": f"{page_url}#breadcrumb",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": 1,
                "name": "Candidates",
                "item": f"{BASE_URL}/#candidates",
            },
            {
                "@type": "ListItem",
                "position": 2,
                "name": c.get("position_label", "Position"),
                "item": f"{BASE_URL}/#candidates",
            },
            {
                "@type": "ListItem",
                "position": 3,
                "name": c["name"],
                "item": page_url,
            },
        ],
    }

    graph = {
        "@context": "https://schema.org",
        "@graph": [person, webpage, breadcrumb],
    }
    return json.dumps(graph, ensure_ascii=False, indent=2)


def render_page(c):
    """Render one candidate's static HTML page."""
    slug = c["slug"]
    name = c["name"]
    page_url = f"{BASE_URL}/candidate/{slug}.html"
    title = f"{name} — {c.get('position_label', 'Position')} candidate, 2026 WA Supreme Court · Culliton 2026"
    description = build_meta_description(c)
    photo_path = c.get("photo", "images/og-card.png")
    og_image = f"{BASE_URL}/{photo_path}" if photo_path else f"{BASE_URL}/images/og-card.png"

    jsonld = build_person_jsonld(c)

    badges_html = render_badges(c)
    campaign_html = render_campaign_cta(c)
    lean_banner_html = render_lean_banner(c)
    fact_html = render_fact_strip(c)
    signals_html = render_signals(c.get("signals"))
    deep_read_html = render_deep_read(c)
    questions_html = render_questions(c.get("questions"))
    sources_html = render_sources(c)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{esc(title)}</title>
  <meta name="description" content="{esc(description)}">

  <link rel="canonical" href="{page_url}">

  <meta property="og:type" content="profile">
  <meta property="og:site_name" content="Culliton 2026">
  <meta property="og:title" content="{esc(name)} — {esc(c.get('position_label', 'Position'))} candidate, 2026 WA Supreme Court">
  <meta property="og:description" content="{esc(description)}">
  <meta property="og:url" content="{page_url}">
  <meta property="og:image" content="{esc(og_image)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="profile:first_name" content="{esc(name.split(' ')[0])}">
  <meta property="profile:last_name" content="{esc(' '.join(name.split(' ')[1:]))}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{esc(name)} — {esc(c.get('position_label', 'Position'))} candidate, 2026 WA Supreme Court">
  <meta name="twitter:description" content="{esc(description)}">
  <meta name="twitter:image" content="{esc(og_image)}">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,300..700;1,8..60,300..700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../css/styles.css">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%231f3d2b'/%3E%3Ctext x='16' y='22' font-family='Georgia,serif' font-size='18' font-style='italic' fill='%23fbf8f1' text-anchor='middle'%3EC%3C/text%3E%3C/svg%3E">

  <script type="application/ld+json">
{jsonld}
  </script>
</head>
<body>

<header class="site-header">
  <div class="site-header__inner">
    <a href="../index.html" class="site-header__brand">
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect width="32" height="32" rx="4" fill="var(--color-primary)"/>
        <text x="16" y="22" font-family="Source Serif 4, Georgia, serif" font-size="18" font-style="italic" fill="var(--color-text-inverse)" text-anchor="middle" font-weight="500">C</text>
      </svg>
      <span><span class="site-header__brand-text-full">Culliton</span> <span class="brand-year">2026</span></span>
    </a>
    <nav class="site-nav">
      <a href="../index.html">Candidates</a>
      <a href="../explainer.html">The cases</a>
      <a href="../bench.html">The bench</a>
      <a href="../about.html">About</a>
      <button class="theme-toggle" data-theme-toggle aria-label="Toggle theme"></button>
    </nav>
  </div>
</header>

<main class="candidate-detail">
  <div class="container">
    <nav class="breadcrumb" aria-label="breadcrumb">
      <a href="../index.html">All candidates</a>
      <span class="breadcrumb__sep">/</span>
      <span>{esc(c.get('position_label'))} — {esc(c.get('seat_context'))}</span>
    </nav>

    <header class="candidate-header">
      <div class="candidate-header__photo">
        <img src="../{esc(photo_path)}" alt="Portrait of {esc(name)}">
      </div>
      <div>
        <div class="candidate-header__meta">{esc(c.get('position_label'))} · {esc(c.get('seat_context'))}</div>
        <h1 class="candidate-header__name">{esc(name)}</h1>
        <p class="candidate-header__role">{esc(c.get('current_role'))}</p>
        <div class="candidate-badges">{badges_html}</div>
      </div>
    </header>

    {campaign_html}
    {lean_banner_html}
    {fact_html}
    {signals_html}
    {deep_read_html}
    {questions_html}
    {sources_html}

    <aside class="related-cases" aria-labelledby="rc-heading-{esc(slug)}">
      <header class="section-header section-header--compact">
        <div class="section-eyebrow">The legal context</div>
        <h2 id="rc-heading-{esc(slug)}" class="section-headline">The precedents this seat will rule on.</h2>
      </header>
      <ul class="related-cases__list">
        <li><a href="../explainer.html#culliton"><strong>Culliton v. Chase (1933)</strong> — the keystone ruling. Income is property; a graduated income tax violates the uniformity clause.</a></li>
        <li><a href="../explainer.html#jensen"><strong>Jensen v. Henneford (1936)</strong> — the precedent doing the most direct work against ESSB 6346.</a></li>
        <li><a href="../explainer.html#quinn"><strong>Quinn v. State (2023)</strong> — capital gains upheld 7–2. The most recent test of the wall.</a></li>
        <li><a href="../explainer.html#essb-6346"><strong>ESSB 6346 (2026)</strong> — the 9.9% tax on income over $1M now pending before the court.</a></li>
      </ul>
    </aside>
  </div>
</main>

<footer class="site-footer">
  <div class="site-footer__inner">
    <div>
      <div class="site-footer__brand">Culliton 2026</div>
      <p class="site-footer__disclaimer">
        Nonpartisan, noncommercial civic publication. Signals are drawn from public records.
        Candidates and their campaigns may submit responses or corrections via the response form.
      </p>
    </div>
    <nav class="site-footer__links" aria-label="Footer">
      <a href="../explainer.html">The cases</a>
      <a href="../bench.html">The bench</a>
      <a href="../about.html">About</a>
      <a href="../response.html">Submit a response</a>
    </nav>
  </div>
</footer>

<script src="../js/main.js"></script>
</body>
</html>
"""


def _fmt_money_compact(n):
    """Format a dollar amount compactly: $1.2M, $820k, or $9,500."""
    try:
        n = float(n)
    except (TypeError, ValueError):
        return ""
    if n >= 1_000_000:
        return f"${n/1_000_000:.2f}M".replace(".00M", "M")
    if n >= 10_000:
        return f"${int(round(n/1000)):,}k"
    return f"${int(round(n)):,}"


def build_pdc_aggregate_sentence(candidates):
    """Build the homepage PDC aggregate sentence. Returns the HTML fragment
    to live between PDC_AGGREGATE_START and PDC_AGGREGATE_END markers, or '' if
    we lack the data to say anything useful."""
    buckets = {"scrap": 0.0, "keep": 0.0, "unclear": 0.0}
    filers = {"scrap": 0, "keep": 0, "unclear": 0}
    totals = {"scrap": 0, "keep": 0, "unclear": 0}
    latest_as_of = None
    any_money = False
    for c in candidates:
        if c.get("withdrawn"):
            continue
        lean = c.get("lean", "unclear")
        if lean not in buckets:
            lean = "unclear"
        totals[lean] += 1
        pdc = c.get("pdc") or {}
        raised = pdc.get("raised")
        as_of = pdc.get("as_of")
        if raised is not None:
            try:
                buckets[lean] += float(raised)
                filers[lean] += 1
                any_money = True
            except (TypeError, ValueError):
                pass
        if as_of and (latest_as_of is None or as_of > latest_as_of):
            latest_as_of = as_of

    if not any_money:
        return ""

    scrap_amt = _fmt_money_compact(buckets["scrap"])
    keep_amt = _fmt_money_compact(buckets["keep"])
    unclear_amt = _fmt_money_compact(buckets["unclear"])
    as_of_friendly = _fmt_date_friendly(latest_as_of) if latest_as_of else ""

    # Ratio framing if scrap dwarfs keep (or vice versa)
    ratio_phrase = ""
    if buckets["keep"] > 0 and buckets["scrap"] > 0:
        ratio = buckets["scrap"] / buckets["keep"]
        if ratio >= 2:
            ratio_phrase = f", roughly {ratio:.1f}x more than the keep-coalition field"
        elif ratio <= 0.5:
            ratio_phrase = f", roughly {1/ratio:.1f}x less than the keep-coalition field"

    def _cnt(lean):
        # 'N of M' if some haven't filed, else just 'M'
        if filers[lean] < totals[lean]:
            return f'{filers[lean]} of {totals[lean]}'
        return str(totals[lean])

    sentence = (
        f'<p class="pdc-aggregate">'
        f'<strong>Money on the field.</strong> '
        f'The <em>scrap-the-rule</em> field ({_cnt("scrap")} candidates reporting) '
        f'has raised <strong>{scrap_amt}</strong>{ratio_phrase}. '
        f'The <em>keep-the-rule</em> field ({_cnt("keep")} reporting) has raised <strong>{keep_amt}</strong>. '
        f'The <em>not-enough-to-tell</em> field ({_cnt("unclear")} reporting) has raised <strong>{unclear_amt}</strong>. '
    )
    if as_of_friendly:
        sentence += f'PDC totals current as of <strong>{esc(as_of_friendly)}</strong>. '
    sentence += (
        'Click any dollar amount on a candidate\u2019s page to see the underlying filing.'
        '</p>'
    )
    return sentence


def update_index_aggregate(candidates, index_path):
    """Rewrite the PDC_AGGREGATE marker block in index.html."""
    if not os.path.exists(index_path):
        return False
    fragment = build_pdc_aggregate_sentence(candidates)
    with open(index_path, "r", encoding="utf-8") as f:
        html = f.read()
    start = "<!-- PDC_AGGREGATE_START -->"
    end = "<!-- PDC_AGGREGATE_END -->"
    if start not in html or end not in html:
        print("WARN: PDC_AGGREGATE markers not found in index.html", file=sys.stderr)
        return False
    pre, _, rest = html.partition(start)
    _, _, post = rest.partition(end)
    new_block = f"{start}\n      {fragment}\n      {end}" if fragment else f"{start}\n      {end}"
    new_html = pre + new_block + post
    if new_html != html:
        with open(index_path, "w", encoding="utf-8") as f:
            f.write(new_html)
        return True
    return False


def update_sitemap(candidates, today_iso):
    """Rewrite sitemap.xml to include all candidate pages."""
    main_urls = [
        ("https://www.culliton2026.org/", "weekly", "1.0"),
        ("https://www.culliton2026.org/explainer.html", "monthly", "0.9"),
        ("https://www.culliton2026.org/bench.html", "weekly", "0.8"),
        ("https://www.culliton2026.org/about.html", "monthly", "0.5"),
    ]
    candidate_urls = [
        (f"https://www.culliton2026.org/candidate/{c['slug']}.html", "weekly", "0.8")
        for c in candidates
    ]

    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for url, freq, prio in main_urls + candidate_urls:
        lines.append("  <url>")
        lines.append(f"    <loc>{url}</loc>")
        lines.append(f"    <lastmod>{today_iso}</lastmod>")
        lines.append(f"    <changefreq>{freq}</changefreq>")
        lines.append(f"    <priority>{prio}</priority>")
        lines.append("  </url>")
    lines.append("</urlset>")
    return "\n".join(lines) + "\n"


def main():
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    candidates = data["candidates"]
    os.makedirs(OUT_DIR, exist_ok=True)

    written = []
    for c in candidates:
        slug = c.get("slug")
        if not slug or not re.match(r"^[a-z0-9-]+$", slug):
            print(f"SKIP: bad slug {slug!r} for {c.get('name')}", file=sys.stderr)
            continue
        path = os.path.join(OUT_DIR, f"{slug}.html")
        html = render_page(c)
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)
        written.append(slug)

    today_iso = date.today().isoformat()
    sitemap = update_sitemap(candidates, today_iso)
    with open(SITEMAP_PATH, "w", encoding="utf-8") as f:
        f.write(sitemap)

    updated_index = update_index_aggregate(candidates, INDEX_PATH)

    print(f"Wrote {len(written)} candidate pages and updated sitemap.")
    print(f"Homepage PDC aggregate: {'updated' if updated_index else 'unchanged or missing markers'}")
    print("Pages:", ", ".join(written))


if __name__ == "__main__":
    main()
