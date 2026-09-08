const firebaseConfig = {
  apiKey: 'AIzaSyBeOU8wrUFrXr_tVx_fe5CxXYzSlyTPSbU',
  authDomain: 'mallorca-2027-finca-check.firebaseapp.com',
  projectId: 'mallorca-2027-finca-check',
  storageBucket: 'mallorca-2027-finca-check.firebasestorage.app',
  messagingSenderId: '296027815503',
  appId: '1:296027815503:web:a467fa59fcf4528f82b43a'
};

const state = {
  config: null,
  accommodations: [],
  ratings: [],
  sort: 'score',
  selectedPerson: localStorage.getItem('ski-selected-person') || 'User 1',
  firebase: null,
  online: false
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const money = value => value === null || value === undefined || value === ''
  ? 'Preis offen'
  : new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(value));
const safe = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[character]));

function scoreFor(accommodationId, person) {
  return state.ratings.find(rating => rating.accommodationId === accommodationId && rating.person === person)?.score ?? null;
}

function scoreSummary(accommodationId) {
  const values = state.ratings
    .filter(rating => rating.accommodationId === accommodationId)
    .map(rating => Number(rating.score))
    .filter(Number.isFinite);
  return {
    average: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
    count: values.length
  };
}

function sortedAccommodations() {
  const list = [...state.accommodations];
  return list.sort((a, b) => {
    if (state.sort === 'price') return (Number(a.price) || Infinity) - (Number(b.price) || Infinity);
    if (state.sort === 'lift') return (Number(a.liftDistance) || Infinity) - (Number(b.liftDistance) || Infinity);
    if (state.sort === 'name') return String(a.name).localeCompare(String(b.name), 'de');
    return (scoreSummary(b.id).average ?? -1) - (scoreSummary(a.id).average ?? -1);
  });
}

function renderTrip() {
  const trip = state.config.trip || {};
  $('#trip-facts').innerHTML = `
    <div class="trip-fact"><strong>${state.config.familyMembers.length}</strong><span>User</span></div>
    <div class="trip-fact"><strong>${safe(trip.datesLabel || 'Noch offen')}</strong><span>Reisezeitraum</span></div>
    <div class="trip-fact"><strong>1–10</strong><span>Bewertung</span></div>`;
}

function memberScores(accommodation) {
  return `<div class="family-rating-line">${state.config.familyMembers.map(person => {
    const value = scoreFor(accommodation.id, person);
    return `<span class="member-score ${value ? 'has-score' : ''}"><b>${safe(person)}</b>${value ?? '–'}</span>`;
  }).join('')}</div>`;
}

function ratingControl(accommodation) {
  const value = scoreFor(accommodation.id, state.selectedPerson);
  return `<div class="ski-rating-head"><strong>Meine Bewertung</strong><select data-person-select aria-label="User auswählen">${state.config.familyMembers.map(person => `<option value="${safe(person)}" ${person === state.selectedPerson ? 'selected' : ''}>${safe(person)}</option>`).join('')}</select></div>
    <div class="score-buttons" role="group" aria-label="Bewertung 1 bis 10">${Array.from({length:10}, (_, index) => index + 1).map(score => `<button type="button" class="${score === value ? 'is-selected' : ''}" data-score="${score}" data-accommodation="${accommodation.id}" aria-pressed="${score === value}">${score}</button>`).join('')}</div>
    <p class="sync-line">${state.online ? 'Firebase: online synchronisiert' : 'Firebase-Verbindung wird hergestellt …'}</p>`;
}

function meta(accommodation) {
  const values = [];
  if (accommodation.area) values.push(accommodation.area);
  if (accommodation.type) values.push(accommodation.type);
  if (Number(accommodation.liftDistance) >= 0 && accommodation.liftDistance !== '' && accommodation.liftDistance !== null) values.push(`${accommodation.liftDistance} m zum Lift`);
  if (accommodation.food) values.push(accommodation.food);
  if (accommodation.wellness) values.push('Sauna / Wellness');
  if (accommodation.parking) values.push('Parkplatz');
  if (accommodation.skiroom) values.push('Skiraum');
  if (accommodation.transport) values.push(accommodation.transport);
  return values.map(value => `<span>${safe(value)}</span>`).join('');
}

