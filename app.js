const state = {
  data: null,
  status: 'active',
  region: 'all',
  sort: 'score',
  favorites: new Set(JSON.parse(localStorage.getItem('finca-favorites') || '[]')),
  localRatings: JSON.parse(localStorage.getItem('finca-ratings') || '{}'),
  quickRatings: JSON.parse(localStorage.getItem('finca-quick-ratings') || '{}'),
  pendingRatings: [],
  selectedPerson: localStorage.getItem('finca-selected-person') || 'Marcel',
  syncStatus: 'Verbindung wird hergestellt …',
  personalNotes: JSON.parse(localStorage.getItem('finca-personal-notes') || '{}')
};

const firebaseConfig = {
  apiKey: 'AIzaSyBeOU8wrUFrXr_tVx_fe5CxXYzSlyTPSbU',
  authDomain: 'mallorca-2027-finca-check.firebaseapp.com',
  projectId: 'mallorca-2027-finca-check',
  storageBucket: 'mallorca-2027-finca-check.firebasestorage.app',
  messagingSenderId: '296027815503',
  appId: '1:296027815503:web:a467fa59fcf4528f82b43a'
};

let firebase = null;

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
const gallery = finca => (finca.images || []).map(image => typeof image === 'string' ? { url: image, alt: finca.name } : image).filter(image => image.url);

function galleryMedia(finca, context = 'card') {
  const images = gallery(finca);
  if (!images.length) return '';
  return `<img src="${images[0].url}" alt="${images[0].alt || finca.name}" ${context === 'card' ? 'loading="lazy"' : ''} data-gallery-image="${finca.id}">
    ${images.length > 1 ? `<button class="gallery-arrow gallery-arrow--left" data-gallery-step="-1" data-gallery-id="${finca.id}" aria-label="Vorheriges Bild">‹</button><button class="gallery-arrow gallery-arrow--right" data-gallery-step="1" data-gallery-id="${finca.id}" aria-label="Nächstes Bild">›</button><span class="image-count" data-gallery-count="${finca.id}">1 / ${images.length}</span>` : ''}`;
}

function ratingSummary(finca) {
  const ratings = Object.values({ ...(finca.familyRatings || {}), ...(state.localRatings[finca.id] || {}) }).filter(entry => entry && entry.scores);
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

function quickRatingsFor(finca) { return { ...(finca.quickRatings || {}), ...(state.quickRatings[finca.id] || {}) }; }
function quickRating(finca, person) { return quickRatingsFor(finca)[person] ?? null; }
function quickRatingSummary(finca) {
  const values = Object.values(quickRatingsFor(finca)).map(Number).filter(Number.isFinite);
  return { average: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null, count: values.length };
}

function quickScoreControl(finca, context) {
  const person = state.selectedPerson;
  const value = quickRating(finca, person);
  const summary = quickRatingSummary(finca);
  return `<div class="quick-score" data-quick-score-box="${finca.id}" data-context="${context}">
    <div class="quick-score__head"><strong>Meine Bewertung</strong><span data-family-quick="${finca.id}">${summary.average ? `Familie ${summary.average.toFixed(1)} / 10` : 'Noch keine Familienwertung'}</span></div>
    <div class="quick-score__controls">
      <label>Wer bewertet?<select data-quick-person="${finca.id}" aria-label="Bewertende Person">${state.data.familyMembers.map(name => `<option value="${name}" ${name === person ? 'selected' : ''}>${name}</option>`).join('')}</select></label>
      <div class="score-buttons" role="group" aria-label="Bewertung von 1 bis 10">${Array.from({ length: 10 }, (_, index) => index + 1).map(score => `<button type="button" class="score-button ${value === score ? 'is-selected' : ''}" data-score-value="${score}" data-score-finca="${finca.id}" aria-pressed="${value === score}">${score}</button>`).join('')}</div>
    </div>
    <p class="sync-status ${state.syncStatus.startsWith('Online') ? 'is-online' : ''}" data-sync-status>${state.syncStatus}</p>
  </div>`;
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
    return (quickRatingSummary(b).average ?? -1) - (quickRatingSummary(a).average ?? -1);
  });
}

