// balance.js — renders the Balance of Power graphic.
//
// Model:
//   - The four off-ballot justices keep their leans (from data/justices.json).
//   - Each of the five ballot seats (Pos 1, 3, 4, 5, 7) has a per-seat pick.
//   - Two preset tabs ("Incumbents all win" / "Challengers sweep") set all
//     five picks at once.
//   - Per-seat dropdowns let the user override any individual seat without
//     leaving the current preset.

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

  const currentCourt = justicesData.all_nine_summary
    .slice()
    .sort((a, b) => a.position - b.position);

  // Group candidates by position
  const candByPos = {};
  candidatesData.candidates.forEach(c => {
    if (!candByPos[c.position]) candByPos[c.position] = [];
    candByPos[c.position].push(c);
  });

  // Ballot positions (in display order).
  const BALLOT_POSITIONS = [1, 3, 4, 5, 7];

  // Confidence rank for "top challenger" picks.
  const CONFIDENCE_ORDER = {
    'High': 3,
    'Medium-High': 2.5,
    'Medium': 2,
    'Medium-Low': 1.5,
    'Low': 1
  };

  function topChallenger(pos) {
    const cands = (candByPos[pos] || []).filter(c => !c.incumbent);
    if (!cands.length) return null;
    return cands
      .slice()
      .sort((a, b) =>
        (CONFIDENCE_ORDER[b.lean_confidence] || 0) -
        (CONFIDENCE_ORDER[a.lean_confidence] || 0)
      )[0];
  }

  function incumbent(pos) {
    return (candByPos[pos] || []).find(c => c.incumbent) || null;
  }

  function frontRunner(pos) {
    return (candByPos[pos] || []).find(c => c.front_runner) || null;
  }

  // Preset defaults: returns a candidate object for the given position.
  function presetPick(scenario, pos) {
    if (scenario === 'challengers') return topChallenger(pos);
    // 'incumbents' / status-quo preset: incumbent if present; for open seats,
    // the establishment-coalition front-runner; else fall back to confidence.
    return incumbent(pos) || frontRunner(pos) || topChallenger(pos);
  }

  // Per-seat picks: { 1: candidateName, 3: ..., 4: ..., 5: ..., 7: ... }
  let activeScenario = 'incumbents';
  const picks = {};

  function applyPreset(scenario) {
    BALLOT_POSITIONS.forEach(pos => {
      const c = presetPick(scenario, pos);
      picks[pos] = c ? c.name : null;
    });
  }

  applyPreset(activeScenario);

  const labelForLean = lean => {
    if (lean === 'keep') return 'Keep Culliton';
    if (lean === 'scrap') return 'Scrap Culliton';
    return 'Unclear';
  };

  function pickedCandidate(pos) {
    const name = picks[pos];
    if (!name) return null;
    return (candByPos[pos] || []).find(c => c.name === name) || null;
  }

  function seatFor(pos) {
    const base = currentCourt.find(s => s.position === pos);
    if (!base) return null;
    if (!base.on_ballot_2026) return { ...base };
    const pick = pickedCandidate(pos);
    if (!pick) return { ...base, lean: 'unclear', name: `Position ${pos} (TBD)` };
    return { ...base, lean: pick.lean, name: pick.name };
  }

  function currentSeats() {
    return currentCourt.map(s => seatFor(s.position));
  }

  // Caption is computed from the live counts, not hardcoded names.
  function buildCaption() {
    const seats = currentSeats();
    const counts = { keep: 0, scrap: 0, unclear: 0 };
    seats.forEach(s => { counts[s.lean] = (counts[s.lean] || 0) + 1; });

    const scrap = counts.scrap;
    const keep = counts.keep;
    const unclear = counts.unclear;

    const ballotPickNames = BALLOT_POSITIONS
      .map(pos => {
        const c = pickedCandidate(pos);
        return c ? `Pos ${pos}: ${c.name.split(' ').slice(-1)[0]}` : null;
      })
      .filter(Boolean)
      .join(', ');

    let math;
    if (scrap >= 5) {
      math = `Scrap has ${scrap} votes — enough to overturn Culliton or uphold ESSB 6346.`;
    } else if (keep >= 5) {
      math = `Keep has ${keep} votes — Culliton holds and ESSB 6346 falls.`;
    } else if (scrap > keep) {
      math = `Scrap leads ${scrap}–${keep} with ${unclear} unclear. Short of the 5 needed to overturn.`;
    } else if (keep > scrap) {
      math = `Keep leads ${keep}–${scrap} with ${unclear} unclear. Short of the 5 needed to strike 6346 down outright.`;
    } else {
      math = `Tied ${scrap}–${keep} with ${unclear} unclear. Neither side has the 5 votes.`;
    }

    return `${ballotPickNames}. ${math}`;
  }

  // -----------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------

  const countsEl = document.querySelectorAll('[data-count]');
  const captionEl = document.querySelector('[data-caption]');
  const seatPickerRow = document.querySelector('[data-seat-pickers]');

  function renderBoard() {
    const seats = currentSeats();
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
    seats.forEach(s => { counts[s.lean] = (counts[s.lean] || 0) + 1; });
    countsEl.forEach(el => {
      const k = el.dataset.count;
      el.textContent = counts[k] || 0;
    });

    if (captionEl) captionEl.textContent = buildCaption();
  }

  function renderSeatPickers() {
    if (!seatPickerRow) return;
    seatPickerRow.innerHTML = BALLOT_POSITIONS.map(pos => {
      const cands = candByPos[pos] || [];
      const selected = picks[pos] || '';
      const options = cands.map(c => {
        const tag = c.incumbent ? ' (incumbent)' : '';
        const sel = c.name === selected ? ' selected' : '';
        return `<option value="${c.name}"${sel}>${c.name}${tag}</option>`;
      }).join('');
      return `
        <label class="seat-picker__item">
          <span class="seat-picker__pos">Pos ${pos}</span>
          <select class="seat-picker__select" data-pos="${pos}" aria-label="Winner for Position ${pos}">
            ${options}
          </select>
        </label>
      `;
    }).join('');

    seatPickerRow.querySelectorAll('select').forEach(sel => {
      sel.addEventListener('change', e => {
        const pos = Number(e.target.dataset.pos);
        picks[pos] = e.target.value;
        renderBoard();
      });
    });
  }

  function setScenario(name) {
    activeScenario = name;
    document.querySelectorAll('.balance__tab').forEach(b => {
      const active = b.dataset.scenario === name;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    applyPreset(name);
    renderSeatPickers();
    renderBoard();
  }

  document.querySelectorAll('.balance__tab').forEach(btn => {
    btn.addEventListener('click', () => setScenario(btn.dataset.scenario));
  });

  // Initial render
  renderSeatPickers();
  renderBoard();
})();
