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
