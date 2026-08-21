(() => {
  const climateValue = finca => finca?.airConditioning;

  function hasAirConditioning(finca) {
    const value = climateValue(finca);
    if (value === true) return true;
    if (!value) return false;
    const normalized = String(value).trim().toLowerCase();
    if (!normalized || normalized === 'unknown' || normalized === 'prüfen') return false;
    if (/^(nein|keine|nicht bestätigt|nicht vorhanden)/.test(normalized)) return false;
    return /^(ja\b|klima|air|in allen|in den|schlafzimmer|wohnbereich)/.test(normalized);
  }

  function climateText(finca) {
    const value = climateValue(finca);
    if (value === true) return 'Klimaanlage';
    const raw = String(value || '').trim();
    if (!raw) return 'Klimaanlage';
    const cleaned = raw
      .replace(/^ja\s*[,–-]?\s*/i, '')
      .replace(/^klimaanlage\s*[,–-]?\s*/i, '')
      .trim();
    return cleaned ? `Klimaanlage · ${cleaned}` : 'Klimaanlage';
  }

  function fincaById(id) {
    return globalThis.state?.data?.fincas?.find?.(finca => finca.id === id)
      || (typeof state !== 'undefined' ? state.data?.fincas?.find?.(finca => finca.id === id) : null);
  }

  function enhanceCards() {
    document.querySelectorAll('.finca-card').forEach(card => {
      const detailButton = card.querySelector('[data-detail]');
      const id = detailButton?.dataset?.detail;
      const finca = id ? fincaById(id) : null;
      const facts = card.querySelector('.quick-facts');
      if (!finca || !facts) return;

      const existing = facts.querySelector('[data-climate-fact]');
      if (!hasAirConditioning(finca)) {
        existing?.remove();
        return;
      }

      const label = climateText(finca);
      if (existing) {
        existing.textContent = `❄ ${label}`;
        existing.title = String(climateValue(finca));
        return;
      }

      const badge = document.createElement('span');
      badge.dataset.climateFact = id;
      badge.className = 'climate-fact';
      badge.textContent = `❄ ${label}`;
      badge.title = String(climateValue(finca));
      facts.appendChild(badge);
    });
  }

  function enhanceDetail() {
    const hero = document.querySelector('#detail-content .detail-hero[data-enlarge]');
    const summary = document.querySelector('#detail-content .detail-summary');
    if (!hero || !summary) return;

    const id = hero.dataset.enlarge;
    const finca = fincaById(id);
    const existing = summary.querySelector('[data-climate-summary]');

    if (!finca || !hasAirConditioning(finca)) {
      existing?.remove();
      return;
    }

    const detail = String(climateValue(finca));
    if (existing) {
      existing.querySelector('span').textContent = detail;
      return;
    }

    const item = document.createElement('div');
    item.dataset.climateSummary = id;
    item.innerHTML = `<strong>Klimaanlage</strong><span>${detail}</span>`;
    summary.appendChild(item);
  }

  let scheduled = false;
  function enhance() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      enhanceCards();
      enhanceDetail();
    });
  }

  new MutationObserver(enhance).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('DOMContentLoaded', enhance);
  window.addEventListener('load', enhance);
  enhance();
})();
