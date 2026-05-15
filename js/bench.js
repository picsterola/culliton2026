// bench.js — renders the balance-of-power graphic and the four justice cards.

(async function () {
  const [justicesRes, candidatesRes] = await Promise.all([
    fetch('data/justices.json'),
    fetch('data/candidates.json')
  ]);
  const justicesData = await justicesRes.json();
  const candidatesData = await candidatesRes.json();

  // ---- Build seat map: 9 seats with current-court lean + candidate-by-candidate scenarios ----
  // Current court = each seat as it sits right now (incumbents + open seat Johnson "keep" until November)
  const currentCourt = justicesData.all_nine_summary.slice().sort((a, b) => a.position - b.position);

  // Group candidates by position
  const candByPos = {};
  candidatesData.candidates.forEach(c => {
    if (!candByPos[c.position]) candByPos[c.position] = [];
    candByPos[c.position].push(c);
  });

  // Scenario: incumbents all win => incumbent's lean stays for each ballot seat. Open seat (4) stays "keep" placeholder (Johnson retiring). Use existing incumbent lean from candidates.json.
  function scenarioIncumbents() {
    return currentCourt.map(seat => {
      if (!seat.on_ballot_2026) return { ...seat };
      const candidates = candByPos[seat.position] || [];
      const incumbent = candidates.find(c => c.incumbent);
      if (incumbent) return { ...seat, lean: incumbent.lean, name: incumbent.name };
      // Position 4 has no incumbent. For "incumbents all win" we treat as status-quo: Johnson's seat = keep.
      return { ...seat, lean: 'keep', name: 'Status-quo: open seat (Johnson)' };
    });
  }

  // Scenario: challengers sweep => for each ballot seat, pick the leading challenger (not incumbent).
  function scenarioChallengers() {
    return currentCourt.map(seat => {
      if (!seat.on_ballot_2026) return { ...seat };
      const candidates = candByPos[seat.position] || [];
      // Pick non-incumbent with highest confidence; tie-break: highest "keep" if available, else first non-incumbent.
      const challengers = candidates.filter(c => !c.incumbent);
      if (!challengers.length) return { ...seat };
      // Confidence ranking
      const order = { 'High': 3, 'Medium-High': 2.5, 'Medium': 2, 'Medium-Low': 1.5, 'Low': 1 };
      challengers.sort((a, b) => (order[b.lean_confidence] || 0) - (order[a.lean_confidence] || 0));
      const top = challengers[0];
      return { ...seat, lean: top.lean, name: top.name };
    });
  }

  // Scenario: current => use all_nine_summary as-is
  function scenarioCurrent() {
    return currentCourt.map(s => ({ ...s }));
  }

  const scenarios = {
    current: {
      seats: scenarioCurrent(),
      caption: 'The court as it sits today. Six of nine sitting justices have signaled, through opinions, votes, or appointment coalitions, that they would uphold a labeled income tax. Two would strike one down. Position 4 is open: Justice Charles Johnson, a Quinn dissenter who would have kept Culliton, is retiring.'
    },
    incumbents: {
      seats: scenarioIncumbents(),
      caption: 'If every sitting justice on the ballot wins reelection: Position 4 (open) is the wild card. If the seat goes to a candidate who would keep Culliton, the scrap side still has the votes. If it goes to a challenger who would scrap it, the margin widens. The five-vote majority to uphold ESSB 6346 is already in the building.'
    },
    challengers: {
      seats: scenarioChallengers(),
      caption: 'If every leading challenger sweeps: the court flips. The keep side picks up four ballot seats (Edwards, Stevens, Larson, plus an open-seat textualist) and joins McCloud. The math: five votes to enforce Culliton and strike down ESSB 6346. The 93-year wall holds.'
    }
  };

  // ---- Render seats ----
  const seatsEl = document.querySelector('.balance__seats');
  const countsEl = document.querySelectorAll('[data-count]');
  const captionEl = document.querySelector('[data-caption]');

  function renderScenario(name) {
    const s = scenarios[name];
    seatsEl.innerHTML = s.seats.map(seat => {
      const isBallot = seat.on_ballot_2026;
      return `
        <div class="seat seat--${seat.lean} ${isBallot ? 'seat--ballot' : 'seat--fixed'}" title="Position ${seat.position}: ${seat.name || 'Sitting'} · ${labelFor(seat.lean)}">
          <div class="seat__pos">Pos ${seat.position}</div>
          <div class="seat__dot" aria-hidden="true"></div>
          <div class="seat__name">${(seat.name || '').replace(' (incumbent)','')}</div>
          <div class="seat__lean">${labelFor(seat.lean)}</div>
        </div>
      `;
    }).join('');

    // Counts
    const counts = { keep: 0, scrap: 0, unclear: 0 };
    s.seats.forEach(seat => { counts[seat.lean] = (counts[seat.lean] || 0) + 1; });
    countsEl.forEach(el => {
      const k = el.dataset.count;
      el.textContent = counts[k] || 0;
    });

    captionEl.textContent = s.caption;
  }

  function labelFor(lean) {
    if (lean === 'keep') return 'Keep Culliton';
    if (lean === 'scrap') return 'Scrap Culliton';
    return 'Unclear';
  }

  // Tabs
  document.querySelectorAll('.balance__tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.balance__tab').forEach(b => {
        b.classList.remove('is-active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-selected', 'true');
      renderScenario(btn.dataset.scenario);
    });
  });

  renderScenario('current');

  // ---- Render the 4 non-ballot justice cards ----
  const root = document.getElementById('justices-root');
  if (root) {
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
  }
})();
