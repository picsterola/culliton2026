// Candidate detail page renderer
(async function () {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("c");
  const root = document.getElementById("candidate-root");
  if (!slug || !root) {
    if (root) root.innerHTML = '<p style="padding: 4rem 0;">Candidate not specified. <a href="index.html">Back to index</a>.</p>';
    return;
  }

  let data;
  try {
    const res = await fetch("data/candidates.json");
    data = await res.json();
  } catch (err) {
    root.innerHTML = '<p>Could not load candidate data.</p>';
    return;
  }

  const c = data.candidates.find((x) => x.slug === slug);
  if (!c) {
    root.innerHTML = `<p>Candidate not found. <a href="index.html">Back to index</a>.</p>`;
    return;
  }

  document.title = `${c.name} · Culliton 2026`;

  // Campaign website CTA block — sits between header and lean banner
  let campaignHTML = '';
  if (c.campaign_website) {
    campaignHTML = `
    <aside class="campaign-cta">
      <div class="campaign-cta__label">Campaign website</div>
      <div class="campaign-cta__actions">
        <a class="campaign-cta__btn campaign-cta__btn--primary" href="${escapeAttr(c.campaign_website)}" rel="noopener" target="_blank">
          Visit ${escapeHTML(c.name)}'s campaign site →
        </a>
        ${c.campaign_donate ? `<a class="campaign-cta__btn campaign-cta__btn--ghost" href="${escapeAttr(c.campaign_donate)}" rel="noopener" target="_blank">Donate</a>` : ''}
      </div>
      <p class="campaign-cta__disclaimer">External link. We do not endorse any candidate. Listing campaign sites is purely informational.</p>
    </aside>`;
  } else if (c.campaign_website_status === 'none' || c.campaign_website_status === 'broken') {
    campaignHTML = `
    <aside class="campaign-cta campaign-cta--missing">
      <div class="campaign-cta__label">Campaign website</div>
      <p class="campaign-cta__missing-text">No active campaign site found.${c.campaign_website_note ? ' ' + escapeHTML(c.campaign_website_note) : ''}</p>
    </aside>`;
  }

  const leanBannerHTML = c.lean ? `
    <div class="lean-banner lean-banner--${escapeAttr(c.lean)}">
      <span class="lean-dot lean-dot--${escapeAttr(c.lean)} lean-banner__dot"></span>
      <div class="lean-banner__content">
        <div class="lean-banner__label">Our read on this candidate</div>
        <div class="lean-banner__short">${escapeHTML(c.lean_short || '')}</div>
        ${c.lean_confidence ? `<span class="lean-banner__confidence">Confidence: ${escapeHTML(c.lean_confidence)}</span>` : ''}
        ${c.one_liner ? `<p class="lean-banner__one-liner">${escapeHTML(c.one_liner)}</p>` : ''}
      </div>
    </div>` : '';

  const factHTML = `
    <dl class="fact-strip">
      <div class="fact-strip__item"><dt>Seat</dt><dd>${escapeHTML(c.position_label)} — ${escapeHTML(c.seat_context)}</dd></div>
      <div class="fact-strip__item"><dt>Appointing authority</dt><dd>${escapeHTML(c.appointed_by)}</dd></div>
      <div class="fact-strip__item"><dt>Background</dt><dd>${escapeHTML(c.prior_practice)}</dd></div>
      <div class="fact-strip__item"><dt>Reported endorsements</dt><dd>${escapeHTML(c.endorsements)}</dd></div>
      <div class="fact-strip__item"><dt>Fundraising</dt><dd>${escapeHTML(c.fundraising)}</dd></div>
    </dl>`;

  const signalsHTML = `
    <section class="signals">
      <h2 class="signals__heading">What the record actually shows</h2>
      <p class="signals__intro">
        Facts pulled from public sources — who appointed them, what they did before, what they've said or written, who's backing them. We're not predicting any vote. <a href="explainer.html">Why these categories?</a>
      </p>
      <ul class="signal-list">
        ${c.signals
          .map(
            (s) => `
          <li class="signal">
            <span class="signal__type">${escapeHTML(s.type)}</span>
            <span class="signal__text">${escapeHTML(s.text)}</span>
          </li>`
          )
          .join("")}
      </ul>
    </section>`;

  // Deep read: bench-style analytical narrative and expanded signals.
  const deepReadHTML = (c.deep_read || (c.expanded_signals && c.expanded_signals.length)) ? `
    <section class="deep-read deep-read--${escapeAttr(c.lean || 'unclear')}">
      <div class="deep-read__eyebrow">Deep read</div>
      <h2 class="deep-read__heading">How this candidate is likely to rule, and why.</h2>
      ${c.deep_read ? `<p class="deep-read__lede">${escapeHTML(c.deep_read)}</p>` : ''}
      ${(c.expanded_signals && c.expanded_signals.length) ? `
        <ul class="deep-read__signals">
          ${c.expanded_signals.map((s) => `
            <li class="deep-read__signal">
              <div class="deep-read__signal-type">${escapeHTML(s.type)}</div>
              <p class="deep-read__signal-text">${escapeHTML(s.text)}</p>
            </li>`).join('')}
        </ul>` : ''}
      <p class="deep-read__footnote">An analytical read on public signals. Not a prediction of any individual vote.</p>
    </section>` : '';

  const questionsHTML = `
    <section class="questions-block">
      <h3>Questions a voter might ask this candidate</h3>
      <ol>
        ${c.questions.map((q) => `<li>${escapeHTML(q)}</li>`).join("")}
      </ol>
      <p class="questions-block__caveat">
        Phrased to comply with Washington's Code of Judicial Conduct, which prohibits
        candidates from pledging votes on specific cases or issues likely to come before
        the court. Methodology questions are permitted.
      </p>
    </section>`;

  // Merge existing sources with any additional_sources from the deep read.
  const allSources = [...(c.sources || []), ...(c.additional_sources || [])];
  const sourcesHTML = `
    <section class="sources-block">
      <h3>Sources</h3>
      <ul>
        ${allSources
          .map((s) => `<li><a href="${escapeAttr(s.url)}" rel="noopener" target="_blank">${escapeHTML(s.label)}</a></li>`)
          .join("")}
        <li><a href="response.html?c=${encodeURIComponent(c.slug)}">Are you ${escapeHTML(c.name)} or their campaign? Submit a response →</a></li>
      </ul>
    </section>`;

  root.innerHTML = `
    <nav class="breadcrumb" aria-label="breadcrumb">
      <a href="index.html">All candidates</a>
      <span class="breadcrumb__sep">/</span>
      <span>${escapeHTML(c.position_label)} — ${escapeHTML(c.seat_context)}</span>
    </nav>

    <header class="candidate-header">
      <div class="candidate-header__photo">
        <img src="${escapeAttr(c.photo)}" alt="Portrait of ${escapeAttr(c.name)}">
      </div>
      <div>
        <div class="candidate-header__meta">${escapeHTML(c.position_label)} · ${escapeHTML(c.seat_context)}</div>
        <h1 class="candidate-header__name">${escapeHTML(c.name)}</h1>
        <p class="candidate-header__role">${escapeHTML(c.current_role)}</p>
        <div class="candidate-badges">
          ${c.incumbent ? '<span class="badge badge--incumbent">Currently sitting</span>' : ""}
          ${c.appointed_by && c.appointed_by.toLowerCase().includes("ferguson") ? '<span class="badge">Ferguson appointee</span>' : ""}
          ${c.appointed_by && c.appointed_by.toLowerCase().includes("inslee") ? '<span class="badge">Inslee appointee</span>' : ""}
        </div>
      </div>
    </header>

    ${campaignHTML}
    ${leanBannerHTML}
    ${factHTML}
    ${signalsHTML}
    ${deepReadHTML}
    ${questionsHTML}
    ${sourcesHTML}
  `;
})();

function escapeHTML(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
function escapeAttr(str) {
  return escapeHTML(str);
}
