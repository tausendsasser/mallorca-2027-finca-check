(() => {
  const originalRender = window.render;

  window.rankOf = function (finca) {
    const current = quickRatingSummary(finca);
    if (!current.count) return null;
    const score = Number(current.average.toFixed(6));
    const higher = new Set();
    ranking().forEach(item => {
      const summary = quickRatingSummary(item);
      if (summary.count && Number(summary.average.toFixed(6)) > score) {
        higher.add(Number(summary.average.toFixed(6)));
      }
    });
    return higher.size + 1;
  };

  function cleanup() {
    const spotlight = document.getElementById('spotlight');
    if (spotlight) spotlight.hidden = true;
    const option = document.querySelector('#sort-select option[value="number"]');
    if (option) option.remove();
  }

  window.render = function () {
    originalRender();
    cleanup();
    document.querySelectorAll('.finca-card').forEach(card => {
      const id = card.querySelector('[data-detail]')?.dataset.detail;
      const finca = state.data.fincas.find(item => item.id === id);
      if (!finca) return;
      const rank = window.rankOf(finca);
      const badge = card.querySelector('.rank-badge');
      if (rank && badge) badge.textContent = `Platz ${rank}`;
    });
  };

  document.addEventListener('DOMContentLoaded', cleanup);
})();