function ranking() {
  return [...state.data.fincas].filter(f => f.status !== 'excluded').sort((a,b) => (quickRatingSummary(b).average ?? -1) - (quickRatingSummary(a).average ?? -1) || (a.price ?? Infinity) - (b.price ?? Infinity));
}

function rankOf(finca) { const score = quickRatingSummary(finca); return score.count ? ranking().findIndex(item => item.id === finca.id) + 1 : null; }

function familyRatingLine(finca) {
  const values = quickRatingsFor(finca);
  return `<div class="family-rating-line">${state.data.familyMembers.map(person => `<span class="member-score ${values[person] ? 'has-score' : ''}"><b>${person}</b>${values[person] ?? '–'}</span>`).join('')}</div>`;
}

function criterionHint(label, status, detail) { return `<span class="criterion-hint ${status}"><b>${label}:</b> ${status === 'good' ? 'gut' : 'prüfen'}<small>${detail}</small></span>`; }
function sleepingStatus(finca) { return /prüfen|ungünstig|offen|separat|noch nicht/i.test(finca.sleepingConsiderations || '') ? 'check' : 'good'; }
function quietStatus(finca) { return /prüfen|hörbar|möglich|straße|ortsnah|nachbar/i.test(`${finca.privacy} ${finca.roadNoise}`) ? 'check' : 'good'; }

function poolArea(pool = {}) {
  if (!unknown(pool.area) && Number.isFinite(Number(pool.area))) return Number(pool.area);
  if (!unknown(pool.length) && !unknown(pool.width) && Number.isFinite(Number(pool.length)) && Number.isFinite(Number(pool.width))) return Number(pool.length) * Number(pool.width);
  return null;
}

function poolSummary(pool = {}) {
  const area = poolArea(pool);
  const number = value => new Intl.NumberFormat('de-DE', { maximumFractionDigits:1 }).format(value);
  const parts = [];
  if (area !== null) parts.push(`${number(area)} m²`);
  if (!unknown(pool.length) && !unknown(pool.width)) parts.push(`${number(pool.length)} × ${number(pool.width)} m`);
  if (!unknown(pool.minDepth) || !unknown(pool.maxDepth)) {
    const depthText = !unknown(pool.minDepth) && !unknown(pool.maxDepth) && Number(pool.minDepth) !== Number(pool.maxDepth)
      ? `${number(pool.minDepth)}–${number(pool.maxDepth)} m tief`
      : `${number(!unknown(pool.maxDepth) ? pool.maxDepth : pool.minDepth)} m tief`;
    parts.push(depthText);
  }
  if (pool.saltwater === true) parts.push('Salzwasser');
  if (!parts.length) parts.push(text(pool.display, 'Maße offen'));
  return parts.join(' · ');
}

function largestPoolArea() {
  return Math.max(...state.data.fincas.filter(finca => finca.status !== 'excluded').map(finca => poolArea(finca.pool)).filter(area => area !== null));
}