function card(accommodation, index) {
  const summary = scoreSummary(accommodation.id);
  return `<article class="finca-card ${index === 0 && summary.count ? 'is-winner' : ''}">
    <div class="finca-body">
      <span class="finca-kicker">${safe(accommodation.area || 'Skigebiet noch offen')} · ${safe(accommodation.type || 'Unterkunft')}</span>
      <div class="finca-title-row"><h3>${safe(accommodation.name)}</h3><div class="price">${money(accommodation.price)}<small>Gesamtpreis</small></div></div>
      <div class="ski-meta">${meta(accommodation)}</div>
      ${accommodation.note ? `<p class="ski-note">${safe(accommodation.note)}</p>` : ''}
      ${memberScores(accommodation)}
      ${ratingControl(accommodation)}
      <div class="accommodation-actions"><a href="${safe(accommodation.url)}" target="_blank" rel="noopener">Inserat öffnen ↗</a><button class="delete-accommodation" type="button" data-delete="${accommodation.id}">Löschen</button></div>
    </div>
  </article>`;
}

function renderComparison(list) {
  const ranked = [...list].sort((a,b) => (scoreSummary(b.id).average ?? -1) - (scoreSummary(a.id).average ?? -1)).slice(0,5);
  $('#comparison-list').innerHTML = ranked.length ? ranked.map((accommodation, index) => {
    const summary = scoreSummary(accommodation.id);
    return `<article class="comparison-card ${index === 0 && summary.count ? 'is-winner' : ''}">
      <span class="rank">${index + 1}</span><div><h3>${safe(accommodation.name)}</h3><p>${safe(accommodation.area || 'Ort offen')} · ${money(accommodation.price)}${accommodation.liftDistance !== '' && accommodation.liftDistance !== null && accommodation.liftDistance !== undefined ? ` · ${safe(accommodation.liftDistance)} m zum Lift` : ''}</p>${memberScores(accommodation)}</div><span class="comparison-score">${summary.average?.toFixed(1) || 'offen'}</span>
    </article>`;
  }).join('') : '<p>Noch keine Unterkünfte zum Vergleichen.</p>';
}

function render() {
  if (!state.config) return;
  const list = sortedAccommodations();
  $('#finca-grid').innerHTML = list.length
    ? list.map(card).join('')
    : `<div class="ski-empty"><strong>Noch keine Ski-Unterkunft eingetragen.</strong><span>Über „＋ Unterkunft hinzufügen“ kommt der erste Vorschlag direkt in Firebase.</span></div>`;
  renderComparison(list);
}

async function connectFirebase() {
  const [{ initializeApp }, authApi, firestoreApi] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js')
  ]);
  const app = initializeApp(firebaseConfig);
  const auth = authApi.getAuth(app);
  await authApi.signInAnonymously(auth);
  const db = firestoreApi.getFirestore(app);
  state.firebase = { db, ...firestoreApi };

  firestoreApi.onSnapshot(firestoreApi.collection(db, 'ratings'), snapshot => {
    const accommodations = [];
    const ratings = [];
    snapshot.forEach(documentSnapshot => {
      const data = documentSnapshot.data();
      if (data.recordType === 'skiAccommodation') accommodations.push({ id: documentSnapshot.id, ...data });
      if (data.recordType === 'skiRating') ratings.push({ id: documentSnapshot.id, ...data });
    });
    state.accommodations = accommodations;
    state.ratings = ratings;
    state.online = true;
    render();
  }, error => {
    console.error(error);
    state.online = false;
    render();
  });
}

