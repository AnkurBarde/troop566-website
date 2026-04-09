// dev-tools.js — Secret Image Manager for Troop 566
// Activate: type "566dev" anywhere on the page (not in an input)

(function () {
  'use strict';

  const REPO = 'AnkurBarde/troop566-website';
  const BRANCH = 'main';

  const SLOT_META = {
    'home-hero':    { label: 'Home Hero Background',     dir: 'images/home',    gradient: 'linear-gradient(rgba(0,0,0,0.55),rgba(0,0,0,0.55))' },
    'home-about-1': { label: 'Home About – Left Image',  dir: 'images/home' },
    'home-about-2': { label: 'Home About – Right Image', dir: 'images/home' },
    'about-hero':   { label: 'About Hero Background',    dir: 'images/about',   gradient: 'linear-gradient(rgba(0,0,0,0.6),rgba(0,0,0,0.6))' },
    'events-hero':  { label: 'Events Hero Background',   dir: 'images/events',  gradient: 'linear-gradient(rgba(0,0,0,0.6),rgba(0,0,0,0.6))' },
    'gallery-hero': { label: 'Gallery Hero Background',  dir: 'images/gallery', gradient: 'linear-gradient(rgba(0,0,0,0.6),rgba(0,0,0,0.6))' },
    'contact-hero': { label: 'Contact Hero Background',  dir: 'images/contact', gradient: 'linear-gradient(rgba(0,0,0,0.6),rgba(0,0,0,0.6))' },
  };

  // ── Activation: type "566dev" anywhere (not in a text field) ──────────────
  let keyBuf = '';
  const SECRET = '566dev';
  document.addEventListener('keydown', function (e) {
    var tag = document.activeElement ? document.activeElement.tagName : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key.length === 1) keyBuf += e.key;
    if (keyBuf.includes(SECRET)) { keyBuf = ''; openPanel(); }
    if (keyBuf.length > 24) keyBuf = keyBuf.slice(-24);
  });

  // ── Apply saved image config to DOM on load ────────────────────────────────
  (async function applyConfig() {
    var cfg = {};
    try { cfg = await (window._imgCfgPromise || Promise.resolve({})); } catch (e) {}
    window._imgCfg = cfg;
    Object.keys(cfg).forEach(function (id) { applySlotToDom(id, cfg[id], false); });
  })();

  // ── Panel / UI state ──────────────────────────────────────────────────────
  var panelEl = null, overlayEl = null, cropModal = null;
  var cropperInst = null;
  var activeSlot = null;

  // ── Build UI (lazy) ───────────────────────────────────────────────────────
  function ensureUI() {
    if (panelEl) return;
    injectCSS();

    overlayEl = document.createElement('div');
    overlayEl.id = 'dev566-ov';
    overlayEl.onclick = closePanel;
    document.body.appendChild(overlayEl);

    panelEl = document.createElement('div');
    panelEl.id = 'dev566-panel';
    panelEl.innerHTML = [
      '<div class="d-hdr">',
        '<div>',
          '<div class="d-hdr-title">&#9881; Dev Image Manager</div>',
          '<div class="d-hdr-sub">Troop 566 &middot; Secret Tool</div>',
        '</div>',
        '<button class="d-x" id="d-close">&#x2715;</button>',
      '</div>',
      '<div class="d-tok-wrap">',
        '<input type="password" id="d-tok" class="d-tok-inp" placeholder="GitHub Personal Access Token&hellip;" autocomplete="new-password"/>',
        '<button class="d-tok-btn" id="d-tok-save">Save</button>',
      '</div>',
      '<div class="d-tok-hint" id="d-tok-hint">Token needs repo write access &mdash; stored in localStorage.</div>',
      '<div class="d-slots" id="d-slots"></div>',
    ].join('');
    document.body.appendChild(panelEl);

    cropModal = document.createElement('div');
    cropModal.id = 'dev566-modal';
    cropModal.innerHTML = [
      '<div class="d-modal-inner">',
        '<div class="d-modal-hdr">',
          '<span class="d-modal-title" id="d-modal-title">Replace Image</span>',
          '<button class="d-x" id="d-modal-x">&#x2715;</button>',
        '</div>',
        '<div class="d-drop" id="d-drop">',
          '<i class="fa-solid fa-cloud-arrow-up" style="font-size:2.6rem;display:block;margin-bottom:12px;color:rgba(255,255,255,.5)"></i>',
          '<p>Drop an image here or click to browse</p>',
          '<input type="file" id="d-file" accept="image/*" style="display:none"/>',
        '</div>',
        '<div id="d-crop-wrap" style="display:none">',
          '<div style="background:#0f172a;border-radius:10px;overflow:hidden;max-height:420px">',
            '<img id="d-crop-img" style="display:block;max-width:100%;" alt=""/>',
          '</div>',
          '<div class="d-crop-btns">',
            '<button class="d-btn d-btn-ghost" id="d-new-img">&#8617; New Image</button>',
            '<button class="d-btn d-btn-red" id="d-publish" disabled>Publish to GitHub &rarr;</button>',
          '</div>',
        '</div>',
        '<div class="d-status" id="d-status" style="display:none"></div>',
      '</div>',
    ].join('');
    document.body.appendChild(cropModal);

    document.getElementById('d-close').onclick = closePanel;
    document.getElementById('d-modal-x').onclick = closeModal;
    document.getElementById('d-tok-save').onclick = saveToken;

    var drop = document.getElementById('d-drop');
    drop.onclick = function () { document.getElementById('d-file').click(); };
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('drag-over'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('drag-over'); });
    drop.addEventListener('drop', function (e) {
      e.preventDefault();
      drop.classList.remove('drag-over');
      var f = e.dataTransfer.files[0];
      if (f) loadFile(f);
    });
    document.getElementById('d-file').onchange = function (e) {
      if (e.target.files[0]) loadFile(e.target.files[0]);
    };
    document.getElementById('d-new-img').onclick = resetDrop;
    document.getElementById('d-publish').onclick = publish;

    var saved = localStorage.getItem('dev566tok');
    if (saved) {
      document.getElementById('d-tok').value = saved;
      document.getElementById('d-tok-hint').textContent = '\u2713 Token loaded from localStorage.';
    }
  }

  // ── Panel open / close ────────────────────────────────────────────────────
  function openPanel() {
    ensureUI();
    overlayEl.style.display = 'block';
    panelEl.classList.add('open');
    renderSlots();
  }
  function closePanel() {
    if (!panelEl) return;
    overlayEl.style.display = 'none';
    panelEl.classList.remove('open');
  }

  // ── Slot list ─────────────────────────────────────────────────────────────
  function renderSlots() {
    var container = document.getElementById('d-slots');
    container.innerHTML = '';

    var domSlots = Array.prototype.slice.call(document.querySelectorAll('[data-img-slot]'));
    var gallerySlots = [];

    if (window.galleryState) {
      window.galleryState.events.forEach(function (evt, ei) {
        evt.photos.forEach(function (photo, pi) {
          gallerySlots.push({
            id: 'gallery-event-' + ei + '-photo-' + pi,
            label: evt.name + ' \u2013 ' + photo.label,
            currentSrc: photo.src || ''
          });
        });
      });
    }

    if (domSlots.length === 0 && gallerySlots.length === 0) {
      container.innerHTML = '<div class="d-empty">No image slots found on this page.</div>';
      return;
    }

    if (domSlots.length > 0) {
      var hdr1 = document.createElement('div');
      hdr1.className = 'd-section-title';
      hdr1.textContent = 'Page Images';
      container.appendChild(hdr1);
      domSlots.forEach(function (el) {
        var id = el.dataset.imgSlot;
        var meta = SLOT_META[id] || {};
        container.appendChild(makeSlotRow(id, meta.label || id, getCurrentSrc(el)));
      });
    }

    if (gallerySlots.length > 0) {
      var hdr2 = document.createElement('div');
      hdr2.className = 'd-section-title';
      hdr2.style.marginTop = '16px';
      hdr2.textContent = 'Gallery Event Photos';
      container.appendChild(hdr2);
      gallerySlots.forEach(function (s) {
        container.appendChild(makeSlotRow(s.id, s.label, s.currentSrc));
      });
    }
  }

  function getCurrentSrc(el) {
    if (el.tagName === 'IMG') return el.src || '';
    var bg = window.getComputedStyle(el).backgroundImage || '';
    var matches = bg.match(/url\(["']?([^"')]+)["']?\)/g);
    if (!matches || matches.length === 0) return '';
    var last = matches[matches.length - 1];
    var m = last.match(/url\(["']?([^"')]+)["']?\)/);
    return m ? m[1] : '';
  }

  function makeSlotRow(id, label, currentSrc) {
    var row = document.createElement('div');
    row.className = 'd-slot-row';

    var thumbHtml = currentSrc
      ? '<img src="' + currentSrc + '" onerror="this.style.display=\'none\'">'
      : '<span class="d-no-img">\uD83D\uDDBC\uFE0F</span>';

    var filenameHint = currentSrc
      ? currentSrc.split('/').pop().split('?')[0]
      : 'Not set';

    row.innerHTML = [
      '<div class="d-slot-thumb">' + thumbHtml + '</div>',
      '<div class="d-slot-info">',
        '<div class="d-slot-label">' + label + '</div>',
        '<div class="d-slot-src">' + filenameHint + '</div>',
      '</div>',
      '<button class="d-replace-btn" data-slot="' + id + '">Replace</button>',
    ].join('');

    row.querySelector('.d-replace-btn').onclick = function () { openModal(id, label); };
    return row;
  }

  // ── Crop modal ────────────────────────────────────────────────────────────
  function openModal(slotId, label) {
    activeSlot = slotId;
    document.getElementById('d-modal-title').textContent = 'Replace: ' + label;
    resetDrop();
    setStatus('', '');
    cropModal.style.display = 'flex';
  }

  function closeModal() {
    if (cropModal) cropModal.style.display = 'none';
    if (cropperInst) { try { cropperInst.destroy(); } catch (e) {} cropperInst = null; }
    activeSlot = null;
    var fi = document.getElementById('d-file');
    if (fi) fi.value = '';
  }

  function resetDrop() {
    document.getElementById('d-drop').style.display = '';
    document.getElementById('d-crop-wrap').style.display = 'none';
    document.getElementById('d-publish').disabled = true;
    if (cropperInst) { try { cropperInst.destroy(); } catch (e) {} cropperInst = null; }
    var fi = document.getElementById('d-file');
    if (fi) fi.value = '';
  }

  function loadFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    var reader = new FileReader();
    reader.onload = function (e) { showCropper(e.target.result); };
    reader.readAsDataURL(file);
  }

  function showCropper(dataUrl) {
    var img = document.getElementById('d-crop-img');
    img.src = dataUrl;
    document.getElementById('d-drop').style.display = 'none';
    document.getElementById('d-crop-wrap').style.display = 'block';
    document.getElementById('d-publish').disabled = false;
    loadCropperJS(function () {
      if (cropperInst) { try { cropperInst.destroy(); } catch (e) {} }
      cropperInst = new Cropper(img, {
        viewMode: 1,
        movable: true,
        zoomable: true,
        scalable: false,
        autoCropArea: 1.0,
        background: true,
        responsive: true,
      });
    });
  }

  function loadCropperJS(cb) {
    if (window.Cropper) { cb(); return; }
    if (!document.getElementById('d-cropper-css')) {
      var l = document.createElement('link');
      l.id = 'd-cropper-css';
      l.rel = 'stylesheet';
      l.href = 'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.1/cropper.min.css';
      document.head.appendChild(l);
    }
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.1/cropper.min.js';
    s.onload = cb;
    document.head.appendChild(s);
  }

  // ── Publish to GitHub ─────────────────────────────────────────────────────
  async function publish() {
    var token = getToken();
    if (!token) { setStatus('error', '\u2715 No GitHub token. Enter one in the panel above.'); return; }
    if (!activeSlot) return;

    var meta = getSlotMeta(activeSlot);
    document.getElementById('d-publish').disabled = true;

    try {
      setStatus('loading', 'Preparing image\u2026');
      var canvas;
      if (cropperInst) {
        canvas = cropperInst.getCroppedCanvas({ maxWidth: 1920, maxHeight: 1080, imageSmoothingQuality: 'high' });
      } else {
        canvas = document.createElement('canvas');
        var src = document.getElementById('d-crop-img');
        canvas.width = src.naturalWidth;
        canvas.height = src.naturalHeight;
        canvas.getContext('2d').drawImage(src, 0, 0);
      }

      var dataUrl = canvas.toDataURL('image/webp', 0.88);
      var b64 = dataUrl.split(',')[1];
      var filename = activeSlot + '-' + Date.now() + '.webp';
      var imgGitPath = meta.dir + '/' + filename;
      var publicUrl = '/' + imgGitPath;

      setStatus('loading', 'Uploading image to GitHub\u2026');
      await ghPut(token, imgGitPath, b64, 'dev: upload image for ' + activeSlot);

      setStatus('loading', 'Updating image-config.json\u2026');
      await updateImageConfig(token, activeSlot, publicUrl);

      applySlotToDom(activeSlot, publicUrl, true);
      renderSlots();

      setStatus('success', '\u2713 Saved! Vercel is deploying (~30s). Reload to confirm.');

    } catch (err) {
      setStatus('error', '\u2715 ' + err.message);
      document.getElementById('d-publish').disabled = false;
    }
  }

  async function updateImageConfig(token, slotId, url) {
    var sha = null;
    var existing = {};
    try {
      var data = await ghGet(token, 'image-config.json');
      sha = data.sha;
      existing = JSON.parse(atob(data.content.replace(/\n/g, '')));
    } catch (e) { /* file might not exist yet — will be created */ }
    existing[slotId] = url;
    var newContent = JSON.stringify(existing, null, 2);
    var newB64 = btoa(unescape(encodeURIComponent(newContent)));
    await ghPut(token, 'image-config.json', newB64, 'dev: update image config for ' + slotId, sha);
  }

  function applySlotToDom(slotId, url, liveUpdate) {
    var el = document.querySelector('[data-img-slot="' + slotId + '"]');
    if (el) {
      if (el.tagName === 'IMG') {
        el.src = url;
      } else {
        var meta = SLOT_META[slotId] || {};
        var g = meta.gradient || '';
        el.style.backgroundImage = g ? g + ', url("' + url + '")' : 'url("' + url + '")';
      }
    }
    // Gallery event photos
    if (slotId.indexOf('gallery-event-') === 0 && window.galleryState) {
      var m = slotId.match(/gallery-event-(\d+)-photo-(\d+)/);
      if (m) {
        var ei = parseInt(m[1], 10);
        var pi = parseInt(m[2], 10);
        var evts = window.galleryState.events;
        if (evts[ei] && evts[ei].photos[pi]) {
          evts[ei].photos[pi].src = url;
          if (liveUpdate) window.galleryState.updateCard(ei);
        }
      }
    }
  }

  function getSlotMeta(slotId) {
    if (SLOT_META[slotId]) return SLOT_META[slotId];
    if (slotId.indexOf('gallery-event-') === 0) return { dir: 'images/gallery', label: slotId };
    return { dir: 'images', label: slotId };
  }

  // ── GitHub API ────────────────────────────────────────────────────────────
  async function ghGet(token, path) {
    var r = await fetch(
      'https://api.github.com/repos/' + REPO + '/contents/' + path + '?ref=' + BRANCH,
      { headers: { Authorization: 'token ' + token, Accept: 'application/vnd.github.v3+json' } }
    );
    if (!r.ok) { var e = await r.json(); throw new Error(e.message || 'GitHub ' + r.status); }
    return r.json();
  }

  async function ghPut(token, path, content, message, sha) {
    var body = { message: message, content: content, branch: BRANCH };
    if (sha) body.sha = sha;
    var r = await fetch(
      'https://api.github.com/repos/' + REPO + '/contents/' + path,
      {
        method: 'PUT',
        headers: {
          Authorization: 'token ' + token,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    );
    if (!r.ok) { var e = await r.json(); throw new Error(e.message || 'GitHub ' + r.status); }
    return r.json();
  }

  // ── Token ─────────────────────────────────────────────────────────────────
  function saveToken() {
    var t = (document.getElementById('d-tok') || {}).value;
    if (!t) return;
    t = t.trim();
    if (!t) return;
    localStorage.setItem('dev566tok', t);
    document.getElementById('d-tok-hint').textContent = '\u2713 Token saved to localStorage.';
  }
  function getToken() {
    return localStorage.getItem('dev566tok') ||
      ((panelEl && document.getElementById('d-tok')) ? document.getElementById('d-tok').value.trim() : '');
  }

  // ── Status bar ────────────────────────────────────────────────────────────
  function setStatus(type, msg) {
    var el = document.getElementById('d-status');
    if (!el) return;
    if (!msg) { el.style.display = 'none'; return; }
    el.style.display = 'flex';
    el.className = 'd-status ' + type;
    var spin = type === 'loading' ? '<span class="d-spin">\u21BB</span> ' : '';
    el.innerHTML = spin + msg;
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  function injectCSS() {
    var s = document.createElement('style');
    s.textContent = [
      '#dev566-ov{display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9997}',
      '#dev566-panel{position:fixed;top:0;right:-440px;width:420px;height:100dvh;background:#111827;color:#fff;z-index:9999;display:flex;flex-direction:column;transition:right .3s ease;font-family:"Inter",sans-serif;box-shadow:-8px 0 40px rgba(0,0,0,.6)}',
      '#dev566-panel.open{right:0}',
      '.d-hdr{background:#b50000;padding:16px 18px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0}',
      '.d-hdr-title{font-size:1rem;font-weight:700;color:#fff}',
      '.d-hdr-sub{font-size:.7rem;opacity:.7;margin-top:2px;color:#fff}',
      '.d-x{background:rgba(255,255,255,.15);border:none;color:#fff;width:30px;height:30px;border-radius:6px;cursor:pointer;font-size:1rem;line-height:1;display:flex;align-items:center;justify-content:center}',
      '.d-x:hover{background:rgba(255,255,255,.3)}',
      '.d-tok-wrap{display:flex;gap:8px;padding:12px 14px 6px;background:#0f172a;flex-shrink:0}',
      '.d-tok-inp{flex:1;background:#1e293b;border:1.5px solid #334155;color:#fff;padding:7px 10px;border-radius:6px;font-size:.8rem;font-family:monospace;outline:none}',
      '.d-tok-inp:focus{border-color:#b50000}',
      '.d-tok-btn{background:#b50000;color:#fff;border:none;padding:7px 12px;border-radius:6px;font-size:.8rem;cursor:pointer;white-space:nowrap;font-weight:600}',
      '.d-tok-hint{font-size:.7rem;color:rgba(255,255,255,.4);padding:0 14px 10px;background:#0f172a;flex-shrink:0}',
      '.d-slots{flex:1;overflow-y:auto;padding:14px}',
      '.d-section-title{font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.35);margin-bottom:10px}',
      '.d-slot-row{background:#1e293b;border-radius:10px;padding:12px;margin-bottom:8px;display:flex;gap:10px;align-items:center}',
      '.d-slot-thumb{width:70px;height:48px;border-radius:6px;background:#0f172a;flex-shrink:0;overflow:hidden;display:flex;align-items:center;justify-content:center}',
      '.d-slot-thumb img{width:100%;height:100%;object-fit:cover}',
      '.d-no-img{font-size:1.4rem;opacity:.3}',
      '.d-slot-info{flex:1;min-width:0}',
      '.d-slot-label{font-size:.83rem;font-weight:600;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff}',
      '.d-slot-src{font-size:.68rem;color:rgba(255,255,255,.32);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.d-replace-btn{background:#b50000;color:#fff;border:none;padding:6px 11px;border-radius:6px;font-size:.76rem;cursor:pointer;white-space:nowrap;flex-shrink:0;font-weight:600}',
      '.d-replace-btn:hover{background:#8b0000}',
      '.d-empty{color:rgba(255,255,255,.3);font-size:.85rem;padding:20px 0;text-align:center}',
      '#dev566-modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:10000;align-items:center;justify-content:center;padding:20px}',
      '.d-modal-inner{background:#1e293b;border-radius:14px;padding:24px;width:100%;max-width:680px;max-height:90dvh;overflow-y:auto;font-family:"Inter",sans-serif;color:#fff}',
      '.d-modal-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}',
      '.d-modal-title{font-size:1.05rem;font-weight:700;color:#fff}',
      '.d-drop{border:2px dashed rgba(255,255,255,.18);border-radius:10px;padding:44px 20px;text-align:center;color:rgba(255,255,255,.45);cursor:pointer;transition:border-color .2s,background .2s}',
      '.d-drop:hover,.d-drop.drag-over{border-color:#b50000;background:rgba(181,0,0,.1);color:#fff}',
      '.d-drop p{font-size:.9rem;margin:0}',
      '.d-crop-btns{display:flex;gap:8px;margin-top:14px;justify-content:flex-end}',
      '.d-btn{padding:9px 18px;border-radius:7px;border:none;font-size:.88rem;font-weight:600;cursor:pointer;font-family:"Inter",sans-serif}',
      '.d-btn-ghost{background:rgba(255,255,255,.1);color:#fff}',
      '.d-btn-ghost:hover{background:rgba(255,255,255,.2)}',
      '.d-btn-red{background:#b50000;color:#fff}',
      '.d-btn-red:hover:not(:disabled){background:#8b0000}',
      '.d-btn-red:disabled{background:#374151;cursor:not-allowed}',
      '.d-status{border-radius:8px;padding:10px 14px;font-size:.84rem;margin-top:14px;align-items:center;gap:8px;flex-wrap:wrap}',
      '.d-status.loading{background:rgba(255,255,255,.05);color:rgba(255,255,255,.75)}',
      '.d-status.success{background:rgba(34,197,94,.12);color:#4ade80}',
      '.d-status.error{background:rgba(239,68,68,.12);color:#f87171}',
      '.d-spin{display:inline-block;animation:dev-spin 1s linear infinite}',
      '@keyframes dev-spin{to{transform:rotate(360deg)}}',
    ].join('');
    document.head.appendChild(s);
  }

})();
