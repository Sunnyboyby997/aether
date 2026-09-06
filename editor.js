/* ============================================================
   ZOUWENSHENG — 网页内编辑面板 + 作品详情弹窗

   1) 右下角「编辑作品」：增删改作品、传封面图/视频、导出。
   2) 点击任意作品卡片：弹出详情窗口，查看完整描述、提示词、
      去AI化说明，视频作品可直接播放。

   视频存储：本地视频文件存入 IndexedDB（可存大文件、刷新不丢），
   播放时用 object URL，兼容性最好；发布时改用平台链接或 assets/ 文件。
   ============================================================ */
(function () {
  if (!window.works) return;

  /* ---------- IndexedDB（存本地视频 Blob） ---------- */
  var DB_NAME = 'zws_videos_v1';
  var DB_STORE = 'videos';
  var idbReady = false;
  var idbError = null;
  var db;

  function openDB() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('no-idb')); return; }
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function (e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains(DB_STORE)) d.createObjectStore(DB_STORE);
      };
      req.onsuccess = function (e) { db = e.target.result; idbReady = true; resolve(db); };
      req.onerror = function (e) { idbError = e.target.error; reject(e.target.error); };
    });
  }
  openDB();

  function idbPut(key, blob) {
    return new Promise(function (resolve, reject) {
      if (!idbReady) { reject(new Error('idb not ready')); return; }
      var tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(blob, key);
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
    });
  }
  function idbGet(key) {
    return new Promise(function (resolve, reject) {
      if (!idbReady) { reject(new Error('idb not ready')); return; }
      var tx = db.transaction(DB_STORE, 'readonly');
      var rq = tx.objectStore(DB_STORE).get(key);
      rq.onsuccess = function () { resolve(rq.result || null); };
      rq.onerror = function () { reject(rq.error); };
    });
  }

  /* ---------- 注入 UI ---------- */
  var ui = document.createElement('div');
  ui.innerHTML =
    '<button class="fab" id="editFab" title="编辑作品">✎ 编辑作品</button>'
    + '<div class="edit-toolbar" id="editToolbar">'
    +   '<span class="tb-title">编辑模式</span>'
    +   '<button class="tb-btn" id="tbAddCopy">＋ 文案</button>'
    +   '<button class="tb-btn" id="tbAddVideo">＋ 视频</button>'
    +   '<button class="tb-btn" id="tbExport">导出 works.js</button>'
    +   '<button class="tb-btn" id="tbReset">恢复默认</button>'
    +   '<button class="tb-btn tb-exit" id="tbExit">退出编辑</button>'
    + '</div>'
    + '<div class="modal-overlay" id="modalOverlay">'
    +   '<form class="modal" id="workForm">'
    +     '<div class="modal-head"><h3 id="modalTitle">编辑作品</h3><button type="button" class="modal-close" id="modalClose">×</button></div>'
    +     '<div class="field"><label>标题 *</label><input id="f-title" required placeholder="作品标题" /></div>'
    +     '<div class="field-row">'
    +       '<div class="field"><label>品牌 / 客户</label><input id="f-brand" placeholder="客户名或品牌" /></div>'
    +       '<div class="field"><label>类型</label><input id="f-type" placeholder="如：TikTok 脚本 / 产品文案" /></div>'
    +     '</div>'
    +     '<div class="field"><label>一句话说明</label><textarea id="f-desc" rows="2" placeholder="做了什么、结果如何"></textarea></div>'
    +     '<div class="field"><label>封面图</label>'
    +       '<div class="cover-ctrl"><input type="file" id="f-cover" accept="image/*" />'
    +       '<div class="cover-preview" id="coverPreview"></div>'
    +       '<button type="button" class="tb-btn" id="coverClear">清除封面</button></div>'
    +     '</div>'
    +     '<div class="field" id="videoField">'
    +       '<label>视频（本地文件或网址）</label>'
    +       '<div class="video-ctrl">'
    +         '<input id="f-video-src" placeholder="视频地址：https://… 或选本地文件" />'
    +         '<button type="button" class="tb-btn" id="pickVideo">选本地文件</button>'
    +         '<input type="file" id="f-video-file" accept="video/*" style="display:none" />'
    +       '</div>'
    +       '<p class="hint" id="videoHint">本地视频会存进浏览器（刷新不丢），保存后即可播放。发布时需改用平台链接或把文件放进 assets/。</p>'
    +     '</div>'
    +     '<div class="field"><label>链接（可选，需以 http 开头）</label><input id="f-link" placeholder="https://…（填了详情里会出现播放/查看按钮）" /></div>'
    +     '<div class="field"><label>提示词（可选）</label><textarea id="f-prompt" rows="3" placeholder="用到的核心提示词"></textarea></div>'
    +     '<div class="field"><label>去AI化说明（可选）</label><textarea id="f-deai" rows="3" placeholder="去AI化做了什么处理"></textarea></div>'
    +     '<div id="storyFields">'
    +       '<div class="field"><label>创作思路（可选）</label><textarea id="f-idea" rows="3" placeholder="为什么这么想、核心创意"></textarea></div>'
    +       '<div class="field"><label>脚本（可选）</label><textarea id="f-script" rows="4" placeholder="逐行：镜头号 / 时长 / 画面 / 台词 / 音效"></textarea></div>'
    +       '<div class="field"><label>分镜（可选）</label><textarea id="f-storyboard" rows="4" placeholder="逐格：镜头号 / 时长 / 画面 / 运镜 / 提示词"></textarea></div>'
    +       '<div class="field"><label>分镜图（可选，可多选）</label>'
    +         '<div class="shots-ctrl"><input type="file" id="f-shots" accept="image/*" multiple /><button type="button" class="tb-btn" id="shotsClear">清空</button></div>'
    +         '<div class="shots-preview" id="shotsPreview"></div>'
    +       '</div>'
    +     '</div>'
    +     '<div class="modal-foot"><button type="button" class="tb-btn" id="modalCancel">取消</button><button type="submit" class="tb-btn tb-primary" id="modalSave">保存</button></div>'
    +   '</form>'
    + '</div>'
    + '<div class="modal-overlay" id="detailOverlay">'
    +   '<div class="modal detail-modal">'
    +     '<div class="modal-head"><h3 id="detailType">作品详情</h3><button type="button" class="modal-close" id="detailClose">×</button></div>'
    +     '<div id="detailBody"></div>'
    +   '</div>'
    + '</div>'
    + '<div class="lightbox" id="lightbox">'
    +   '<button type="button" class="lightbox-close" id="lightboxClose">×</button>'
    +   '<img id="lightboxImg" alt="封面原图" />'
    + '</div>'
    + '<div class="showcase" id="videoShowcase">'
    +   '<button type="button" class="showcase-close" id="showcaseClose">×</button>'
    +   '<div class="showcase-scroll"><div class="showcase-inner" id="showcaseBody"></div></div>'
    + '</div>';
  document.body.appendChild(ui);

  var fab = document.getElementById('editFab');
  var toolbar = document.getElementById('editToolbar');
  var overlay = document.getElementById('modalOverlay');
  var form = document.getElementById('workForm');
  var detailOverlay = document.getElementById('detailOverlay');
  var showcase = document.getElementById('videoShowcase');

  /* ---------- 编辑模式开关 ---------- */
  function setEditing(on) {
    document.body.classList.toggle('editing', on);
    toolbar.classList.toggle('show', on);
    fab.classList.toggle('on', on);
    fab.textContent = on ? '✕ 退出编辑' : '✎ 编辑作品';
  }
  fab.addEventListener('click', function () {
    setEditing(!document.body.classList.contains('editing'));
  });
  document.getElementById('tbExit').addEventListener('click', function () { setEditing(false); });

  /* ---------- 封面图处理（压缩后转 base64） ---------- */
  var currentCover = '';
  function resizeImage(file, cb, maxW) {
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function () {
      var maxWidth = maxW || 1600, w = img.width, h = img.height;
      if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      cb(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = function () { URL.revokeObjectURL(url); cb(null); };
    img.src = url;
  }

  var coverInput = document.getElementById('f-cover');
  var coverPreview = document.getElementById('coverPreview');
  coverInput.addEventListener('change', function () {
    var f = coverInput.files && coverInput.files[0];
    if (!f) return;
    resizeImage(f, function (dataUrl) {
      if (dataUrl) {
        currentCover = dataUrl;
        coverPreview.innerHTML = '<img src="' + dataUrl + '" alt="封面预览" />';
      }
    });
  });
  document.getElementById('coverClear').addEventListener('click', function () {
    currentCover = '';
    coverInput.value = '';
    coverPreview.innerHTML = '';
  });

  /* ---------- 分镜图（多选，压缩后存 base64） ---------- */
  var shotsInput = document.getElementById('f-shots');
  var shotsPreview = document.getElementById('shotsPreview');
  var currentStoryImgs = [];
  function renderShotsPreview() {
    shotsPreview.innerHTML = currentStoryImgs.map(function (src) {
      return '<div class="shot-thumb"><img src="' + src + '" alt="分镜图" /></div>';
    }).join('');
  }
  shotsInput.addEventListener('change', function () {
    var files = Array.prototype.slice.call(shotsInput.files || []);
    if (!files.length) return;
    var pending = files.length;
    files.forEach(function (f) {
      resizeImage(f, function (dataUrl) {
        if (dataUrl) currentStoryImgs.push(dataUrl);
        if (--pending === 0) { renderShotsPreview(); shotsInput.value = ''; }
      }, 1200);
    });
  });
  document.getElementById('shotsClear').addEventListener('click', function () {
    currentStoryImgs = [];
    shotsInput.value = '';
    renderShotsPreview();
  });

  /* ---------- 视频：本地文件存 IndexedDB ---------- */
  var videoSrc = document.getElementById('f-video-src');
  var videoHint = document.getElementById('videoHint');
  document.getElementById('pickVideo').addEventListener('click', function () {
    document.getElementById('f-video-file').click();
  });
  document.getElementById('f-video-file').addEventListener('change', function () {
    var f = this.files && this.files[0];
    if (!f) return;
    var MAX = 50 * 1024 * 1024; // 50MB
    if (f.size > MAX) {
      videoSrc.value = '';
      videoHint.textContent = '视频「' + f.name + '」' + (f.size / 1024 / 1024).toFixed(0) + 'MB 太大。请上传到 B站/抖音 等平台后粘贴链接。';
      return;
    }
    videoHint.textContent = '正在读取视频…';
    var key = 'v_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    idbPut(key, f).then(function () {
      videoSrc.value = 'idb://' + key;
      videoHint.textContent = '已加载「' + f.name + '」（' + (f.size / 1024 / 1024).toFixed(1) + 'MB，本地存储，保存后即可播放）。';
    }).catch(function () {
      videoSrc.value = 'assets/' + f.name;
      videoHint.textContent = '浏览器无法本地存储视频，请粘贴视频网址（https://…）。';
    });
  });

  /* ---------- 编辑弹窗 ---------- */
  var editing = null;

  function openModal(kind, index, item) {
    editing = index == null ? { kind: kind, index: null } : { kind: kind, index: index };
    document.getElementById('modalTitle').textContent =
      (editing.index == null ? '新增' : '编辑') + (kind === 'copy' ? '文案作品' : '视频作品');
    document.getElementById('videoField').style.display = (kind === 'video') ? '' : 'none';

    document.getElementById('f-title').value = (item && !item.empty) ? item.title : '';
    document.getElementById('f-brand').value = (item && !item.empty) ? item.brand : '';
    document.getElementById('f-type').value = (item && !item.empty) ? item.type : '';
    document.getElementById('f-desc').value = (item && !item.empty) ? item.desc : '';
    document.getElementById('f-link').value = (item && !item.empty) ? item.link : '';
    document.getElementById('f-prompt').value = (item && !item.empty) ? item.prompt : '';
    document.getElementById('f-deai').value = (item && !item.empty) ? item.deai : '';
    document.getElementById('f-idea').value = (item && !item.empty) ? (item.idea || '') : '';
    document.getElementById('f-script').value = (item && !item.empty) ? (item.script || '') : '';
    document.getElementById('f-storyboard').value = (item && !item.empty) ? (item.storyboard || '') : '';
    currentStoryImgs = (item && !item.empty && item.storyImgs) ? item.storyImgs.slice() : [];
    renderShotsPreview();
    document.getElementById('storyFields').style.display = (kind === 'video') ? '' : 'none';
    document.getElementById('f-video-src').value = (item && !item.empty) ? item.video : '';
    videoHint.textContent = '本地视频会存进浏览器（刷新不丢），保存后即可播放。发布时需改用平台链接或把文件放进 assets/。';
    currentCover = (item && !item.empty) ? item.cover : '';
    coverInput.value = '';
    coverPreview.innerHTML = currentCover ? '<img src="' + currentCover + '" alt="封面预览" />' : '';
    overlay.classList.add('show');
    setTimeout(function () { document.getElementById('f-title').focus(); }, 50);
  }

  function closeModal() { overlay.classList.remove('show'); }

  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalCancel').addEventListener('click', closeModal);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!editing) return;
    var title = document.getElementById('f-title').value.trim();
    if (!title) { document.getElementById('f-title').focus(); return; }

    var item = {
      empty: false,
      no: editing.index != null ? window.works.getData()[editing.kind][editing.index].no : window.works.nextNo(editing.kind),
      title: title,
      brand: document.getElementById('f-brand').value.trim(),
      type: document.getElementById('f-type').value.trim(),
      desc: document.getElementById('f-desc').value.trim(),
      cover: currentCover,
      video: document.getElementById('f-video-src').value.trim(),
      link: document.getElementById('f-link').value.trim(),
      prompt: document.getElementById('f-prompt').value.trim(),
      deai: document.getElementById('f-deai').value.trim(),
      idea: document.getElementById('f-idea').value.trim(),
      script: document.getElementById('f-script').value.trim(),
      storyboard: document.getElementById('f-storyboard').value.trim(),
      storyImgs: currentStoryImgs
    };

    if (editing.index == null) {
      window.works.add(editing.kind, item);
    } else {
      window.works.update(editing.kind, editing.index, item);
    }
    closeModal();
  });

  /* ---------- 详情弹窗（含视频播放 + 错误提示） ---------- */
  var currentObjectUrl = null;

  function openDetail(item) {
    document.getElementById('detailType').textContent = '作品详情';
    var body = document.getElementById('detailBody');

    var html = '';
    if (item.video) {
      html += '<div class="detail-media">'
        + '<video controls playsinline preload="metadata"'
        + (item.cover ? ' poster="' + window.works.esc(item.cover) + '"' : '')
        + '></video>'
        + '<p class="detail-error" style="display:none"></p>'
        + '</div>';
    } else if (item.cover) {
      html += '<div class="detail-media"><img src="' + window.works.esc(item.cover) + '" alt="' + window.works.esc(item.title) + '" /></div>';
    }

    html += '<div class="detail-head">'
      + '<div class="detail-meta">'
      + (item.type ? '<span class="detail-type">' + window.works.esc(item.type) + '</span>' : '')
      + (item.brand ? '<span class="detail-brand">' + window.works.esc(item.brand) + '</span>' : '')
      + '</div>'
      + '<h3 class="detail-title">' + window.works.esc(item.title) + '</h3>'
      + (item.desc ? '<p class="detail-desc">' + window.works.esc(item.desc) + '</p>' : '')
      + (item.cover ? '<button type="button" class="view-original">查看封面原图 ↗</button>' : '')
      + '</div>';

    if (item.prompt || item.deai) {
      html += '<div class="detail-sections">'
        + (item.prompt ? '<div class="detail-block detail-prompt"><span class="detail-block-label">提示词 · PROMPT</span><div class="detail-block-text">' + window.works.esc(item.prompt) + '</div></div>' : '')
        + (item.deai ? '<div class="detail-block detail-deai"><span class="detail-block-label">去AI化 · DE-AI</span><div class="detail-block-text">' + window.works.esc(item.deai) + '</div></div>' : '')
        + '</div>';
    }

    if (window.works.isUrl(item.link)) {
      html += '<div class="detail-foot"><a class="detail-link" href="' + window.works.esc(item.link) + '" target="_blank" rel="noopener">▶ 去平台观看 / 查看详情</a></div>';
    }

    body.innerHTML = html;

    var videoEl = body.querySelector('video');
    if (videoEl) setVideoSrc(videoEl, item.video);

    var origBtn = body.querySelector('.view-original');
    if (origBtn) origBtn.addEventListener('click', function () { openLightbox(item.cover); });
    var detailImg = body.querySelector('.detail-media img');
    if (detailImg && item.cover) detailImg.addEventListener('click', function () { openLightbox(item.cover); });

    detailOverlay.classList.add('show');
  }

  function openLightbox(src) {
    document.getElementById('lightboxImg').src = src;
    document.getElementById('lightbox').classList.add('show');
  }

  function setVideoSrc(videoEl, src) {
    var errEl = videoEl.parentElement.querySelector('.detail-error');
    function fail(msg) {
      if (errEl) { errEl.style.display = 'block'; errEl.textContent = msg; }
    }
    videoEl.addEventListener('error', function () {
      var e = videoEl.error;
      var msg = '视频无法播放（错误码 ' + (e && e.code != null ? e.code : '?') + '）';
      if (e && e.code === 4) msg = '视频无法播放：格式/编码不支持。请转成 MP4(H.264)，或上传到 B站/抖音 后粘贴链接。';
      else if (e && e.code === 1) msg = '视频未找到：本地文件不存在或路径不对，请重新「选本地文件」。';
      else if (e && e.code === 2) msg = '视频加载被中断，请重试或换一个视频。';
      fail(msg);
    });

    if (!src) { fail('未设置视频地址。'); return; }

    if (src.indexOf('idb://') === 0) {
      idbGet(src.slice(6)).then(function (blob) {
        if (!videoEl.isConnected) return;
        if (blob) {
          if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
          currentObjectUrl = URL.createObjectURL(blob);
          videoEl.src = currentObjectUrl;
        } else {
          fail('本地视频数据已丢失，请重新编辑该作品、重新「选本地文件」。');
        }
      }).catch(function () {
        fail('无法读取本地视频（浏览器存储不可用），请粘贴视频网址。');
      });
    } else {
      videoEl.src = src;
    }
  }

  function closeDetail() {
    detailOverlay.classList.remove('show');
    document.getElementById('detailBody').innerHTML = '';
    if (currentObjectUrl) { URL.revokeObjectURL(currentObjectUrl); currentObjectUrl = null; }
  }
  document.getElementById('detailClose').addEventListener('click', closeDetail);
  detailOverlay.addEventListener('click', function (e) { if (e.target === detailOverlay) closeDetail(); });

  var lightbox = document.getElementById('lightbox');
  function closeLightbox() { lightbox.classList.remove('show'); }
  document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', function (e) { if (e.target === lightbox) closeLightbox(); });

  /* ---------- 视频作品展示页（跳转展示） ---------- */
  function openShowcase(item) {
    var body = document.getElementById('showcaseBody');
    var sc = document.querySelector('.showcase-scroll');
    if (sc) sc.scrollTop = 0;

    var html = '';
    if (item.video) {
      html += '<div class="sc-media"><video controls playsinline preload="metadata"'
        + (item.cover ? ' poster="' + window.works.esc(item.cover) + '"' : '')
        + '></video><p class="detail-error" style="display:none"></p></div>';
    } else if (item.cover) {
      html += '<div class="sc-media"><img src="' + window.works.esc(item.cover) + '" alt="' + window.works.esc(item.title) + '" /></div>';
    }

    html += '<div class="sc-content">'
      + '<div class="sc-meta">'
      + (item.type ? '<span class="sc-type">' + window.works.esc(item.type) + '</span>' : '')
      + (item.brand ? '<span class="sc-brand">' + window.works.esc(item.brand) + '</span>' : '')
      + '</div>'
      + '<h2 class="sc-title">' + window.works.esc(item.title) + '</h2>'
      + (item.desc ? '<div class="sc-block"><div class="sc-label">作品说明 · ABOUT</div><div class="sc-text">' + window.works.esc(item.desc) + '</div></div>' : '')
      + (item.idea ? '<div class="sc-block"><div class="sc-label">创作思路 · CONCEPT</div><div class="sc-text">' + window.works.esc(item.idea) + '</div></div>' : '')
      + (item.script ? '<div class="sc-block"><div class="sc-label">脚本 · SCRIPT</div><div class="sc-text mono">' + window.works.esc(item.script) + '</div></div>' : '')
      + (item.storyboard ? '<div class="sc-block"><div class="sc-label">分镜 · STORYBOARD</div><div class="sc-text mono">' + window.works.esc(item.storyboard) + '</div></div>' : '')
      + (item.storyImgs && item.storyImgs.length ? '<div class="sc-block"><div class="sc-label">分镜图 · FRAMES</div><div class="sc-shots">' + item.storyImgs.map(function (s) { return '<img src="' + window.works.esc(s) + '" alt="分镜图" />'; }).join('') + '</div></div>' : '')
      + (window.works.isUrl(item.link) ? '<a class="sc-link" href="' + window.works.esc(item.link) + '" target="_blank" rel="noopener">▶ 去平台观看</a>' : '')
      + '</div>';

    body.innerHTML = html;

    var videoEl = body.querySelector('video');
    if (videoEl) setVideoSrc(videoEl, item.video);

    var shotImgs = body.querySelectorAll('.sc-shots img');
    for (var si = 0; si < shotImgs.length; si++) {
      (function (img) { img.addEventListener('click', function () { openLightbox(img.getAttribute('src')); }); })(shotImgs[si]);
    }

    showcase.classList.add('show');
    document.body.classList.add('showcase-open');
  }

  function closeShowcase() {
    showcase.classList.remove('show');
    document.body.classList.remove('showcase-open');
    document.getElementById('showcaseBody').innerHTML = '';
    if (currentObjectUrl) { URL.revokeObjectURL(currentObjectUrl); currentObjectUrl = null; }
  }
  document.getElementById('showcaseClose').addEventListener('click', closeShowcase);

  /* ---------- 视频卡片缩略图（用视频本身当封面） ---------- */
  var thumbUrls = [];
  function hydrateVideoThumbs() {
    thumbUrls.forEach(function (u) { URL.revokeObjectURL(u); });
    thumbUrls = [];
    var vids = document.querySelectorAll('.work-cover video[data-vsrc]');
    for (var i = 0; i < vids.length; i++) {
      (function (v) {
        var src = v.getAttribute('data-vsrc');
        if (!src) return;
        if (src.indexOf('idb://') === 0) {
          idbGet(src.slice(6)).then(function (blob) {
            if (blob && v.isConnected) {
              var u = URL.createObjectURL(blob);
              thumbUrls.push(u);
              v.src = u;
            }
          }).catch(function () {});
        } else {
          v.src = src;
        }
      })(vids[i]);
    }
  }
  window.__onWorksRender = hydrateVideoThumbs;
  hydrateVideoThumbs();

  /* ---------- 卡片点击（打开详情） + 编辑/删除/新增 ---------- */
  document.addEventListener('click', function (e) {
    var editBtn = e.target.closest('.act-edit');
    if (editBtn) {
      var kind = editBtn.getAttribute('data-kind');
      var idx = parseInt(editBtn.getAttribute('data-index'), 10);
      openModal(kind, idx, window.works.getData()[kind][idx]);
      return;
    }
    var delBtn = e.target.closest('.act-del');
    if (delBtn) {
      var dk = delBtn.getAttribute('data-kind');
      var di = parseInt(delBtn.getAttribute('data-index'), 10);
      if (confirm('确定删除这个作品吗？')) window.works.remove(dk, di);
      return;
    }
    var addBtn = e.target.closest('.work-add');
    if (addBtn) {
      openModal(addBtn.getAttribute('data-kind'), null, null);
      return;
    }
    var card = e.target.closest('.work-card');
    if (card && !card.classList.contains('is-empty')) {
      var ck = card.getAttribute('data-kind');
      var ci = parseInt(card.getAttribute('data-index'), 10);
      var item = window.works.getData()[ck] && window.works.getData()[ck][ci];
      if (item) {
        if (ck === 'video') openShowcase(item);
        else openDetail(item);
      }
      return;
    }
  });

  /* ---------- 工具栏：新增 / 导出 / 恢复 ---------- */
  document.getElementById('tbAddCopy').addEventListener('click', function () { openModal('copy', null, null); });
  document.getElementById('tbAddVideo').addEventListener('click', function () { openModal('video', null, null); });

  document.getElementById('tbReset').addEventListener('click', function () {
    if (confirm('恢复默认将清空你在本机的所有编辑，确定吗？')) window.works.reset();
  });

  /* ---------- 导出 works.js ---------- */
  document.getElementById('tbExport').addEventListener('click', function () {
    var data = window.works.getData();
    var copyJSON = JSON.stringify(data.copy, null, 2);
    var videoJSON = JSON.stringify(data.video, null, 2);
    var hasIdb = /idb:\/\//.test(copyJSON + videoJSON);

    fetch('works.js').then(function (r) { return r.text(); }).then(function (src) {
      src = src.replace(/\/\*__COPY_START__\*\/[\s\S]*?\/\*__COPY_END__\*\//, '/*__COPY_START__*/' + copyJSON + '/*__COPY_END__*/');
      src = src.replace(/\/\*__VIDEO_START__\*\/[\s\S]*?\/\*__VIDEO_END__\*\//, '/*__VIDEO_START__*/' + videoJSON + '/*__VIDEO_END__*/');
      var blob = new Blob([src], { type: 'text/javascript;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'works.js';
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (hasIdb) {
        alert('已导出 works.js。注意：里面有「本地视频」是存在你浏览器里的，发布前需把视频文件发我（我放进 assets/）或换成平台链接，否则访客看不到。');
      } else {
        alert('已导出 works.js。若用了本地图片，请把图片文件一起发我帮你发布。');
      }
    }).catch(function () {
      alert('导出失败：请通过 http://localhost:8000 访问本页（不要用 file:// 双击打开）。');
    });
  });

  /* ---------- Esc 关闭弹窗 ---------- */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeModal(); closeDetail(); closeLightbox(); closeShowcase(); }
  });
})();
