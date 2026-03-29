(function(){
  const LANG = document.documentElement.lang;
  const TZ = 'Europe/Vilnius';
  const LOCALE = ({lt:'lt-LT',en:'en-GB',pl:'pl-PL',uk:'uk-UA',ru:'ru-RU'}[LANG] || 'lt-LT');

  async function loadJSON(path){
    const res = await fetch(path, {cache:'no-cache'});
    if(!res.ok) throw new Error('Fetch failed: '+path);
    return res.json();
  }

  function fmtDateTime(dateStr, timeStr){
    const iso = `${dateStr}T${timeStr||'00:00'}:00`;
    const d = new Date(iso);
    const datePart = new Intl.DateTimeFormat(LOCALE,{timeZone:TZ, day:'numeric', month:'long'}).format(d);
    if(!timeStr) return datePart;
    const timePart = new Intl.DateTimeFormat(LOCALE,{timeZone:TZ, hour:'2-digit', minute:'2-digit', hour12:false}).format(d);
    return `${datePart} | ${timePart}`;
  }

  function escapeICS(text){
    return String(text||'')
      .replaceAll('\', '\\')
      .replaceAll('
', '\n')
      .replaceAll(',', '\,')
      .replaceAll(';', '\;');
  }

  function icsBlobUrl({title,startISO,endISO,location,description}){
    const toICSLocal = (iso)=>{
      const d = new Date(iso);
      const pad = n => String(n).padStart(2,'0');
      return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
    };
    const uid = `salinrankas-${Math.random().toString(16).slice(2)}@github-pages`;
    const dtStamp = new Date().toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';

    const lines = [
      'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Salin Rankas//LT//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtStamp}`,
      `SUMMARY:${escapeICS(title)}`,
      `DESCRIPTION:${escapeICS(description||'')}`,
      `LOCATION:${escapeICS(location||'')}`,
      `DTSTART;TZID=${TZ}:${toICSLocal(startISO)}`
    ];
    if(endISO) lines.push(`DTEND;TZID=${TZ}:${toICSLocal(endISO)}`);
    lines.push('END:VEVENT','END:VCALENDAR');

    const blob = new Blob([lines.join('
')], {type:'text/calendar;charset=utf-8'});
    return URL.createObjectURL(blob);
  }

  function makeShareUrls(url){
    const u = encodeURIComponent(url);
    return { fb: `https://www.facebook.com/sharer/sharer.php?u=${u}` };
  }

  (async function init(){
    const ui = await loadJSON('/data/ui.json');
    const dict = ui[LANG] || ui.lt;

    document.querySelectorAll('[data-i18n]').forEach(el=>{
      const key = el.getAttribute('data-i18n');
      if(dict[key]) el.textContent = dict[key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{
      const key = el.getAttribute('data-i18n-placeholder');
      if(dict[key]) el.setAttribute('placeholder', dict[key]);
    });

    const mapBtn = document.getElementById('load-map-btn');
    if(mapBtn){
      mapBtn.textContent = dict.mapBtn;
      mapBtn.setAttribute('data-loading', dict.mapLoading);
      mapBtn.setAttribute('data-toggle', dict.mapToggle);
      mapBtn.setAttribute('data-error', dict.mapError);
    }

    // contact email
    const emailEls = document.querySelectorAll('[data-contact-email]');
    emailEls.forEach(a=>{ a.textContent = 'salinrankas.lt.zrpk4@passmail.net'; a.setAttribute('href','mailto:salinrankas.lt.zrpk4@passmail.net'); });

    const posts = await loadJSON('/data/posts.json');

    // next event
    const events = posts.filter(p=>p.type==='event').sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));
    const next = events[0];
    if(next){
      const dt = fmtDateTime(next.date, next.time);
      const title = (next.title[LANG]||next.title.lt);
      const place = (next.locationName[LANG]||next.locationName.lt);

      const dtEl = document.getElementById('event-datetime');
      const titleEl = document.getElementById('event-title');
      const labelEl = document.getElementById('event-label');
      if(dtEl) dtEl.textContent = dt;
      if(titleEl) titleEl.textContent = title;
      if(labelEl) labelEl.textContent = dict.nextEvent;

      const ics = document.getElementById('event-ics');
      if(ics){
        ics.textContent = dict.ics;
        ics.href = icsBlobUrl({
          title,
          startISO: `${next.date}T${next.time}:00`,
          endISO: `${next.date}T20:00:00`,
          location: place,
          description: dict.siteTitle
        });
        ics.setAttribute('download', `salin-rankas-${LANG}-event.ics`);
      }

      const fb = document.getElementById('event-fb');
      if(fb && next.links && next.links.facebookEvent){
        fb.textContent = dict.fbEvent;
        fb.href = next.links.facebookEvent;
        fb.hidden = false;
      }

      const map = document.getElementById('map');
      if(map && next.coords){
        map.dataset.lat = next.coords.lat;
        map.dataset.lng = next.coords.lng;
        map.dataset.label = place;
        const osm = document.getElementById('open-osm');
        if(osm){
          osm.textContent = dict.openOSM;
          osm.href = `https://www.openstreetmap.org/?mlat=${next.coords.lat}&mlon=${next.coords.lng}#map=17/${next.coords.lat}/${next.coords.lng}`;
        }
      }

      const share = makeShareUrls(location.href);
      const shareFb = document.getElementById('share-fb');
      if(shareFb) shareFb.href = share.fb;
      const shareCopy = document.getElementById('share-copy');
      if(shareCopy){
        shareCopy.addEventListener('click', async ()=>{
          try{ await navigator.clipboard.writeText(location.href); shareCopy.textContent = '✓'; setTimeout(()=>shareCopy.textContent=dict.share, 900);}catch(e){}
        });
      }
    }

    // feed render
    const feed = document.querySelector('[data-search-list]');
    if(feed){
      feed.innerHTML='';
      posts.slice().sort((a,b)=>(b.date+(b.time||'')).localeCompare(a.date+(a.time||''))).forEach(p=>{
        const isEvent = p.type==='event';
        const title = (p.title[LANG]||p.title.lt);
        const summary = (p.summary && (p.summary[LANG]||p.summary.lt)) || '';
        const metaParts = [p.date];
        if(isEvent && p.time) metaParts.push(p.time);
        if(isEvent && p.locationName) metaParts.push((p.locationName[LANG]||p.locationName.lt));
        const meta = metaParts.join(' · ');
        const hay = [title, summary, meta].join(' ');

        const el = document.createElement('div');
        el.className='card item';
        el.setAttribute('data-search-item','');
        el.setAttribute('data-search-hay', hay);

        const badge = document.createElement('span');
        badge.className='badge';
        badge.textContent = isEvent ? 'EVENT' : 'NEWS';

        const h = document.createElement('div');
        h.style.fontWeight='900';
        h.textContent = title;

        const m = document.createElement('div');
        m.className='meta';
        m.textContent = meta;

        el.appendChild(badge); el.appendChild(h); el.appendChild(m);
        if(summary){
          const s = document.createElement('div');
          s.className='small';
          s.textContent = summary;
          el.appendChild(s);
        }
        if(isEvent && p.links && p.links.facebookEvent){
          const a = document.createElement('a');
          a.href = p.links.facebookEvent;
          a.target='_blank';
          a.rel='noopener noreferrer';
          a.className='small';
          a.style.color='var(--accent2)';
          a.style.fontWeight='800';
          a.textContent = dict.fbEvent;
          el.appendChild(a);
        }
        feed.appendChild(el);
      });
    }

    // archive render
    const archiveList = document.querySelector('[data-archive-list]');
    if(archiveList){
      const galleries = await loadJSON('/data/gallery.json');
      const items = (galleries||[]).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
      archiveList.innerHTML='';
      if(items.length===0){
        const empty=document.createElement('div');
        empty.className='card small';
        empty.textContent = dict.noArchive;
        archiveList.appendChild(empty);
      } else {
        items.forEach(g=>{
          const title = (g.title && (g.title[LANG]||g.title.lt)) || g.id;
          const date = g.date ? fmtDateTime(g.date, null) : '';
          const el = document.createElement('div');
          el.className='card item';

          const badge=document.createElement('span');
          badge.className='badge';
          badge.textContent='ARCHIVE';

          const h=document.createElement('div');
          h.style.fontWeight='900';
          h.textContent = title;

          el.appendChild(badge); el.appendChild(h);
          if(date){
            const m=document.createElement('div');
            m.className='meta';
            m.textContent=date;
            el.appendChild(m);
          }

          const links=(g.links||[]).filter(x=>x && x.url);
          links.forEach(li=>{
            const a=document.createElement('a');
            a.href=li.url; a.target='_blank'; a.rel='noopener noreferrer';
            a.className='small';
            a.style.color='var(--accent2)';
            a.style.fontWeight='800';
            a.textContent = (li.label && (li.label[LANG]||li.label.lt)) || 'Gallery';
            el.appendChild(a);
          });

          archiveList.appendChild(el);
        });
      }
    }
  })();
})();