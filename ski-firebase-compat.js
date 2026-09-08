/* Compatibility layer: keep Firestore writes within the original ratings schema. */
(function(){
  const encodePayload = value => btoa(unescape(encodeURIComponent(JSON.stringify(value))));
  const decodePayload = value => JSON.parse(decodeURIComponent(escape(atob(value))));
  const slug = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

  window.connectFirebase = async function connectFirebaseCompat(){
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
      state.accommodations=accommodations;
      state.ratings=ratings;
      state.online=true;
      render();
    }, error => {
      console.error(error);
      state.online=false;
      render();
    });
  };

  window.saveAccommodation = async function saveAccommodationCompat(form){
    const status=$('#suggest-status');
    if(!form.reportValidity()) return;
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
        person:'ski-system',
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
  };

  window.saveRating = async function saveRatingCompat(accommodationId,score){
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
  };
})();