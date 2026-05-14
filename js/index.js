// Homepage candidate index renderer — groups by position
(async function () {
  const root = document.getElementById("positions-root");
  if (!root) return;

  let data;
  try {
    const res = await fetch("data/candidates.json");
    data = await res.json();
  } catch (err) {
    root.innerHTML = "<p>Could not load candidate data.</p>";
    return;
  }

  // Group by position number
  const groups = new Map();
  for (const c of data.candidates) {
    if (!groups.has(c.position)) {
      groups.set(c.position, {
        position: c.position,
        position_label: c.position_label,
        seat_context: c.seat_context.split("—")[0].trim(),
        candidates: [],
      });
    }
    groups.get(c.position).candidates.push(c);
  }

  // Sort: incumbents first, then alphabetical
  for (const g of groups.values()) {
    g.candidates.sort((a, b) => {
      if (a.incumbent !== b.incumbent) return a.incumbent ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  const sorted = [...groups.values()].sort((a, b) => a.position - b.position);

  root.innerHTML = sorted
    .map(
      (g) => `
    <div class="position-group">
      <header class="position-group__header">
        <span class="position-group__number">Position ${g.position}</span>
        <h3 class="position-group__title">${escapeHTML(g.seat_context)}</h3>
        <span class="position-group__seat">${g.candidates.length} candidate${g.candidates.length === 1 ? "" : "s"}</span>
      </header>
      <div class="candidate-grid">
        ${g.candidates
          .map(
            (c) => `
          <a href="candidate.html?c=${encodeURIComponent(c.slug)}" class="candidate-card">
            <img src="${escapeAttr(c.photo)}" alt="Portrait of ${escapeAttr(c.name)}" class="candidate-card__photo" loading="lazy">
            <div class="candidate-card__body">
              ${c.incumbent ? '<span class="candidate-card__incumbent">Currently sitting</span>' : ""}
              <span class="candidate-card__name">${escapeHTML(c.name)}</span>
              <span class="candidate-card__role">${escapeHTML(c.current_role)}</span>
              <span class="candidate-card__chevron">View signals →</span>
            </div>
          </a>`
          )
          .join("")}
      </div>
    </div>`
    )
    .join("");
})();

function escapeHTML(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function escapeAttr(str) { return escapeHTML(str); }
