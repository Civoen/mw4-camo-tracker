// ============================================================
// MAPFAM UPLOAD CONFIG
// ============================================================
// By default this is null. In that state, images are stored directly in
// THIS browser's localStorage (as base64) — the page works immediately
// with no setup, but images are 100% private to this one browser. Nobody
// else visiting the site sees them, and there's no way around that without
// a server: a static site has nowhere shared to keep a list of images.
//
// To make uploads visible to every visitor, you need a small Cloudflare
// Worker that both stores the image in R2 AND keeps a shared manifest of
// what's been uploaded (see worker-example.js in this folder — it's
// untested starter code, not a deployed/verified service). Once deployed,
// set its URL below. From then on:
//   - On page load, every visitor's browser fetches the current image list
//     from the Worker instead of reading its own localStorage.
//   - Uploads POST to the Worker, which stores the file in R2, updates the
//     shared list, and every visitor sees the new image on their next load.
const MAPFAM_UPLOAD_ENDPOINT = null; // e.g. 'https://mapfam-upload.yourname.workers.dev'

// If your Worker checks an UPLOAD_TOKEN (see worker-example.js setup step
// 5), set the same value here so uploads/removals are authorized. Leave
// blank if you haven't set one up.
const MAPFAM_UPLOAD_TOKEN = '';

// ============================================================
// MAPFAM EDIT LOCK
// ============================================================
// This only gates the "Add Image" / remove controls in THIS browser's UI —
// it does not restrict who can view images, and (like everything static)
// it's not real security since the passphrase lives in this file's plain
// text source. Change it to whatever you like before deploying.
const MAPFAM_EDIT_PASSPHRASE = 'changeme';
const MAPFAM_UNLOCK_KEY = 'mw4camo-mapfam-unlocked';

const MAPFAM_IMAGES_KEY = 'mw4camo-mapfam-images'; // local-only fallback storage

