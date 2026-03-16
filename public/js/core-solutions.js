document.addEventListener('DOMContentLoaded', () => {
  const root = document.querySelector('#core-business-solutions');
  if (!root) return;

  // Delegate click navigation
  root.addEventListener('click', (e) => {
    const card = e.target.closest('[data-href]');
    if (card) {
      const href = card.getAttribute('data-href');
      if (href) window.location.href = href;
    }
  });
});
