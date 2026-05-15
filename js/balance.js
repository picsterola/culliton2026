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

  // Position 4 is the only open seat (Johnson retiring). State holds the
  // user's pick from the Pos 4 selector. Default is O'Donnell as the most
  // plausible front-runner; user can switch to Birk or Shelvey.
  // Values: candidate.name (must match data/candidates.json)
  let pos4Pick = "Sean O'Donnell";

  const labelForLean = lean => {
    if (lean === 'keep') return 'Keep Culliton';
    if (lean === 'scrap') return 'Scrap Culliton';
    return 'Unclear';
  };

  // Resolve the Position 4 seat object based on current pos4Pick.
  function pos4Seat() {
    const base = currentCourt.find(s => s.position === 4);
    const cands = candByPos[4] || [];
    const pick = cands.find(c => c.name === pos4Pick);
    if (!pick) return { ...base, lean: 'unclear', name: 'Position 4 (TBD)' };
    return { ...base, lean: pick.lean, name: pick.name };
  }

  function scenarioCurrent() {
    // Today's bench, with Pos 4 reflecting the user's pick (default: open).
    return currentCourt.map(s => {
      if (s.position === 4) return pos4Seat();
      return { ...s };
    });
  }

  function scenarioIncumbents() {
    // Four ballot incumbents (Pos 1, 3, 5, 7) keep their seats. Pos 4 uses
    // the user's pick because there is no incumbent.
    return currentCourt.map(seat => {
      if (seat.position === 4) return pos4Seat();
      if (!seat.on_ballot_2026) return { ...seat };
      const cands = candByPos[seat.position] || [];
      const inc = cands.find(c => c.incumbent);
      if (inc) return { ...seat, lean: inc.lean, name: inc.name };
      return { ...seat };
    });
  }

  function scenarioChallengers() {
    // Top-confidence non-incumbent wins each of Pos 1, 3, 5, 7. Pos 4 uses
    // the user's pick because every Pos 4 candidate is a non-incumbent.
    return currentCourt.map(seat => {
      if (seat.position === 4) return pos4Seat();
      if (!seat.on_ballot_2026) return { ...seat };
      const cands = (candByPos[seat.position] || []).filter(c => !c.incumbent);
      if (!cands.length) return { ...seat };
      const order = { 'High': 3, 'Medium-High': 2.5, 'Medium': 2, 'Medium-Low': 1.5, 'Low': 1 };
      cands.sort((a, b) => (order[b.lean_confidence] || 0) - (order[a.lean_confidence] || 0));
      const top = cands[0];
      return { ...seat, lean: top.lean, name: top.name };
    });
  }

  // Captions are dynamic based on Pos 4 pick.
  function captionFor(name) {
    const pos4 = pos4Seat();
    const pos4Lean = pos4.lean;

    if (name === 'current') {
      const tipPhrase = pos4Lean === 'scrap' ? 'pushes scrap to seven' : pos4Lean === 'keep' ? 'gives the keep side a third vote (still short of five)' : 'leaves Position 4 in the unclear column';
      return `Today's bench with ${pos4.name} winning Position 4 (lean: ${labelForLean(pos4Lean)}). That ${tipPhrase}. Either way, the scrap side already has the five votes to uphold a labeled income tax. The other eight seats are unchanged from the current court.`;
    }

    if (name === 'incumbents') {
      const ftip = pos4Lean === 'scrap' ? 'pushes scrap to seven' : pos4Lean === 'keep' ? 'adds a third keep vote (still short of five)' : 'leaves Position 4 in the unclear column';
      return `Four ballot incumbents return (Melody, Diaz, Angelis, Stephens). With ${pos4.name} winning Position 4 (lean: ${labelForLean(pos4Lean)}), the math ${ftip}. The scrap side has its five votes (Melody, Diaz, Angelis, Mungia, Whitener, González) regardless of who wins Position 4.`;
    }

    if (name === 'challengers') {
      const ctip = pos4Lean === 'keep' ? 'pushes the keep side to six' : pos4Lean === 'scrap' ? 'gives scrap a fourth vote (still short of five)' : 'leaves Position 4 in the unclear column';
      return `Challengers sweep the contested seats: Edwards (Pos 1), Stevens (Pos 3), and Larson (Pos 5) unseat the incumbents. Stephens runs unopposed at Pos 7. With ${pos4.name} winning Position 4 (lean: ${labelForLean(pos4Lean)}), the math ${ctip}. The keep side has its five votes (Edwards, Stevens, Larson, Stephens, McCloud) regardless of who wins Position 4. The wall holds.`;
    }
    return '';
  }

  function seatsForScenario(name) {
    if (name === 'current') return scenarioCurrent();
    if (name === 'incumbents') return scenarioIncumbents();
    if (name === 'challengers') return scenarioChallengers();
    return scenarioCurrent();
  }

  const countsEl = document.querySelectorAll('[data-count]');
  const captionEl = document.querySelector('[data-caption]');

  let activeScenario = 'current';

  function renderScenario(name) {
    activeScenario = name;
    const seats = seatsForScenario(name);
    seatsEl.innerHTML = seats.map(seat => {
      const isBallot = seat.on_ballot_2026;
      return `
        <div class="seat seat--${seat.lean} ${isBallot ? 'seat--ballot' : 'seat--fixed'}" title="Position ${seat.position}: ${seat.name || 'Sitting'} · ${labelForLean(seat.lean)}">
          <div class="seat__pos">Pos ${seat.position}</div>
          <div class="seat__dot" aria-hidden="true"></div>
          <div class="seat__name">${(seat.name || '').replace(' (incumbent)','')}</div>
          <div class="seat__lean">${labelForLean(seat.lean)}</div>
        </div>
      `;
    }).join('');

    const counts = { keep: 0, scrap: 0, unclear: 0 };
    seats.forEach(seat => { counts[seat.lean] = (counts[seat.lean] || 0) + 1; });
    countsEl.forEach(el => {
      const k = el.dataset.count;
      el.textContent = counts[k] || 0;
    });

    if (captionEl) captionEl.textContent = captionFor(name);
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

  // Position 4 picker
  document.querySelectorAll('.pos4-pick').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pos4-pick').forEach(b => {
        b.classList.remove('is-active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-pressed', 'true');
      pos4Pick = btn.dataset.pos4;
      renderScenario(activeScenario);
    });
  });

  renderScenario('current');
})();
