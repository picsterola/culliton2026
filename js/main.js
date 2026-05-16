// Theme toggle
(function () {
  const root = document.documentElement;
  const toggle = document.querySelector("[data-theme-toggle]");
  let theme = matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light";
  root.setAttribute("data-theme", theme);
  updateToggleIcon();

  if (toggle) {
    toggle.addEventListener("click", () => {
      theme = theme === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", theme);
      updateToggleIcon();
    });
  }

  function updateToggleIcon() {
    if (!toggle) return;
    toggle.setAttribute(
      "aria-label",
      "Switch to " + (theme === "dark" ? "light" : "dark") + " mode"
    );
    toggle.innerHTML =
      theme === "dark"
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }

  // Sticky-header solid swap when scrolled past the cover hero.
  // Only applies to pages whose header carries the .site-header--over-cover class.
  const header = document.querySelector('.site-header--over-cover');
  if (header) {
    const trigger = 80; // px of scroll before swapping to solid background
    const update = () => {
      if (window.scrollY > trigger) {
        header.classList.add('site-header--solid-dark');
      } else {
        header.classList.remove('site-header--solid-dark');
      }
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
  }
})();

// ============================================================
// Candidate count injector
// ============================================================
// Any element with data-candidate-count gets the count from candidates.json
// at runtime. Variant attribute controls form:
//   data-candidate-count           -> integer ("13")
//   data-candidate-count="word"    -> lowercase word ("thirteen")
//   data-candidate-count="Word"    -> capitalized word ("Thirteen")
//
// Usage:
//   <strong data-candidate-count></strong> candidates
//   <h2><span data-candidate-count="Word"></span> candidates. Five seats.</h2>
//
// If JSON fetch fails, elements keep whatever fallback text they contain so
// the page never shows an empty number.
(function () {
  const targets = document.querySelectorAll("[data-candidate-count]");
  if (!targets.length) return;

  const numberToWord = (n, capitalize = false) => {
    const ones = ["zero","one","two","three","four","five","six","seven","eight","nine"];
    const teens = ["ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
    const tens = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
    let word;
    if (n < 10) word = ones[n];
    else if (n < 20) word = teens[n - 10];
    else if (n < 100) {
      const t = Math.floor(n / 10);
      const o = n % 10;
      word = o === 0 ? tens[t] : `${tens[t]}-${ones[o]}`;
    } else {
      // Past 99, fall back to numeric. (Hopefully we never have 100 candidates.)
      word = String(n);
    }
    return capitalize ? word.charAt(0).toUpperCase() + word.slice(1) : word;
  };

  fetch("data/candidates.json")
    .then((r) => r.ok ? r.json() : Promise.reject())
    .then((data) => {
      const n = Array.isArray(data.candidates) ? data.candidates.length : null;
      if (n === null) return;
      targets.forEach((el) => {
        const variant = el.getAttribute("data-candidate-count");
        if (variant === "word") {
          el.textContent = numberToWord(n, false);
        } else if (variant === "Word") {
          el.textContent = numberToWord(n, true);
        } else {
          el.textContent = String(n);
        }
      });
    })
    .catch(() => {
      // Silent fail. Fallback text in the HTML stays visible.
    });
})();
