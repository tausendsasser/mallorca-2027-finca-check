function fincaIndex(finca) {
  return state.data.fincas.findIndex(item => item.id === finca.id);
}

function priceProvider(finca) {
  if (finca.priceSource) return finca.priceSource;
  const matchingAlternative = (finca.alternativePrices || []).find(item => Number(item.price) === Number(finca.price));
  if (matchingAlternative?.provider) return matchingAlternative.provider;
  if (finca.provider) return String(finca.provider).split(' / ')[0];
  if (finca.platform) return finca.platform;
  return 'Anbieter offen';
}

function filteredFincas() {
  let list = state.data.fincas.filter(f => state.status === 'all' || f.status === state.status);
  if (state.region !== 'all') list = list.filter(f => f.region === state.region);
  return list.sort((a,b) => {
    if (state.sort === 'price') return (a.price ?? Infinity) - (b.price ?? Infinity);
    if (state.sort === 'pool') return (poolArea(b.pool) ?? -1) - (poolArea(a.pool) ?? -1);
    if (state.sort === 'name') return a.name.localeCompare(b.name, 'de');
    if (state.sort === 'number') return fincaIndex(a) - fincaIndex(b);
    if (state.sort === 'newest') return fincaIndex(b) - fincaIndex(a);
    return (quickRatingSummary(b).average ?? -1) - (quickRatingSummary(a).average ?? -1);
  });
}

function card(finca) {
  const family = quickRatingSummary(finca);
  const rank = rankOf(finca);
  return `<article class="finca-card ${rank === 1 ? 'is-winner' : ''}" style="--card-art:${art(finca)}">
    <div class="finca-image">
      ${galleryMedia(finca)}
      ${rank ? `<span class="rank-badge">Platz ${rank}</span>` : ''}
      <span class="photo-score ${family.average ? '' : 'empty'}">${family.average ? family.average.toFixed(1) : '–'}<small>Familie</small></span>
      <span class="finca-status ${finca.status}">${finca.status === 'excluded' ? 'Ausgeschieden' : finca.status === 'candidate' ? 'Kandidat' : 'In Auswahl'}</span>
      <button class="favorite ${state.favorites.has(finca.id) ? 'is-favorite' : ''}" data-favorite="${finca.id}" aria-label="Favorit">${state.favorites.has(finca.id) ? '♥' : '♡'}</button>
    </div>
    <div class="finca-body">
      <span class="finca-kicker">${text(finca.region)} · ${text(finca.location)}</span>
      <div class="finca-title-row"><h3>${finca.name}</h3><div class="price">${money(finca.price)}<small>${priceProvider(finca)}</small></div></div>
      <div class="quick-facts"><span>⌂ ${text(finca.bedrooms)} Schlafzimmer</span>${poolBadge(finca)}</div>
      <div class="criteria-strip">${criterionHint('Schlafen', sleepingStatus(finca), finca.sleepingConsiderations)}${criterionHint('Ruhe', quietStatus(finca), `${finca.privacy}; ${finca.roadNoise}`)}</div>
      ${familyRatingLine(finca)}
      ${availabilityBar(finca)}
      ${quickScoreControl(finca, 'card')}
      <div class="card-actions"><button data-detail="${finca.id}">Details ansehen</button><a href="${finca.listingUrl}" target="_blank" rel="noopener">Inserat ↗</a></div>
    </div>
  </article>`;
}