async function saveAccommodation(form) {
  const status = $('#suggest-status');
  if (!form.reportValidity()) return;
  if (!state.firebase) {
    status.textContent = 'Firebase ist noch nicht verbunden. Bitte kurz erneut versuchen.';
    return;
  }
  status.textContent = 'Wird online gespeichert …';
  const value = id => $(id).value.trim();
  const numberOrNull = id => value(id) === '' ? null : Number(value(id));
  const record = {
    recordType: 'skiAccommodation',
    name: value('#accommodation-name'),
    url: value('#accommodation-url'),
    area: value('#accommodation-area'),
    type: value('#accommodation-type'),
    price: numberOrNull('#accommodation-price'),
    liftDistance: numberOrNull('#accommodation-lift'),
    food: value('#accommodation-food'),
    transport: value('#accommodation-transport'),
    wellness: $('#accommodation-wellness').checked,
    parking: $('#accommodation-parking').checked,
    skiroom: $('#accommodation-skiroom').checked,
    note: value('#accommodation-note'),
    createdBy: state.selectedPerson,
    createdAt: state.firebase.serverTimestamp()
  };
  try {
    const reference = state.firebase.doc(state.firebase.collection(state.firebase.db, 'ratings'));
    await state.firebase.setDoc(reference, record);
    form.reset();
    status.textContent = 'Online gespeichert ✓';
    setTimeout(() => { status.textContent = ''; $('#suggest-dialog').close(); }, 500);
  } catch (error) {
    console.error(error);
    status.textContent = 'Speichern in Firebase fehlgeschlagen.';
  }
}

async function saveRating(accommodationId, score) {
  if (!state.firebase) return;
  const id = `ski-rating--${accommodationId}--${state.selectedPerson.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  try {
    await state.firebase.setDoc(state.firebase.doc(state.firebase.db, 'ratings', id), {
      recordType: 'skiRating',
      accommodationId,
      person: state.selectedPerson,
      score: Number(score),
      updatedAt: state.firebase.serverTimestamp()
    });
  } catch (error) {
    console.error(error);
    alert('Die Bewertung konnte nicht in Firebase gespeichert werden.');
  }
}

async function deleteAccommodation(id) {
  if (!state.firebase || !confirm('Diese Unterkunft wirklich aus dem Ski-Check löschen?')) return;
  try {
    await state.firebase.deleteDoc(state.firebase.doc(state.firebase.db, 'ratings', id));
    const related = state.ratings.filter(rating => rating.accommodationId === id);
    await Promise.all(related.map(rating => state.firebase.deleteDoc(state.firebase.doc(state.firebase.db, 'ratings', rating.id))));
  } catch (error) {
    console.error(error);
    alert('Die Unterkunft konnte nicht gelöscht werden.');
  }
}

function setupEvents() {
  document.addEventListener('click', event => {
    const open = event.target.closest('[data-action="open-suggest"]');
    if (open) { $('#suggest-status').textContent = ''; $('#suggest-dialog').showModal(); return; }
    if (event.target.closest('[data-close-suggest]')) { $('#suggest-dialog').close(); return; }
    const score = event.target.closest('[data-score]');
    if (score) { saveRating(score.dataset.accommodation, score.dataset.score); return; }
    const remove = event.target.closest('[data-delete]');
    if (remove) { deleteAccommodation(remove.dataset.delete); return; }
    const toggle = event.target.closest('[data-action="toggle-filters"]');
    if (toggle) { const filters = $('#filters'); filters.hidden = !filters.hidden; toggle.setAttribute('aria-expanded', String(!filters.hidden)); return; }
    const scroll = event.target.closest('[data-scroll]');
    if (scroll) { document.getElementById(scroll.dataset.scroll).scrollIntoView({behavior:'smooth'}); }
  });
  document.addEventListener('change', event => {
    if (event.target.matches('[data-person-select]')) {
      state.selectedPerson = event.target.value;
      localStorage.setItem('ski-selected-person', state.selectedPerson);
      render();
    }
  });
  $('#sort-select').addEventListener('change', event => { state.sort = event.target.value; render(); });
  $('#suggest-form').addEventListener('submit', event => { event.preventDefault(); saveAccommodation(event.currentTarget); });
  $('#suggest-dialog').addEventListener('click', event => { if (event.target === event.currentTarget) event.currentTarget.close(); });
}

async function init() {
  try {
    const configResponse = await fetch('data/config.json', { cache: 'no-store' });
    if (!configResponse.ok) throw new Error(`Konfiguration: HTTP ${configResponse.status}`);
    state.config = await configResponse.json();
    if (!state.config.familyMembers.includes(state.selectedPerson)) state.selectedPerson = state.config.familyMembers[0];
    renderTrip();
    setupEvents();
    render();
    await connectFirebase();
  } catch (error) {
    console.error(error);
    $('#finca-grid').innerHTML = '<div class="ski-empty"><strong>App konnte nicht geladen werden.</strong><span>Bitte die Seite neu laden.</span></div>';
  }
}

init();
