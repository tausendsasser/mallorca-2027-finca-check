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
    box.innerHTML = `
      <div class="rating-activity__head">
        <p class="eyebrow">Unsere Bewertungen</p>
        <h3>Wer mag welche Finca am meisten?</h3>
      </div>
      <div class="rating-activity__people">
        ${people.map(({ person, top }) => `
          <div class="rating-activity__person">
            <strong>${person}</strong>
            <div class="rating-activity__scores">
              ${top.map(({ finca, score }, index) => `<span class="rating-activity__score ${index === 0 ? 'is-top' : ''}"><b>Nr. ${fincaNumber(finca)}</b> ${score.toFixed(1)}</span>`).join('')}
            </div>
          </div>`).join('')}
      </div>`;
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

  const style = document.createElement('style');
  style.textContent = `
    .rating-activity{display:block;background:#fff;border-radius:22px;padding:18px 20px;margin:0 0 22px;box-shadow:0 10px 30px rgba(35,72,59,.08)}
    .rating-activity__head h3{margin:.2rem 0 1rem;font-size:clamp(1.05rem,2.5vw,1.3rem)}
    .rating-activity__people{display:grid;gap:10px}
    .rating-activity__person{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid rgba(35,72,59,.1)}
    .rating-activity__person:first-child{border-top:0}
    .rating-activity__person>strong{min-width:74px}
    .rating-activity__scores{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
    .rating-activity__score{background:#f3f5f2;border-radius:999px;padding:6px 9px;font-size:.85rem;white-space:nowrap}
    .rating-activity__score.is-top{background:#e5efe9}
    @media(max-width:600px){.rating-activity__person{align-items:flex-start;flex-direction:column}.rating-activity__scores{justify-content:flex-start}}
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
