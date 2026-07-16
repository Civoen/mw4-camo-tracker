// ============================================================
// MAPFAM UPLOAD CONFIG
// ============================================================
// By default this is null, which means images are stored directly in this
// browser's localStorage (as base64) so the page works immediately with no
// setup. That's fine for a handful of images, but localStorage typically
// caps out around 5-10MB per site — with 1080x1080 photos you'll hit that
// ceiling fast, and nothing here is shared between browsers/devices.
//
// To actually host images on Cloudflare R2:
//   1. Create an R2 bucket and a Worker that accepts an upload and returns
//      the public URL (see worker-example.js in this folder for a starting
//      point — it's untested starter code, not a deployed/verified service).
//   2. Deploy that Worker and set its URL below.
//   3. Once set, uploads POST straight to your Worker, which stores the
//      file in R2 and hands back a permanent URL. Only that small URL
//      string gets saved in localStorage, so the size ceiling problem goes
//      away and the same image URL works on any device.
const MAPFAM_UPLOAD_ENDPOINT = null; // e.g. 'https://mapfam-upload.yourname.workers.dev'

const MAPFAM_SLOTS_PER_ROW = 4;
const MAPFAM_ROWS_KEY = 'mw4camo-mapfam-rows';
const MAPFAM_IMAGES_KEY = 'mw4camo-mapfam-images';

function loadMapfamRows(){
  try{
    const raw = localStorage.getItem(MAPFAM_ROWS_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){
    return [];
  }
}
function saveMapfamRows(rows){
  try{ localStorage.setItem(MAPFAM_ROWS_KEY, JSON.stringify(rows)); }catch(e){}
}
function loadMapfamImages(){
  try{
    const raw = localStorage.getItem(MAPFAM_IMAGES_KEY);
    return raw ? JSON.parse(raw) : {};
  }catch(e){
    return {};
  }
}
function saveMapfamImages(images){
  try{
    localStorage.setItem(MAPFAM_IMAGES_KEY, JSON.stringify(images));
    return true;
  }catch(e){
    return false; // most likely a quota error from storing base64 images locally
  }
}

function initMapfam(config){
  const rowsEl = document.getElementById(config.rowsElId);
  const addRowBtn = document.getElementById(config.addRowBtnId);
  let rows = loadMapfamRows();
  let images = loadMapfamImages();

  // Hidden file input reused for every box.
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);
  let pendingUpload = null; // { rowId, slot }

  // Zoom overlay reused for every box.
  const zoomOverlay = document.createElement('div');
  zoomOverlay.className = 'mapfam-zoom-overlay';
  zoomOverlay.innerHTML = '<img alt="Full size image">';
  document.body.appendChild(zoomOverlay);
  const zoomImg = zoomOverlay.querySelector('img');
  zoomOverlay.addEventListener('click', () => {
    zoomOverlay.classList.remove('open');
    zoomImg.src = '';
  });

  function imageKey(rowId, slot){ return rowId + ':' + slot; }

  function render(){
    rowsEl.innerHTML = rows.length
      ? rows.map(row => renderRow(row)).join('')
      : '<div class="empty-note">No rows yet. Click "Add Row" to start a gallery.</div>';
    bindEvents();
  }

  function renderRow(row){
    const boxesHtml = Array.from({ length: MAPFAM_SLOTS_PER_ROW }, (_, slot) => {
      const key = imageKey(row.id, slot);
      const src = images[key];
      return '<div class="mapfam-box" data-row-id="'+row.id+'" data-slot="'+slot+'">' +
        '<div class="card-inner" data-row-id="'+row.id+'" data-slot="'+slot+'">' +
          (src
            ? '<img src="'+src+'" alt="'+row.label+' image '+(slot+1)+'">' +
              '<button class="mapfam-box-remove" data-row-id="'+row.id+'" data-slot="'+slot+'" type="button" aria-label="Remove image">&times;</button>'
            : '<span class="mapfam-box-plus">+</span>') +
        '</div>' +
      '</div>';
    }).join('');
    return '<div class="mapfam-row" data-row-id="'+row.id+'">' +
      '<div class="mapfam-row-head">' +
        '<input class="mapfam-row-label" data-row-id="'+row.id+'" value="'+row.label.replace(/"/g, '&quot;')+'">' +
        '<button class="mapfam-row-delete" data-row-id="'+row.id+'" type="button">Delete Row</button>' +
      '</div>' +
      '<div class="mapfam-grid">'+boxesHtml+'</div>' +
    '</div>';
  }

  function bindEvents(){
    rowsEl.querySelectorAll('.mapfam-row-label').forEach(input => {
      input.addEventListener('change', () => {
        const rowId = input.getAttribute('data-row-id');
        const row = rows.find(r => r.id === rowId);
        if(row){ row.label = input.value.trim() || 'Untitled Row'; saveMapfamRows(rows); render(); }
      });
    });
    rowsEl.querySelectorAll('.mapfam-row-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const rowId = btn.getAttribute('data-row-id');
        if(!confirm('Delete this row and its images? This can\'t be undone.')) return;
        rows = rows.filter(r => r.id !== rowId);
        saveMapfamRows(rows);
        Object.keys(images).forEach(k => { if(k.indexOf(rowId + ':') === 0) delete images[k]; });
        saveMapfamImages(images);
        render();
      });
    });
    rowsEl.querySelectorAll('.mapfam-box-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = imageKey(btn.getAttribute('data-row-id'), btn.getAttribute('data-slot'));
        delete images[key];
        saveMapfamImages(images);
        render();
      });
    });
    rowsEl.querySelectorAll('.mapfam-box .card-inner').forEach(box => {
      box.addEventListener('click', () => {
        const rowId = box.getAttribute('data-row-id');
        const slot = box.getAttribute('data-slot');
        const existing = images[imageKey(rowId, slot)];
        if(existing){
          zoomImg.src = existing;
          zoomOverlay.classList.add('open');
        }else{
          pendingUpload = { rowId, slot };
          fileInput.click();
        }
      });
    });
  }

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    fileInput.value = '';
    if(!file || !pendingUpload) return;
    const { rowId, slot } = pendingUpload;
    pendingUpload = null;

    if(MAPFAM_UPLOAD_ENDPOINT){
      const formData = new FormData();
      formData.append('file', file);
      fetch(MAPFAM_UPLOAD_ENDPOINT, { method: 'POST', body: formData })
        .then(r => r.json())
        .then(data => {
          if(!data || !data.url) throw new Error('No url in response');
          images[imageKey(rowId, slot)] = data.url;
          saveMapfamImages(images);
          render();
        })
        .catch(err => {
          console.error('Mapfam upload failed:', err);
          alert('Upload to your Worker failed. Check MAPFAM_UPLOAD_ENDPOINT in mapfam.js and your Worker\'s CORS settings, then try again.');
        });
    }else{
      const reader = new FileReader();
      reader.onload = (ev) => {
        images[imageKey(rowId, slot)] = ev.target.result;
        const ok = saveMapfamImages(images);
        if(!ok){
          alert('This browser\'s local storage is full. Remove some images, or set up a Cloudflare Worker (see the comment at the top of mapfam.js) so images are hosted on R2 instead.');
          delete images[imageKey(rowId, slot)];
        }
        render();
      };
      reader.readAsDataURL(file);
    }
  });

  if(addRowBtn){
    addRowBtn.addEventListener('click', () => {
      const id = 'row_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      rows.push({ id, label: 'New Row' });
      saveMapfamRows(rows);
      render();
    });
  }

  render();
}