function poolBadge(finca) {
  const area = poolArea(finca.pool);
  const largest = area !== null && area === largestPoolArea();
  return `<span class="pool-fact ${largest ? 'is-largest' : ''}">◉ Pool ${poolSummary(finca.pool)}${largest ? '<b>Größter Pool</b>' : ''}</span>`;
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
      <div class="finca-title-row"><h3>${finca.name}</h3><div class="price">${money(finca.price)}<small>${finca.nights || state.data.trip.nights} Nächte</small></div></div>
      <div class="quick-facts"><span>⌂ ${text(finca.bedrooms)} Schlafzimmer</span>${poolBadge(finca)}</div>
      <div class="criteria-strip">${criterionHint('Schlafen', sleepingStatus(finca), finca.sleepingConsiderations)}${criterionHint('Ruhe', quietStatus(finca), `${finca.privacy}; ${finca.roadNoise}`)}</div>
      ${familyRatingLine(finca)}
      ${availabilityBar(finca)}
      ${quickScoreControl(finca, 'card')}
      <div class="card-actions"><button data-detail="${finca.id}">Details ansehen</button><a href="${finca.listingUrl}" target="_blank" rel="noopener">Inserat ↗</a></div>
    </div>
  </article>`;
}

function renderSpotlight(list) {
  const ranked = ranking().filter(finca => list.some(item => item.id === finca.id));
  const finca = ranked.find(f => quickRatingSummary(f).count) || list[0];
  const family = finca ? quickRatingSummary(finca) : { average:null, count:0 };
  const image = finca ? gallery(finca)[0] : null;
  $('#spotlight').innerHTML = finca ? `<article class="spotlight-card ${family.count ? 'has-winner' : ''}" style="--card-art:${art(finca)}" data-detail="${finca.id}">
    ${image ? `<img src="${image.url}" alt="${image.alt || finca.name}">` : ''}
    <div><p class="eyebrow">${family.count ? 'Aktuell auf Platz 1' : 'Noch ohne Familienwertung'}</p><h3>${finca.name}</h3><div class="spotlight-meta"><span>${text(finca.location)}</span><span>•</span><span>${money(finca.price)}</span><span>•</span><span>${family.count} von 6 bewertet</span></div><a class="spotlight-link" href="${finca.listingUrl}" target="_blank" rel="noopener">Inserat öffnen ↗</a></div>
    <span class="score-badge">${family.average?.toFixed(1) || '–'}<small>Familie</small></span>
  </article>` : '';
}

function renderComparison() {
  const ranked = ranking().slice(0,5);
  $('#comparison-list').innerHTML = ranked.map((f,i) => { const family=quickRatingSummary(f); return `<article class="comparison-card ${i===0&&family.count?'is-winner':''}" data-detail="${f.id}"><span class="rank">${i+1}</span><div><h3>${f.name}</h3><p>${text(f.region)} · ${money(f.price)} · Pool ${poolSummary(f.pool)}</p>${familyRatingLine(f)}</div><span class="comparison-score">${family.average?.toFixed(1) || 'offen'}</span></article>`; }).join('');
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
  $('#detail-content').innerHTML = `<div class="detail-hero" style="--card-art:${art(finca)}" data-enlarge="${finca.id}">${galleryMedia(finca, 'detail')}<button class="dialog-close" data-close-detail aria-label="Schließen">×</button><div><p class="eyebrow">${text(finca.region)} · ${text(finca.location)}</p><h2>${finca.name}</h2></div></div>
    <div class="detail-body">
      <div class="detail-summary"><div><strong>${money(finca.price)}</strong><span>${finca.nights || state.data.trip.nights} Nächte</span></div><div><strong>${text(finca.bedrooms)}</strong><span>Schlafzimmer</span></div><div><strong>${text(finca.bathrooms)}</strong><span>Bäder</span></div></div>
      ${availabilityBar(finca)}
      <div class="availability-legend"><span><i class="available"></i> verfügbar</span><span><i class="unavailable"></i> nicht verfügbar</span><span><i class="unknown"></i> ungeklärt</span><p>Die dunkle Unterkante markiert unseren Idealzeitraum. Der Balken umfasst das gesamte mögliche Urlaubsfenster.</p></div>
      ${quickScoreControl(finca, 'detail')}
      <section class="detail-section"><h3>Schlafen & Komfort</h3><div class="fact-list">
        ${fact('Kapazität', finca.sleepingCapacity || (!unknown(finca.beds) ? `${finca.beds} Schlafplätze – grundsätzlich großzügig.` : 'Kapazität noch zu prüfen.'))}${fact('Praktische Aufteilung', finca.sleepingConsiderations || finca.bedConfiguration)}${explanation('Die Anzahl der Schlafplätze ist zunächst positiv oder neutral. Separat betrachten wir, ob ihre Verteilung für Erwachsene und Kinder praktisch funktioniert.')}${fact('Klimaanlage', finca.airConditioning)}${fact('Waschmaschine', finca.washingMachine)}
      </div></section>
      <section class="detail-section"><h3>Pool & Geselligkeit</h3><div class="fact-list">
        ${fact('Poolgröße', poolSummary(pool))}${fact('Springen & Toben', pool.jumpingAssessment)}${fact('Terrasse → Pool', finca.terraceToPool)}${fact('Pool im Blick', finca.poolVisibility)}${explanation('„Pool im Blick“ bewertet, ob man die Kinder vom Esstisch, der überdachten Terrasse oder aus der Küche direkt sehen kann – ohne Mauern, Höhenversatz oder entfernten Poolbereich.')}${fact('Außenküche', finca.outdoorKitchen)}${fact('Grill', finca.barbecue)}
      </div></section>
      <section class="detail-section"><h3>Lage & Atmosphäre</h3><div class="fact-list">
        ${fact('Privatsphäre', finca.privacy)}${fact('Nachbarn', finca.neighbours)}${fact('Straßenlärm', finca.roadNoise)}${fact('Außenbereich', finca.outdoorArea)}${fact('Strand', finca.beachDistance)}${fact('Ort', finca.townDistance)}
      </div></section>
      <section class="detail-section impression-section"><h3>Unser Eindruck</h3><p class="impression-text">${text(finca.ourImpression, finca.memoryAnchor)}</p>${notes.length ? `<div class="notes">${notes.join('')}</div>` : ''}${personalNotesPanel(finca)}</section>
      ${ratingPanel(finca)}
      <a class="detail-cta" href="${finca.listingUrl}" target="_blank" rel="noopener">Original-Inserat öffnen ↗</a>
    </div>`;
  $('#detail-dialog').showModal();
}

function fact(label, value) { return `<div class="fact-row"><span>${label}</span><strong>${text(value)}</strong></div>`; }
function explanation(value) { return `<p class="fact-explanation">${value}</p>`; }
function depth(pool) { return unknown(pool.minDepth) && unknown(pool.maxDepth) ? null : `${text(pool.minDepth)}–${text(pool.maxDepth)} m`; }

function ratingPanel(finca) {
  const savedByPerson = { ...(finca.familyRatings || {}), ...(state.localRatings[finca.id] || {}) };
  return `<details class="detail-section rating-section"><summary>Optionale Detailbewertung nach Kriterien</summary><div class="rating-section__inner">
    <p class="rating-intro">Diese ausführliche Zusatzbewertung betrachtet neun Einzelkriterien. Sie verändert den leicht verständlichen Familien-Durchschnitt und das Ranking nicht.</p>
    <label class="person-select">Wer bewertet?<select id="rating-person">${state.data.familyMembers.map(person => `<option value="${person}">${person}${savedByPerson[person] ? ' · gespeichert' : ''}</option>`).join('')}</select></label>
    <div id="rating-fields">${ratingFields(finca, state.data.familyMembers[0])}</div>
    <label class="rating-comment">Kommentar<textarea id="rating-comment" rows="3" placeholder="Was ist dir besonders wichtig?">${savedByPerson[state.data.familyMembers[0]]?.comment || ''}</textarea></label>
    <label class="favorite-check"><input type="checkbox" id="rating-favorite" ${savedByPerson[state.data.familyMembers[0]]?.favorite ? 'checked' : ''}> Das ist mein persönlicher Favorit</label>
    <button class="save-rating" data-save-rating="${finca.id}">Bewertung speichern</button>
    <p class="rating-saved" id="rating-saved" aria-live="polite"></p>
    <p class="local-note">Diese Bewertung wird in Version 1 nur auf diesem Gerät gespeichert.</p></div>
  </details>`;
}

function ratingFields(finca, person) {
  const saved = (state.localRatings[finca.id]?.[person] || finca.familyRatings?.[person] || {}).scores || {};
  return state.data.ratingCriteria.map(criterion => {
    const value = saved[criterion.id] ?? 5;
    return `<label class="rating-row"><span>${criterion.label}${criterion.required ? ' <b>Muss</b>' : ''}</span><output>${value}</output><input type="range" min="1" max="10" value="${value}" data-rating-criterion="${criterion.id}" aria-label="${criterion.label}"></label>`;
  }).join('');
}

function loadPersonRating(finca, person) {
  $('#rating-fields').innerHTML = ratingFields(finca, person);
  const saved = state.localRatings[finca.id]?.[person] || finca.familyRatings?.[person] || {};
  $('#rating-comment').value = saved.comment || '';
  $('#rating-favorite').checked = Boolean(saved.favorite);
}

function saveRating(finca) {
  const person = $('#rating-person').value;
  const scores = Object.fromEntries($$('[data-rating-criterion]').map(input => [input.dataset.ratingCriterion, Number(input.value)]));
  state.localRatings[finca.id] ||= {};
  state.localRatings[finca.id][person] = { scores, comment: $('#rating-comment').value.trim(), dealbreaker: null, favorite: $('#rating-favorite').checked };
  localStorage.setItem('finca-ratings', JSON.stringify(state.localRatings));
  $('#rating-saved').textContent = `Bewertung von ${person} gespeichert. Neuer Familienwert: ${ratingSummary(finca).score?.toFixed(1) || '–'}`;
  render();
}

function personalNotesPanel(finca) {
  const notes = state.personalNotes[finca.id] || {};
  return `<div class="personal-notes"><h4>Persönliche Ergänzungen</h4><div class="personal-note-list" data-note-list="${finca.id}">${Object.entries(notes).map(([person,note]) => `<p><strong>${person}:</strong> ${note}</p>`).join('') || '<p class="empty-note">Noch keine persönlichen Notizen.</p>'}</div>
    <div class="personal-note-form"><select data-note-person="${finca.id}">${state.data.familyMembers.map(person => `<option value="${person}">${person}</option>`).join('')}</select><input type="text" maxlength="180" data-note-input="${finca.id}" placeholder="Kurze persönliche Notiz"><button type="button" data-save-note="${finca.id}">Notiz speichern</button></div>
    <p class="local-note">Notizen werden in Version 1 nur auf diesem Gerät gespeichert.</p></div>`;
}

async function saveQuickRating(id, person, value) {
  state.quickRatings[id] ||= {};
  state.quickRatings[id][person] = Number(value);
  localStorage.setItem('finca-quick-ratings', JSON.stringify(state.quickRatings));
  render();
  if (!firebase) {
    state.pendingRatings.push({ id, person, score:Number(value) });
    setSyncStatus('Verbindung wird hergestellt – Bewertung vorgemerkt');
    return;
  }
  setSyncStatus('Wird gespeichert …');
  try {
    await firebase.setDoc(firebase.doc(firebase.db, 'ratings', ratingDocumentId(id, person)), {
      fincaId: id,
      person,
      score: Number(value),
      updatedAt: firebase.serverTimestamp()
    });
    setSyncStatus('Online gespeichert ✓');
  } catch (error) {
    console.error(error);
    setSyncStatus('Speichern fehlgeschlagen – bitte erneut versuchen');
  }
}

function syncQuickScoreControls(finca, person) {
  state.selectedPerson = person;
  localStorage.setItem('finca-selected-person', person);
  render();
}

function ratingDocumentId(fincaId, person) { return `${fincaId}--${person.toLowerCase()}`; }

function setSyncStatus(message) {
  state.syncStatus = message;
  $$('[data-sync-status]').forEach(element => {
    element.textContent = message;
    element.classList.toggle('is-online', message.startsWith('Online'));
  });
}

async function connectSharedRatings() {
  try {
    const [{ initializeApp }, authApi, firestoreApi] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js')
    ]);
    const app = initializeApp(firebaseConfig);
    const auth = authApi.getAuth(app);
    await authApi.signInAnonymously(auth);
    const db = firestoreApi.getFirestore(app);
    firebase = { db, ...firestoreApi };

    const ratingsCollection = firestoreApi.collection(db, 'ratings');
    const initial = await firestoreApi.getDocs(ratingsCollection);
    state.quickRatings = {};
    initial.forEach(snapshot => {
      const rating = snapshot.data();
      state.quickRatings[rating.fincaId] ||= {};
      state.quickRatings[rating.fincaId][rating.person] = rating.score;
    });
    const pending = state.pendingRatings.splice(0);
    await Promise.all(pending.map(rating => firestoreApi.setDoc(firestoreApi.doc(db, 'ratings', ratingDocumentId(rating.id, rating.person)), { fincaId:rating.id, person:rating.person, score:rating.score, updatedAt:firestoreApi.serverTimestamp() })));

    firestoreApi.onSnapshot(ratingsCollection, snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'removed') return;
        const rating = change.doc.data();
        state.quickRatings[rating.fincaId] ||= {};
        state.quickRatings[rating.fincaId][rating.person] = rating.score;
      });
      localStorage.setItem('finca-quick-ratings', JSON.stringify(state.quickRatings));
      state.syncStatus = 'Online synchronisiert ✓';
      render();
    }, error => {
      console.error(error);
      setSyncStatus('Keine Online-Verbindung – lokale Anzeige aktiv');
    });
  } catch (error) {
    console.error(error);
    setSyncStatus('Keine Online-Verbindung – lokale Anzeige aktiv');
  }
}

function savePersonalNote(finca) {
  const person = $(`[data-note-person="${finca.id}"]`).value;
  const input = $(`[data-note-input="${finca.id}"]`);
  const note = input.value.trim();
  if (!note) { input.focus(); return; }
  state.personalNotes[finca.id] ||= {};
  state.personalNotes[finca.id][person] = note;
  localStorage.setItem('finca-personal-notes', JSON.stringify(state.personalNotes));
  const list = $(`[data-note-list="${finca.id}"]`);
  list.innerHTML = Object.entries(state.personalNotes[finca.id]).map(([name,value]) => `<p><strong>${name}:</strong> ${value}</p>`).join('');
  input.value = '';
}

function populateFilters() {
  const regions = [...new Set(state.data.fincas.map(f => f.region).filter(Boolean))].sort();
  $('#region-filter').innerHTML += regions.map(region => `<option value="${region}">${region}</option>`).join('');
}

function setupEvents() {
  document.addEventListener('click', event => {
    const scoreButton = event.target.closest('[data-score-value]');
    if (scoreButton) { saveQuickRating(scoreButton.dataset.scoreFinca, state.selectedPerson, scoreButton.dataset.scoreValue); return; }
    const galleryButton = event.target.closest('[data-gallery-step]');
    if (galleryButton) { event.stopPropagation(); stepGallery(galleryButton.dataset.galleryId, Number(galleryButton.dataset.galleryStep), galleryButton.closest('.finca-image, .detail-hero')); return; }
    const detail = event.target.closest('[data-detail]');
    if (detail) renderDetail(state.data.fincas.find(f => f.id === detail.dataset.detail));
    const favorite = event.target.closest('[data-favorite]');
    if (favorite) { event.stopPropagation(); state.favorites.has(favorite.dataset.favorite) ? state.favorites.delete(favorite.dataset.favorite) : state.favorites.add(favorite.dataset.favorite); localStorage.setItem('finca-favorites', JSON.stringify([...state.favorites])); render(); }
    if (event.target.closest('[data-close-detail]')) $('#detail-dialog').close();
    if (event.target.closest('[data-close-lightbox]')) $('#lightbox').close();
    if (event.target.closest('[data-close-suggest]')) $('#suggest-dialog').close();
    const enlarge = event.target.closest('[data-enlarge]');
    if (enlarge && event.target.tagName === 'IMG') openLightbox(enlarge.dataset.enlarge, Number(event.target.dataset.index || 0));
    const lightboxStep = event.target.closest('[data-lightbox-step]');
    if (lightboxStep) stepLightbox(Number(lightboxStep.dataset.lightboxStep));
    const saveButton = event.target.closest('[data-save-rating]');
    if (saveButton) saveRating(state.data.fincas.find(f => f.id === saveButton.dataset.saveRating));
    const noteButton = event.target.closest('[data-save-note]');
    if (noteButton) savePersonalNote(state.data.fincas.find(f => f.id === noteButton.dataset.saveNote));
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
  document.addEventListener('input', e => {
    if (e.target.matches('[data-rating-criterion]')) e.target.closest('.rating-row').querySelector('output').value = e.target.value;
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'rating-person') { const id = e.target.closest('#detail-content').querySelector('[data-save-rating]').dataset.saveRating; loadPersonRating(state.data.fincas.find(f => f.id === id), e.target.value); }
    if (e.target.matches('[data-quick-person]')) syncQuickScoreControls(state.data.fincas.find(f => f.id === e.target.dataset.quickPerson), e.target.value);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') $$('dialog[open]').forEach(dialog => dialog.close());
  });
  $$('dialog').forEach(dialog => dialog.addEventListener('cancel', event => { event.preventDefault(); dialog.close(); }));
  $('#detail-dialog').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });
  $('#suggest-dialog').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });
  $('#lightbox').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });
}

function stepGallery(id, delta, container) {
  const finca = state.data.fincas.find(f => f.id === id);
  const images = gallery(finca);
  const img = $('[data-gallery-image]', container);
  const current = Number(img.dataset.index || 0);
  const next = (current + delta + images.length) % images.length;
  img.src = images[next].url; img.alt = images[next].alt || finca.name; img.dataset.index = next;
  const count = $('[data-gallery-count]', container); if (count) count.textContent = `${next + 1} / ${images.length}`;
}

function openLightbox(id, index) {
  const box = $('#lightbox'); box.dataset.fincaId = id; box.dataset.index = index;
  updateLightbox(); box.showModal();
}

function stepLightbox(delta) {
  const box = $('#lightbox'); const images = gallery(state.data.fincas.find(f => f.id === box.dataset.fincaId));
  box.dataset.index = (Number(box.dataset.index || 0) + delta + images.length) % images.length; updateLightbox();
}

function updateLightbox() {
  const box = $('#lightbox'); const finca = state.data.fincas.find(f => f.id === box.dataset.fincaId); const images = gallery(finca); const index = Number(box.dataset.index || 0);
  $('#lightbox-image').src = images[index].url; $('#lightbox-image').alt = images[index].alt || finca.name; $('#lightbox-count').textContent = `${index + 1} / ${images.length}`;
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
    const [configResponse, indexResponse] = await Promise.all([
      fetch('data/config.json', { cache: 'no-store' }),
      fetch('data/fincas/index.json', { cache: 'no-store' })
    ]);
    if (!configResponse.ok) throw new Error(`Konfiguration: HTTP ${configResponse.status}`);
    if (!indexResponse.ok) throw new Error(`Finca-Index: HTTP ${indexResponse.status}`);
    const [config, fincaFiles] = await Promise.all([configResponse.json(), indexResponse.json()]);
    const fincaResponses = await Promise.all(fincaFiles.map(file => fetch(`data/fincas/${file}`, { cache: 'no-store' })));
    const failedResponse = fincaResponses.find(response => !response.ok);
    if (failedResponse) throw new Error(`Finca-Datensatz: HTTP ${failedResponse.status}`);
    const fincas = await Promise.all(fincaResponses.map(response => response.json()));
    state.data = { ...config, fincas };
    renderTrip(); populateFilters(); setupEvents(); render(); connectSharedRatings();
  } catch (error) {
    $('#finca-grid').innerHTML = '<div class="note negative"><strong>Daten konnten nicht geladen werden.</strong><br>Bitte die App über GitHub Pages oder einen lokalen Webserver öffnen.</div>';
    console.error(error);
  }
}

init();

