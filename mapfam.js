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

// ============================================================
// MAPFAM EDIT LOCK
// ============================================================
// This is a static site with no server, so there's no real authentication
// system available — this passphrase lives in plain text in this file and
// anyone who reads the page's source can find it. Treat it as a casual
// deterrent that keeps the "Add Image" button and edit controls hidden
// from ordinary visitors, not as real security. Change it to whatever you
// like before deploying.
const MAPFAM_EDIT_PASSPHRASE = 'changeme';
const MAPFAM_UNLOCK_KEY = 'mw4camo-mapfam-unlocked';

const MAPFAM_IMAGES_KEY = 'mw4camo-mapfam-images';

function loadMapfamImages(){
  try{
    const raw = localStorage.getItem(MAPFAM_IMAGES_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){
    return [];
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

function isMapfamUnlocked(){
  try{ return localStorage.getItem(MAPFAM_UNLOCK_KEY) === '1'; }catch(e){ return false; }
}

function initMapfam(config){
  const gridEl = document.getElementById(config.gridElId);
  const addImageBtn = document.getElementById(config.addImageBtnId);
  const lockToggleBtn = document.getElementById(config.lockToggleBtnId);
  let images = loadMapfamImages();
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
    const titleHtml = unlocked
      ? '<input class="mapfam-title" data-id="'+img.id+'" value="'+img.title.replace(/"/g, '&quot;')+'">'
      : '<div class="mapfam-title-view">'+img.title.replace(/</g, '&lt;')+'</div>';
    return '<div class="mapfam-item">' +
      '<div class="mapfam-box" data-id="'+img.id+'">' +
        '<div class="card-inner" data-id="'+img.id+'">' +
          '<img src="'+img.src+'" alt="'+img.title.replace(/"/g, '&quot;')+'">' +
          (unlocked ? '<button class="mapfam-box-remove" data-id="'+img.id+'" type="button" aria-label="Remove image">&times;</button>' : '') +
        '</div>' +
      '</div>' +
      titleHtml +
    '</div>';
  }

  function bindEvents(){
    gridEl.querySelectorAll('.mapfam-title').forEach(input => {
      input.addEventListener('change', () => {
        const id = input.getAttribute('data-id');
        const img = images.find(i => i.id === id);
        if(img){ img.title = input.value.trim() || 'Untitled'; saveMapfamImages(images); render(); }
      });
    });
    gridEl.querySelectorAll('.mapfam-box-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        images = images.filter(i => i.id !== id);
        saveMapfamImages(images);
        render();
      });
    });
    gridEl.querySelectorAll('.mapfam-box .card-inner').forEach(box => {
      box.addEventListener('click', () => {
        const id = box.getAttribute('data-id');
        const img = images.find(i => i.id === id);
        if(img){
          zoomImg.src = img.src;
          zoomOverlay.classList.add('open');
        }
      });
    });
  }

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    fileInput.value = '';
    if(!file || !unlocked) return;

    function addImage(src){
      images.push({ id: 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), title: 'Untitled', src: src });
      const ok = saveMapfamImages(images);
      if(!ok){
        alert('This browser\'s local storage is full. Remove some images, or set up a Cloudflare Worker (see the comment at the top of mapfam.js) so images are hosted on R2 instead.');
        images.pop();
      }
      render();
    }

    if(MAPFAM_UPLOAD_ENDPOINT){
      const formData = new FormData();
      formData.append('file', file);
      fetch(MAPFAM_UPLOAD_ENDPOINT, { method: 'POST', body: formData })
        .then(r => r.json())
        .then(data => {
          if(!data || !data.url) throw new Error('No url in response');
          addImage(data.url);
        })
        .catch(err => {
          console.error('Mapfam upload failed:', err);
          alert('Upload to your Worker failed. Check MAPFAM_UPLOAD_ENDPOINT in mapfam.js and your Worker\'s CORS settings, then try again.');
        });
    }else{
      const reader = new FileReader();
      reader.onload = (ev) => addImage(ev.target.result);
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

  render();
}