function loadLocalMapfamImages(){
  try{
    const raw = localStorage.getItem(MAPFAM_IMAGES_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){
    return [];
  }
}
function saveLocalMapfamImages(images){
  try{
    localStorage.setItem(MAPFAM_IMAGES_KEY, JSON.stringify(images));
    return true;
  }catch(e){
    return false; // most likely a quota error from storing base64 images locally
  }
}

function isMapfamUnlocked(){
  try{ return localStorage.getItem(MAPFAM_UNLOCK_KEY) === '1'; }catch(e){ return false; }
}

function mapfamAuthHeaders(){
  return MAPFAM_UPLOAD_TOKEN ? { 'X-Upload-Token': MAPFAM_UPLOAD_TOKEN } : {};
}

function initMapfam(config){
  const gridEl = document.getElementById(config.gridElId);
  const addImageBtn = document.getElementById(config.addImageBtnId);
  const lockToggleBtn = document.getElementById(config.lockToggleBtnId);
  const shared = !!MAPFAM_UPLOAD_ENDPOINT;
  let images = shared ? [] : loadLocalMapfamImages(); // {id, url|src}
  let unlocked = isMapfamUnlocked();

  // Hidden file input, reused for every upload.
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);

  // Zoom overlay, reused for every image.
  const zoomOverlay = document.createElement('div');
  zoomOverlay.className = 'mapfam-zoom-overlay';
  zoomOverlay.innerHTML = '<img alt="Full size image">';
  document.body.appendChild(zoomOverlay);
  const zoomImg = zoomOverlay.querySelector('img');
  zoomOverlay.addEventListener('click', () => {
    zoomOverlay.classList.remove('open');
    zoomImg.src = '';
  });

  function imgSrc(img){ return img.url || img.src; }

  function updateLockUI(){
    if(!lockToggleBtn) return;
    lockToggleBtn.textContent = unlocked ? 'Lock Editing' : 'Unlock Editing';
    if(addImageBtn) addImageBtn.style.display = unlocked ? '' : 'none';
  }

  function render(){
    gridEl.innerHTML = images.length
      ? images.map(img => renderItem(img)).join('')
      : '<div class="empty-note">No images yet.' + (unlocked ? ' Click "Add Image" to start.' : '') + '</div>';
    updateLockUI();
    bindEvents();
  }

  function renderItem(img){
    return '<div class="mapfam-box" data-id="'+img.id+'">' +
      '<div class="card-inner" data-id="'+img.id+'">' +
        '<img src="'+imgSrc(img)+'" alt="Uploaded map image">' +
        (unlocked ? '<button class="mapfam-box-remove" data-id="'+img.id+'" type="button" aria-label="Remove image">&times;</button>' : '') +
      '</div>' +
    '</div>';
  }

  function bindEvents(){
    gridEl.querySelectorAll('.mapfam-box-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeImage(btn.getAttribute('data-id'));
      });
    });
    gridEl.querySelectorAll('.mapfam-box .card-inner').forEach(box => {
      box.addEventListener('click', () => {
        const id = box.getAttribute('data-id');
        const img = images.find(i => i.id === id);
        if(img){
          zoomImg.src = imgSrc(img);
          zoomOverlay.classList.add('open');
        }
      });
    });
  }

  function removeImage(id){
    if(shared){
      fetch(MAPFAM_UPLOAD_ENDPOINT + '?id=' + encodeURIComponent(id), {
        method: 'DELETE',
        headers: mapfamAuthHeaders()
      })
        .then(r => r.json())
        .then(data => {
          images = data.images || [];
          render();
        })
        .catch(err => {
          console.error('Mapfam remove failed:', err);
          alert('Could not remove that image from the server. Try again.');
        });
    }else{
      images = images.filter(i => i.id !== id);
      saveLocalMapfamImages(images);
      render();
    }
  }

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    fileInput.value = '';
    if(!file || !unlocked) return;

    if(shared){
      const formData = new FormData();
      formData.append('file', file);
      fetch(MAPFAM_UPLOAD_ENDPOINT, { method: 'POST', body: formData, headers: mapfamAuthHeaders() })
        .then(r => r.json())
        .then(data => {
          if(!data || !data.images) throw new Error('Unexpected response');
          images = data.images;
          render();
        })
        .catch(err => {
          console.error('Mapfam upload failed:', err);
          alert('Upload to your Worker failed. Check MAPFAM_UPLOAD_ENDPOINT/MAPFAM_UPLOAD_TOKEN in mapfam.js and your Worker\'s CORS settings, then try again.');
        });
    }else{
      const reader = new FileReader();
      reader.onload = (ev) => {
        images.push({ id: 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), src: ev.target.result });
        const ok = saveLocalMapfamImages(images);
        if(!ok){
          alert('This browser\'s local storage is full. Remove some images, or set up a Cloudflare Worker (see the comment at the top of mapfam.js) so images are shared and hosted on R2 instead.');
          images.pop();
        }
        render();
      };
      reader.readAsDataURL(file);
    }
  });

  if(addImageBtn){
    addImageBtn.addEventListener('click', () => {
      if(!unlocked) return;
      fileInput.click();
    });
  }

  if(lockToggleBtn){
    lockToggleBtn.addEventListener('click', () => {
      if(unlocked){
        unlocked = false;
        try{ localStorage.removeItem(MAPFAM_UNLOCK_KEY); }catch(e){}
        render();
        return;
      }
      const attempt = prompt('Enter the passphrase to edit this page:');
      if(attempt === null) return; // cancelled
      if(attempt === MAPFAM_EDIT_PASSPHRASE){
        unlocked = true;
        try{ localStorage.setItem(MAPFAM_UNLOCK_KEY, '1'); }catch(e){}
        render();
      }else{
        alert('Incorrect passphrase.');
      }
    });
  }

  if(shared){
    gridEl.innerHTML = '<div class="empty-note">Loading images&hellip;</div>';
    fetch(MAPFAM_UPLOAD_ENDPOINT)
      .then(r => r.json())
      .then(data => {
        images = (data && data.images) || [];
        render();
      })
      .catch(err => {
        console.error('Mapfam load failed:', err);
        gridEl.innerHTML = '<div class="empty-note">Could not load images from the server. Check MAPFAM_UPLOAD_ENDPOINT in mapfam.js.</div>';
        updateLockUI();
      });
  }else{
    render();
  }
}
