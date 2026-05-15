// bench.js — renders the four non-ballot justice cards on bench.html.
// (Balance-of-power graphic is rendered by balance.js and now lives on index.html.)

(async function () {
  const root = document.getElementById('justices-root');
  if (!root) return;

  let justicesData;
  try {
    const res = await fetch('data/justices.json');
    justicesData = await res.json();
  } catch (err) {
    root.innerHTML = '<p>Could not load justice data.</p>';
    return;
  }

  root.innerHTML = justicesData.non_ballot_justices.map(j => {
    const signals = (j.signals || []).map(s => `
      <div class="justice__signal">
        <div class="justice__signal-type">${s.type}</div>
        <p>${s.text}</p>
      </div>
    `).join('');
    const sources = (j.sources || []).slice(0, 4).map(s => `<a href="${s.url}" target="_blank" rel="noopener">${s.label}</a>`).join(' · ');
    return `
      <article class="justice justice--${j.lean}">
        <header class="justice__head">
          <div class="justice__pos">Position ${j.position}</div>
          <h3 class="justice__name">${j.name}</h3>
          <div class="justice__role">${j.appointed_by}</div>
          <div class="justice__lean">
            <span class="lean-dot lean-dot--${j.lean}"></span>
            <span>${j.lean_short}</span>
            <span class="justice__conf">${j.lean_confidence} confidence</span>
          </div>
        </header>
        <p class="justice__one-liner">${j.one_liner}</p>
        <div class="justice__meta">
          <div><strong>Background.</strong> ${j.background}</div>
          <div><strong>Quinn vote.</strong> ${j.quinn_vote === 'majority' ? 'Joined the 7-2 majority upholding the capital gains tax as an excise.' : j.quinn_vote === 'dissent' ? 'Dissented from the 7-2 ruling; would have struck down the capital gains tax under Culliton.' : 'Joined the court after Quinn was decided.'}</div>
          <div><strong>Term ends.</strong> ${j.current_term_ends}</div>
        </div>
        <div class="justice__signals">${signals}</div>
        <div class="justice__sources"><strong>Sources:</strong> ${sources}</div>
      </article>
    `;
  }).join('');
})();
