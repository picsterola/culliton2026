// balance.js — renders the Balance of Power graphic.
// Used on both index.html and (optionally) other pages. Runs only if a
// .balance__seats element is present in the DOM.

(async function () {
  const seatsEl = document.querySelector('.balance__seats');
  if (!seatsEl) return;

  let justicesData, candidatesData;
  try {
    const [justicesRes, candidatesRes] = await Promise.all([
      fetch('data/justices.json'),
      fetch('data/candidates.json')
    ]);
    justicesData = await justicesRes.json();
    candidatesData = await candidatesRes.json();
  } catch (err) {
    seatsEl.innerHTML = '<p>Could not load court data.</p>';
    return;
  }

  const currentCourt = justicesData.all_nine_summary.slice().sort((a, b) => a.position - b.position);

  // Group candidates by position
  const candByPos = {};
  candidatesData.candidates.forEach(c => {
    if (!candByPos[c.position]) candByPos[c.position] = [];
    candByPos[c.position].push(c);
  });

  function scenarioIncumbents() {
    return currentCourt.map(seat => {
      if (!seat.on_ballot_2026) return { ...seat };
      const candidates = candByPos[seat.position] || [];
      const incumbent = candidates.find(c => c.incumbent);
      if (incumbent) return { ...seat, lean: incumbent.lean, name: incumbent.name };
      return { ...seat, lean: 'keep', name: 'Status-quo: open seat (Johnson)' };
    });
  }

  function scenarioChallengers() {
    return currentCourt.map(seat => {
      if (!seat.on_ballot_2026) return { ...seat };
      const candidates = candByPos[seat.position] || [];
      const challengers = candidates.filter(c => !c.incumbent);
      if (!challengers.length) return { ...seat };
      const order = { 'High': 3, 'Medium-High': 2.5, 'Medium': 2, 'Medium-Low': 1.5, 'Low': 1 };
      challengers.sort((a, b) => (order[b.lean_confidence] || 0) - (order[a.lean_confidence] || 0));
      const top = challengers[0];
      return { ...seat, lean: top.lean, name: top.name };
    });
  }

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

    const counts = { keep: 0, scrap: 0, unclear: 0 };
    s.seats.forEach(seat => { counts[seat.lean] = (counts[seat.lean] || 0) + 1; });
    countsEl.forEach(el => {
      const k = el.dataset.count;
      el.textContent = counts[k] || 0;
    });

    if (captionEl) captionEl.textContent = s.caption;
  }

  function labelFor(lean) {
    if (lean === 'keep') return 'Keep Culliton';
    if (lean === 'scrap') return 'Scrap Culliton';
    return 'Unclear';
  }

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
})();
