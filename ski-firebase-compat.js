/* Compatibility layer: keep Firestore writes within the original ratings schema. */
(function(){
  /* app.js still contains the old Firestore reader. Disable it for this Ski build;
     this compatibility layer is the single source of truth for Firebase data. */
  try { window.connectFirebase = async function(){}; } catch(error) { console.warn(error); }

  const encodePayload = value => btoa(unescape(encodeURIComponent(JSON.stringify(value))));
  const decodePayload = value => JSON.parse(decodeURIComponent(escape(atob(value))));
  const slug = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

  async function connectFirebaseCompat(){
    const [appApi, authApi, firestoreApi] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js')
    ]);
    const app = appApi.getApps().length ? appApi.getApp() : appApi.initializeApp(firebaseConfig);
    const auth = authApi.getAuth(app);
    if (!auth.currentUser) await authApi.signInAnonymously(auth);
    const db = firestoreApi.getFirestore(app);
    state.firebase = { db, ...firestoreApi };

    firestoreApi.onSnapshot(firestoreApi.collection(db,'ratings'), snapshot => {
      const accommodations=[];
      const ratings=[];
      snapshot.forEach(documentSnapshot => {
        const data=documentSnapshot.data();
        if(typeof data.fincaId !== 'string') return;
        if(data.fincaId.startsWith('ski-accommodation:')){
          try {
            const payload=decodePayload(data.fincaId.slice('ski-accommodation:'.length));
            accommodations.push({id:documentSnapshot.id,...payload});
          } catch(error){ console.warn('Ungültiger Ski-Unterkunftsdatensatz',error); }
        } else if(data.fincaId.startsWith('ski-rating:')){
          ratings.push({id:documentSnapshot.id,accommodationId:data.fincaId.slice('ski-rating:'.length),person:data.person,score:data.score});
        }
      });

      const applySnapshot = () => {
        state.accommodations=accommodations;
        state.ratings=ratings;
        state.online=true;
        render();
        updateDeleteButtons();
      };
      applySnapshot();
      /* If an already-started legacy listener races on first load, restore the
         correct compatibility snapshot immediately afterwards. */
      setTimeout(applySnapshot,150);
    }, error => {
      console.error(error);
      state.online=false;
      render();
    });
  }

  function updateDeleteButtons(){
    document.querySelectorAll('[data-delete]').forEach(button => {
      const accommodation=state.accommodations.find(item => item.id===button.dataset.delete);
      const isOwner=accommodation && accommodation.createdBy===state.selectedPerson;
      button.hidden=!isOwner;
      button.disabled=!isOwner;
      button.title=isOwner ? 'Diese Unterkunft löschen' : 'Nur der eintragende User kann löschen';
    });
  }

  async function saveAccommodationCompat(form){
    const status=$('#suggest-status');
    if(!form.reportValidity()) return;
    if(!state.selectedPerson){
      status.textContent='Bitte zuerst deinen User auswählen.';
      return;
    }
    if(!state.firebase){status.textContent='Firebase ist noch nicht verbunden. Bitte erneut versuchen.';return;}
    const value=id=>$(id).value.trim();
    const numberOrNull=id=>value(id)===''?null:Number(value(id));
    const payload={
      name:value('#accommodation-name'),
      url:value('#accommodation-url'),
      area:value('#accommodation-area'),
      type:value('#accommodation-type'),
      price:numberOrNull('#accommodation-price'),
      liftDistance:numberOrNull('#accommodation-lift'),
      food:value('#accommodation-food'),
      transport:value('#accommodation-transport'),
      wellness:$('#accommodation-wellness').checked,
      parking:$('#accommodation-parking').checked,
      skiroom:$('#accommodation-skiroom').checked,
      note:value('#accommodation-note'),
      createdBy:state.selectedPerson
    };
    status.textContent='Wird online gespeichert …';
    try{
      const id=`ski-accommodation--${crypto.randomUUID()}`;
      await state.firebase.setDoc(state.firebase.doc(state.firebase.db,'ratings',id),{
        fincaId:`ski-accommodation:${encodePayload(payload)}`,
        person:state.selectedPerson,
        score:1,
        updatedAt:state.firebase.serverTimestamp()
      });
      form.reset();
      status.textContent='Online gespeichert ✓';
      setTimeout(()=>{status.textContent='';$('#suggest-dialog').close();},500);
    }catch(error){
      console.error(error);
      status.textContent=`Speichern fehlgeschlagen: ${error.code||error.message||'Firebase-Fehler'}`;
    }
  }

  async function saveRatingCompat(accommodationId,score){
    if(!state.selectedPerson){ alert('Bitte zuerst deinen User auswählen.'); return; }
    if(!state.firebase) return;
    const id=`ski-rating--${slug(accommodationId)}--${slug(state.selectedPerson)}`;
    try{
      await state.firebase.setDoc(state.firebase.doc(state.firebase.db,'ratings',id),{
        fincaId:`ski-rating:${accommodationId}`,
        person:state.selectedPerson,
        score:Number(score),
        updatedAt:state.firebase.serverTimestamp()
      });
    }catch(error){
      console.error(error);
      alert(`Bewertung fehlgeschlagen: ${error.code||error.message}`);
    }
  }

  async function deleteAccommodationCompat(id){
    if(!state.firebase) return;
    const accommodation=state.accommodations.find(item=>item.id===id);
    if(!accommodation || accommodation.createdBy!==state.selectedPerson){
      alert('Nur der User, der diese Unterkunft eingetragen hat, kann sie löschen.');
      return;
    }
    if(!confirm('Diese Unterkunft wirklich löschen?')) return;
    try{
      await state.firebase.deleteDoc(state.firebase.doc(state.firebase.db,'ratings',id));
      const related=state.ratings.filter(rating=>rating.accommodationId===id);
      await Promise.all(related.map(rating=>state.firebase.deleteDoc(state.firebase.doc(state.firebase.db,'ratings',rating.id))));
    }catch(error){
      console.error(error);
      alert(`Löschen fehlgeschlagen: ${error.code||error.message||'Firebase-Fehler'}`);
    }
  }

  document.addEventListener('submit', event => {
    if(event.target && event.target.id === 'suggest-form'){
      event.preventDefault();
      event.stopImmediatePropagation();
      saveAccommodationCompat(event.target);
    }
  }, true);

  document.addEventListener('click', event => {
    const score = event.target.closest && event.target.closest('[data-score]');
    if(score){
      event.preventDefault();
      event.stopImmediatePropagation();
      saveRatingCompat(score.dataset.accommodation, score.dataset.score);
      return;
    }
    const remove = event.target.closest && event.target.closest('[data-delete]');
    if(remove){
      event.preventDefault();
      event.stopImmediatePropagation();
      deleteAccommodationCompat(remove.dataset.delete);
    }
  }, true);

  document.addEventListener('change', event => {
    if(event.target && event.target.matches('[data-person-select]')){
      setTimeout(updateDeleteButtons,0);
    }
  });

  connectFirebaseCompat().catch(error => {
    console.error(error);
    const status=$('#suggest-status');
    if(status) status.textContent=`Firebase-Verbindung fehlgeschlagen: ${error.code||error.message||'Fehler'}`;
  });
})();