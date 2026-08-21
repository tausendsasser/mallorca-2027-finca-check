(() => {
  const originalRender = window.render;

  function scoreOf(finca) {
    const summary = quickRatingSummary(finca);
    return summary.count ? Number(summary.average.toFixed(6)) : null;
  }

  window.rankOf = function (finca) {
    const score = scoreOf(finca);
    if (score === null) return null;
    const higherDistinctScores = new Set(
      state.data.fincas
        .filter(item => item.status !== 'excluded')
        .map(scoreOf)
        .filter(value => value !== null && value > score)
    );
    return higherDistinctScores.size + 1;
  };

  function fincaNumber(finca) {
    const match = String(finca.name || '').match(/^\s*(\d+)\s*[·.\-]/);
    return match ? match[1] : finca.name;
  }

  function ratingsForPerson(person) {
    return state.data.fincas
      .map(finca => {
        const value = quickRating(finca, person);
        return Number.isFinite(Number(value)) ? { finca, score: Number(value) } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || Number(fincaNumber(a.finca)) - Number(fincaNumber(b.finca)))
      .slice(0, 3);
  }

  function scrollToFinca(id) {
    const trigger = document.querySelector(`[data-detail="${CSS.escape(id)}"]`);
    const card = trigger?.closest('.finca-card');
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('is-jump-highlight');
    setTimeout(() => card.classList.remove('is-jump-highlight'), 1400);
  }

  function renderActivitySummary() {
    const box = document.getElementById('spotlight');
    if (!box || !state.data) return;

    const people = state.data.familyMembers
      .map(person => ({ person, top: ratingsForPerson(person) }))
      .filter(entry => entry.top.length);

    if (!people.length) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }

    box.hidden = false;
    box.classList.add('rating-activity');
    box.innerHTML = people.map(({ person, top }) => `
      <p class="rating-activity__line"><strong>${person}</strong>: ${top.map(({ finca, score }) => `<button type="button" class="rating-activity__link" data-jump-finca="${finca.id}">Nr. ${fincaNumber(finca)} · ${score.toFixed(1)}</button>`).join(' · ')}</p>
    `).join('');
  }

  function cleanupFilters() {
    const filters = document.getElementById('filters');
    const button = document.querySelector('[data-action="toggle-filters"]');
    if (filters && button?.getAttribute('aria-expanded') !== 'true') filters.hidden = true;
    const numberOption = document.querySelector('#sort-select option[value="number"]');
    if (numberOption) numberOption.remove();
  }

  function applyRanks() {
    document.querySelectorAll('.finca-card').forEach(card => {
      const id = card.querySelector('[data-detail]')?.dataset.detail;
      const finca = state.data.fincas.find(item => item.id === id);
      if (!finca) return;
      const rank = window.rankOf(finca);
      let badge = card.querySelector('.rank-badge');
      if (rank && !badge) {
        badge = document.createElement('span');
        badge.className = 'rank-badge';
        card.querySelector('.finca-image')?.appendChild(badge);
      }
      if (rank && badge) badge.textContent = `Platz ${rank}`;
      if (!rank && badge) badge.remove();
      card.classList.toggle('is-winner', rank === 1);
    });
  }

  window.render = function () {
    originalRender();
    cleanupFilters();
    applyRanks();
    renderActivitySummary();
  };

  document.addEventListener('click', event => {
    const jump = event.target.closest('[data-jump-finca]');
    if (!jump) return;
    event.preventDefault();
    scrollToFinca(jump.dataset.jumpFinca);
  });

  const style = document.createElement('style');
  style.textContent = `
    [hidden]{display:none!important}
    .sort-panel{margin:0 0 12px;padding:10px 12px;background:#fff;border-radius:14px;box-shadow:0 6px 18px rgba(35,72,59,.06)}
    .sort-panel label{margin:0}
    .rating-activity{display:block;background:transparent!important;border:0!important;border-radius:0!important;padding:2px 0 12px!important;margin:0 0 10px!important;box-shadow:none!important}
    .rating-activity__line{margin:3px 0;font-size:.82rem;line-height:1.5;color:rgba(35,72,59,.78)}
    .rating-activity__line strong{color:#23483b}
    .rating-activity__link{appearance:none;border:0;background:none;padding:0;margin:0;color:#23483b;font:inherit;font-weight:600;text-decoration:underline;text-decoration-color:rgba(35,72,59,.25);text-underline-offset:2px;cursor:pointer}
    .rating-activity__link:hover{text-decoration-color:#23483b}
    .finca-card.is-jump-highlight{outline:3px solid rgba(35,72,59,.22);outline-offset:4px;transition:outline-color .25s ease}
  `;
  document.head.appendChild(style);

  document.addEventListener('DOMContentLoaded', () => {
    cleanupFilters();
    setTimeout(() => {
      if (state?.data) {
        applyRanks();
        renderActivitySummary();
      }
    }, 300);
  });
})();
