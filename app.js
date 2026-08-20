const state = { data: null, status: 'active', region: 'all', sort: 'score', favorites: new Set(JSON.parse(localStorage.getItem('finca-favorites') || '[]')) };

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const unknown = value => value === null || value === undefined || value === '' || value === 'unknown' || value === 'prüfen';
const text = (value, fallback = 'Noch offen') => unknown(value) ? fallback : String(value);
const money = value => unknown(value) ? 'Preis offen' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
const art = finca => {
  const palettes = [['#9ab09d','#d8c3a1'],['#719187','#d9b987'],['#a8a078','#c6845d'],['#789384','#e0caa7'],['#627f78','#b89468']];
  const index = [...finca.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palettes.length;
  return `linear-gradient(145deg, ${palettes[index][0]}, ${palettes[index][1]})`;
};

function ratingSummary(finca) {
  const ratings = Object.values(finca.familyRatings || {}).filter(entry => entry && entry.scores);
  if (!ratings.length) return { score: null, mustPass: null, count: 0 };
  const criteria = state.data.ratingCriteria;
  const results = ratings.map(rating => {
    let weighted = 0;
    let weight = 0;
    let mustPass = true;
    criteria.forEach(c => {
      const score = Number(rating.scores[c.id]);
      if (!Number.isFinite(score)) return;
      weighted += score * c.weight;
      weight += c.weight;
      if (c.required && score < c.minimum) mustPass = false;
    });
    const raw = weight ? weighted / weight : null;
    return { score: raw === null ? null : (mustPass ? raw : Math.min(raw, state.data.ratingRules.mustCriteriaScoreCap)), mustPass };
  }).filter(r => r.score !== null);
  return { score: results.length ? results.reduce((a,b) => a + b.score, 0) / results.length : null, mustPass: results.every(r => r.mustPass), count: results.length };
}

function renderTrip() {
  const trip = state.data.trip;
  $('#trip-facts').innerHTML = `
    <div class="trip-fact"><strong>${trip.adults + trip.children}</strong><span>Personen</span></div>
    <div class="trip-fact"><strong>${trip.nights}</strong><span>Nächte</span></div>
    <div class="trip-fact"><strong>${formatDate(trip.idealStart)}</strong><span>idealer Start</span></div>`;
}

function formatDate(date) { return new Intl.DateTimeFormat('de-DE', { day:'2-digit', month:'2-digit' }).format(new Date(`${date}T12:00:00`)); }
function dateKey(date) { return date.toISOString().slice(0,10); }
function tripDates() {
  const dates = [];
  let current = new Date(`${state.data.trip.windowStart}T12:00:00`);
  const end = new Date(`${state.data.trip.windowEnd}T12:00:00`);
  while (current <= end) { dates.push(dateKey(current)); current.setDate(current.getDate() + 1); }
  return dates;
}

function availabilityState(finca, date) {
  const intervals = finca.availability?.intervals || [];
  const match = intervals.find(i => date >= i.start && date <= i.end);
  return match?.state || 'unknown';
}

function availabilityBar(finca) {
  const trip = state.data.trip;
  return `<div class="availability">
    <div class="availability-head"><span>${formatDate(trip.windowStart)}</span><span>Ideal ${formatDate(trip.idealStart)}–${formatDate(trip.idealEnd)}</span><span>${formatDate(trip.windowEnd)}</span></div>
    <div class="availability-track" title="${text(finca.availability?.summary)}">${tripDates().map(date => `<i class="day ${availabilityState(finca,date)} ${date >= trip.idealStart && date <= trip.idealEnd ? 'ideal' : ''}"></i>`).join('')}</div>
  </div>`;
}

function filteredFincas() {
  let list = state.data.fincas.filter(f => state.status === 'all' || f.status === state.status);
  if (state.region !== 'all') list = list.filter(f => f.region === state.region);
  return list.sort((a,b) => {
    if (state.sort === 'price') return (a.price ?? Infinity) - (b.price ?? Infinity);
    if (state.sort === 'pool') return (b.pool?.area ?? -1) - (a.pool?.area ?? -1);
    if (state.sort === 'name') return a.name.localeCompare(b.name, 'de');
    return (ratingSummary(b).score ?? -1) - (ratingSummary(a).score ?? -1);
  });
}

function card(finca) {
  const score = ratingSummary(finca);
  return `<article class="finca-card" style="--card-art:${art(finca)}">
    <div class="finca-image">
      <span class="finca-status ${finca.status}">${finca.status === 'excluded' ? 'Ausgeschieden' : finca.status === 'candidate' ? 'Kandidat' : 'In Auswahl'}</span>
      <button class="favorite ${state.favorites.has(finca.id) ? 'is-favorite' : ''}" data-favorite="${finca.id}" aria-label="Favorit">${state.favorites.has(finca.id) ? '♥' : '♡'}</button>
    </div>
    <div class="finca-body">
      <span class="finca-kicker">${text(finca.region)} · ${text(finca.location)}</span>
      <div class="finca-title-row"><h3>${finca.name}</h3><div class="price">${money(finca.price)}<small>${finca.nights || state.data.trip.nights} Nächte</small></div></div>
      <div class="quick-facts"><span>⌂ ${text(finca.bedrooms)} Schlafzimmer</span><span>◉ ${text(finca.pool?.display, 'Pool offen')}</span><span>★ ${score.score ? score.score.toFixed(1) : '–'}</span></div>
      ${availabilityBar(finca)}
      <div class="card-actions"><button data-detail="${finca.id}">Details ansehen</button><a href="${finca.listingUrl}" target="_blank" rel="noopener">Inserat ↗</a></div>
    </div>
  </article>`;
}

function renderSpotlight(list) {
  const finca = list.find(f => state.favorites.has(f.id)) || list[0];
  $('#spotlight').innerHTML = finca ? `<article class="spotlight-card" style="--card-art:${art(finca)}" data-detail="${finca.id}">
    <div><p class="eyebrow">${state.favorites.has(finca.id) ? 'Familienfavorit' : 'Unsere Auswahl'}</p><h3>${finca.name}</h3><div class="spotlight-meta"><span>${text(finca.location)}</span><span>•</span><span>${money(finca.price)}</span></div></div>
    <span class="score-badge">${ratingSummary(finca).score?.toFixed(1) || 'Neu'}</span>
  </article>` : '';
}

function renderComparison() {
  const ranked = [...state.data.fincas].filter(f => f.status !== 'excluded').sort((a,b) => {
    const favoriteDelta = Number(state.favorites.has(b.id)) - Number(state.favorites.has(a.id));
    return favoriteDelta || (ratingSummary(b).score ?? -1) - (ratingSummary(a).score ?? -1) || (a.price ?? Infinity) - (b.price ?? Infinity);
  }).slice(0,5);
  $('#comparison-list').innerHTML = ranked.map((f,i) => `<article class="comparison-card" data-detail="${f.id}"><span class="rank">${i+1}</span><div><h3>${f.name}</h3><p>${text(f.region)} · ${money(f.price)} · Pool ${text(f.pool?.display)}</p></div><span class="comparison-score">${ratingSummary(f).score?.toFixed(1) || 'offen'}</span></article>`).join('');
}

function render() {
  const list = filteredFincas();
  renderSpotlight(list);
  $('#finca-grid').innerHTML = list.length ? list.map(card).join('') : '<p>Für diese Auswahl gibt es noch keine Fincas.</p>';
  renderComparison();
}

function renderDetail(finca) {
  const pool = finca.pool || {};
  const notes = [...(finca.personalPositives || []).map(x => `<div class="note">＋ ${x}</div>`), ...(finca.personalNegatives || []).map(x => `<div class="note negative">− ${x}</div>`)];
  $('#detail-content').innerHTML = `<div class="detail-hero" style="--card-art:${art(finca)}"><button class="dialog-close" data-close-detail aria-label="Schließen">×</button><div><p class="eyebrow">${text(finca.region)} · ${text(finca.location)}</p><h2>${finca.name}</h2></div></div>
    <div class="detail-body">
      <div class="detail-summary"><div><strong>${money(finca.price)}</strong><span>${finca.nights || state.data.trip.nights} Nächte</span></div><div><strong>${text(finca.bedrooms)}</strong><span>Schlafzimmer</span></div><div><strong>${text(finca.bathrooms)}</strong><span>Bäder</span></div></div>
      ${availabilityBar(finca)}
      <section class="detail-section"><h3>Schlafen & Komfort</h3><div class="fact-list">
        ${fact('Betten', finca.bedConfiguration)}${fact('Klimaanlage', finca.airConditioning)}${fact('Waschmaschine', finca.washingMachine)}
      </div></section>
      <section class="detail-section"><h3>Pool & Geselligkeit</h3><div class="fact-list">
        ${fact('Pool', pool.display)}${fact('Tiefe', depth(pool))}${fact('Springen & Toben', pool.jumpingAssessment)}${fact('Terrasse → Pool', finca.terraceToPool)}${fact('Pool im Blick', finca.poolVisibility)}${fact('Außenküche', finca.outdoorKitchen)}${fact('Grill', finca.barbecue)}
      </div></section>
      <section class="detail-section"><h3>Lage & Atmosphäre</h3><div class="fact-list">
        ${fact('Privatsphäre', finca.privacy)}${fact('Nachbarn', finca.neighbours)}${fact('Straßenlärm', finca.roadNoise)}${fact('Außenbereich', finca.outdoorArea)}${fact('Strand', finca.beachDistance)}${fact('Ort', finca.townDistance)}
      </div></section>
      ${notes.length ? `<section class="detail-section"><h3>Unser Eindruck</h3><div class="notes">${notes.join('')}</div>${finca.memoryAnchor ? `<p><strong>Erinnerungsanker:</strong> ${finca.memoryAnchor}</p>` : ''}</section>` : ''}
      <a class="detail-cta" href="${finca.listingUrl}" target="_blank" rel="noopener">Original-Inserat öffnen ↗</a>
    </div>`;
  $('#detail-dialog').showModal();
}

function fact(label, value) { return `<div class="fact-row"><span>${label}</span><strong>${text(value)}</strong></div>`; }
function depth(pool) { return unknown(pool.minDepth) && unknown(pool.maxDepth) ? null : `${text(pool.minDepth)}–${text(pool.maxDepth)} m`; }

function populateFilters() {
  const regions = [...new Set(state.data.fincas.map(f => f.region).filter(Boolean))].sort();
  $('#region-filter').innerHTML += regions.map(region => `<option value="${region}">${region}</option>`).join('');
}

function setupEvents() {
  document.addEventListener('click', event => {
    const detail = event.target.closest('[data-detail]');
    if (detail) renderDetail(state.data.fincas.find(f => f.id === detail.dataset.detail));
    const favorite = event.target.closest('[data-favorite]');
    if (favorite) { event.stopPropagation(); state.favorites.has(favorite.dataset.favorite) ? state.favorites.delete(favorite.dataset.favorite) : state.favorites.add(favorite.dataset.favorite); localStorage.setItem('finca-favorites', JSON.stringify([...state.favorites])); render(); }
    if (event.target.closest('[data-close-detail]')) $('#detail-dialog').close();
    if (event.target.closest('[data-action="toggle-filters"]')) { const filters = $('#filters'); filters.hidden = !filters.hidden; event.target.closest('button').setAttribute('aria-expanded', String(!filters.hidden)); }
    if (event.target.closest('[data-action="open-suggest"]')) $('#suggest-dialog').showModal();
    const scroll = event.target.closest('[data-scroll]');
    if (scroll) { document.getElementById(scroll.dataset.scroll).scrollIntoView(); $$('.bottom-nav button').forEach(b => b.classList.toggle('is-active', b === scroll)); }
    const share = event.target.closest('[data-share]');
    if (share) shareSuggestion(share.dataset.share);
  });
  $('#status-filter').addEventListener('change', e => { state.status = e.target.value; render(); });
  $('#region-filter').addEventListener('change', e => { state.region = e.target.value; render(); });
  $('#sort-select').addEventListener('change', e => { state.sort = e.target.value; render(); });
  $('#detail-dialog').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });
}

async function shareSuggestion(channel) {
  const input = $('#suggest-url');
  const error = $('#suggest-error');
  if (!input.checkValidity()) { error.textContent = 'Bitte füge zuerst einen vollständigen Link ein.'; input.focus(); return; }
  error.textContent = '';
  const message = `Finca-Vorschlag für Mallorca 2027: ${input.value}`;
  if (channel === 'whatsapp') window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
  if (channel === 'email') window.location.href = `mailto:?subject=${encodeURIComponent('Finca-Vorschlag Mallorca 2027')}&body=${encodeURIComponent(message)}`;
  if (channel === 'copy') { await navigator.clipboard.writeText(input.value); error.textContent = 'Link wurde kopiert.'; }
}

async function init() {
  $('#finca-grid').append($('#loading-template').content.cloneNode(true));
  try {
    const response = await fetch('data/fincas.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    renderTrip(); populateFilters(); setupEvents(); render();
  } catch (error) {
    $('#finca-grid').innerHTML = '<div class="note negative"><strong>Daten konnten nicht geladen werden.</strong><br>Bitte die App über GitHub Pages oder einen lokalen Webserver öffnen.</div>';
    console.error(error);
  }
}

init();
