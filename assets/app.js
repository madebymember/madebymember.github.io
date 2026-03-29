// Search filter + map load-on-click
(function(){
  const input = document.querySelector('[data-search-input]');
  const list = document.querySelector('[data-search-list]');
  if(input && list){
    const items = Array.from(list.querySelectorAll('[data-search-item]'));
    input.addEventListener('input', ()=>{
      const q = input.value.trim().toLowerCase();
      for(const el of items){
        const hay = (el.getAttribute('data-search-hay')||'').toLowerCase();
        el.style.display = (!q || hay.includes(q)) ? '' : 'none';
      }
    });
  }

  const btn = document.getElementById('load-map-btn');
  const mapEl = document.getElementById('map');
  if(btn && mapEl){
    let loaded = false;
    btn.addEventListener('click', async ()=>{
      if(loaded){
        mapEl.hidden = !mapEl.hidden;
        if(!mapEl.hidden && mapEl._leaflet_map){ mapEl._leaflet_map.invalidateSize(); }
        return;
      }
      loaded = true;
      btn.disabled = true;
      btn.textContent = btn.getAttribute('data-loading') || 'Loading map…';
      try{
        await loadLeaflet();
        const lat = parseFloat(mapEl.dataset.lat);
        const lng = parseFloat(mapEl.dataset.lng);
        const label = mapEl.dataset.label || '';
        mapEl.hidden = false;
        const map = L.map(mapEl,{zoomControl:true,scrollWheelZoom:false}).setView([lat,lng],16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);
        const m = L.marker([lat,lng]).addTo(map);
        if(label) m.bindPopup(label);
        mapEl._leaflet_map = map;
        btn.textContent = btn.getAttribute('data-toggle') || 'Hide / show map';
        btn.disabled = false;
      }catch(e){
        console.error(e);
        btn.textContent = btn.getAttribute('data-error') || 'Map failed to load';
        btn.disabled = false;
      }
    });
  }

  function loadLeaflet(){
    return new Promise((resolve,reject)=>{
      if(window.L) return resolve();
      const css = document.createElement('link');
      css.rel='stylesheet';
      css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      css.integrity='sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      css.crossOrigin='';
      document.head.appendChild(css);
      const s = document.createElement('script');
      s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.integrity='sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      s.crossOrigin='';
      s.defer=true;
      s.onload=()=>resolve();
      s.onerror=()=>reject(new Error('Leaflet load error'));
      document.body.appendChild(s);
    });
  }
})();