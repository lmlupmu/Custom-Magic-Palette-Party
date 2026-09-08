/* =====================================================
 * workshop.js  AI调色文创工坊
 * 支持：内置线稿 + 用户上传图片（可改名/删除）
 * 上传图片：按风格套滤镜模拟AI上色，按名字生成藏名小诗
 * ===================================================== */

let wsItemId = null;        // 选中的风物（内置id 或 custom:xxx）
let wsStyleId = 'spring';   // 选中的色调
let wsPoem = '';            // AI 生成的小诗
let wsGenerated = false;    // 是否已生成
let wsMode = 'postcard';    // 预览模式 postcard | teabox

/* 统一取当前选中项（内置/自定义） */
function getWsItem() {
  if (wsItemId && wsItemId.startsWith('custom:')) {
    return getCustomItems().find(c => c.id === wsItemId) || null;
  }
  return wsItemId ? getItem(wsItemId) : null;
}

/* ---------- 线稿图库 ---------- */
function renderGallery() {
  const unlocked = getUnlocked();
  const customs = getCustomItems();
  const grid = document.getElementById('galleryGrid');
  grid.innerHTML = '';

  // 内置风物
  ITEMS.forEach(item => {
    const isUnlocked = unlocked.includes(item.id);
    const cell = document.createElement('div');
    cell.className = 'g-cell' + (isUnlocked ? '' : ' locked') + (wsItemId === item.id ? ' active' : '');
    cell.innerHTML = isUnlocked
      ? `<div class="g-art">${sizedSvg(item.build(LINE_PAL, true), 110, 110)}</div><span>${item.name}</span>`
      : `<div class="g-art locked-art">${sizedSvg(item.build(LINE_PAL, true), 110, 110)}<div class="g-lock">未解锁</div></div><span>${item.name}</span>`;
    cell.onclick = () => {
      if (!isUnlocked) { toast('该线稿未解锁，先去消除小游戏通关收集吧'); return; }
      selectItem(item.id);
    };
    grid.appendChild(cell);
  });

  // 用户上传的自定义风物
  customs.forEach(c => {
    const cell = document.createElement('div');
    cell.className = 'g-cell custom' + (wsItemId === c.id ? ' active' : '');
    cell.innerHTML = `
      <div class="g-art"><img class="g-img" src="${c.img}" alt="${c.name}"><i class="g-del" title="删除">×</i></div>
      <span>${c.name}</span>
      <button class="g-rename">改名</button>`;
    cell.querySelector('.g-art').onclick = () => selectItem(c.id);
    cell.querySelector('.g-rename').onclick = (e) => { e.stopPropagation(); renameCustom(c.id); };
    cell.querySelector('.g-del').onclick = (e) => { e.stopPropagation(); deleteCustom(c.id); };
    grid.appendChild(cell);
  });

  // 上传入口
  const addCell = document.createElement('div');
  addCell.className = 'g-cell g-add';
  addCell.innerHTML = `<div class="g-add-inner">＋</div><span>上传我的风物</span>`;
  addCell.onclick = () => document.getElementById('customUpload').click();
  grid.appendChild(addCell);

  // 校验当前选中是否仍有效，否则回退到第一个已解锁
  if (!getWsItem()) {
    wsItemId = unlocked[0] || (customs[0] && customs[0].id) || null;
  }
  markActiveCell();
  renderPreviewLineArt();
}

function markActiveCell() {
  const cells = document.querySelectorAll('#galleryGrid .g-cell');
  const all = [...ITEMS.map(i => i.id), ...getCustomItems().map(c => c.id)];
  cells.forEach((cell, i) => cell.classList.toggle('active', all[i] === wsItemId));
}

/* ---------- 上传 / 改名 / 删除 ---------- */
function onCustomUpload(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('请选择图片文件'); return; }

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = async () => {
      // 压缩到最长边 900px，控制 localStorage 体积
      const scale = Math.min(1, 900 / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * scale);
      cv.height = Math.round(img.height * scale);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      const dataUrl = cv.toDataURL('image/jpeg', 0.85);

      const defName = file.name.replace(/\.\w+$/, '').slice(0, 8) || '我的风物';
      const name = await showNameDialog('为你的风物起个名字', 'AI 会分析这个名字，为你的文创赋诗一首', defName);
      if (!name) { toast('已取消上传'); return; }

      const list = getCustomItems();
      const item = { id: 'custom:' + Date.now(), name, alias: '我的风物', custom: true, img: dataUrl };
      list.push(item);
      if (!saveCustomItems(list)) { toast('本地存储空间不足，图片过大或未保存'); return; }
      renderGallery();
      selectItem(item.id);
      toast(`「${name}」已加入图库，选择色调后点击 AI 魔法生成`);
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

async function renameCustom(id) {
  const list = getCustomItems();
  const item = list.find(c => c.id === id);
  if (!item) return;
  const name = await showNameDialog('修改风物名字', 'AI 会分析这个名字，为你的文创赋诗一首', item.name);
  if (!name || name === item.name) return;
  item.name = name;
  saveCustomItems(list);
  renderGallery();
  if (wsItemId === id) { selectItem(id); toast(`已改名为「${name}」，重新生成可获得新小诗`); }
}

async function deleteCustom(id) {
  const item = getCustomItems().find(c => c.id === id);
  if (!item) return;
  if (!(await showConfirmDialog(`确定删除「${item.name}」吗？删除后不可恢复。`))) return;
  saveCustomItems(getCustomItems().filter(c => c.id !== id));
  if (wsItemId === id) wsItemId = null;
  renderGallery();
  toast('已删除');
}

/* ---------- 选中与预览（生成前） ---------- */
function selectItem(id) {
  wsItemId = id;
  wsGenerated = false;
  markActiveCell();
  document.getElementById('poemBox').classList.add('hidden');
  document.getElementById('previewModeBar').classList.add('hidden');
  document.getElementById('previewResult').classList.add('hidden');
  document.getElementById('previewEmpty').classList.remove('hidden');
  renderPreviewLineArt();
}

function renderPreviewLineArt() {
  const item = getWsItem();
  if (!item) return;
  const box = document.getElementById('previewLineArt');
  if (item.custom) {
    box.innerHTML = `<img class="preview-custom-img" src="${item.img}" alt="${item.name}">`;
    document.getElementById('previewHintText').textContent =
      `已选中你的风物「${item.name}」，选择色调后点击「AI魔法生成」`;
  } else {
    box.innerHTML = sizedSvg(item.build(LINE_PAL, true), 300, 300);
    document.getElementById('previewHintText').textContent =
      `已选中「${item.name} · ${item.alias}」线稿，选择色调后点击「AI魔法生成」`;
  }
}

/* ---------- 色调风格 ---------- */
function renderStyles() {
  const list = document.getElementById('styleList');
  list.innerHTML = '';
  STYLES.forEach(s => {
    const el = document.createElement('div');
    el.className = 'style-card' + (wsStyleId === s.id ? ' active' : '');
    el.innerHTML = `
      <div class="style-info">
        <strong>${s.name}</strong>
        <small>${s.desc}</small>
      </div>
      <div class="style-dots">
        ${['main', 'sub', 'deep', 'accent'].map(k => `<i style="background:${s.pal[k]}"></i>`).join('')}
      </div>`;
    el.onclick = () => {
      wsStyleId = s.id;
      wsGenerated = false;
      renderStyles();
      if (!document.getElementById('previewResult').classList.contains('hidden')) {
        document.getElementById('previewResult').classList.add('hidden');
        document.getElementById('previewEmpty').classList.remove('hidden');
        document.getElementById('previewModeBar').classList.add('hidden');
        document.getElementById('poemBox').classList.add('hidden');
      }
    };
    list.appendChild(el);
  });
}

/* ---------- AI 魔法生成 ---------- */
const AI_STEPS = ['AI 正在理解线稿结构…', 'AI 正在调配艺术色彩…', 'AI 正在吟咏国风小诗…', 'AI 正在装裱文创成品…'];
const AI_STEPS_CUSTOM = ['AI 正在识别你的风物…', 'AI 正在分析名字意境…', 'AI 正在吟咏专属小诗…', 'AI 正在装裱文创成品…'];

function generateArtwork() {
  if (!getWsItem()) { toast('请先在左侧选择一张已解锁的风物线稿'); return; }
  const btn = document.getElementById('btnMagic');
  btn.disabled = true;

  document.getElementById('previewEmpty').classList.add('hidden');
  document.getElementById('previewResult').classList.add('hidden');
  document.getElementById('previewModeBar').classList.add('hidden');
  document.getElementById('poemBox').classList.add('hidden');
  const loading = document.getElementById('aiLoading');
  const loadingText = document.getElementById('aiLoadingText');
  loading.classList.remove('hidden');

  const steps = getWsItem().custom ? AI_STEPS_CUSTOM : AI_STEPS;
  let step = 0;
  loadingText.textContent = steps[0];
  const timer = setInterval(() => {
    step++;
    if (step < steps.length) {
      loadingText.textContent = steps[step];
    } else {
      clearInterval(timer);
      loading.classList.add('hidden');
      finishGenerate();
      btn.disabled = false;
    }
  }, 620);
}

function finishGenerate() {
  const item = getWsItem();
  const style = getStyle(wsStyleId);
  wsPoem = item.custom ? generateCustomPoem(item.name, wsStyleId) : POEMS[wsItemId][wsStyleId];
  wsGenerated = true;

  document.getElementById('previewModeBar').classList.remove('hidden');
  renderPreview();

  // AI 小诗（带打字机效果）
  const poemBox = document.getElementById('poemBox');
  poemBox.classList.remove('hidden');
  document.getElementById('poemStyleName').textContent = item.custom
    ? `AI 分析「${item.name}」赋诗 · ${style.name}`
    : `为「${item.name}」赋诗 · ${style.name}`;
  typePoem(wsPoem);
  toast('AI 文创生成完成，可切换预览模式或下载保存');
}

function typePoem(text) {
  const el = document.getElementById('poemText');
  el.innerHTML = '';
  const lines = text.split('\n');
  let li = 0, ci = 0;
  const t = setInterval(() => {
    if (li >= lines.length) { clearInterval(t); return; }
    const line = lines[li];
    el.innerHTML = lines.slice(0, li).join('<br>') + (li ? '<br>' : '') + line.slice(0, ci + 1) + '<span class="cursor">▏</span>';
    ci++;
    if (ci >= line.length) { li++; ci = 0; }
    if (li >= lines.length) {
      clearInterval(t);
      el.innerHTML = lines.join('<br>');
    }
  }, 70);
}

/* ---------- 预览：明信片 / 茶叶礼盒 ---------- */
function setPreviewMode(mode) {
  wsMode = mode;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  renderPreview();
}

/* 预览用插画 HTML：内置=SVG上色，自定义=图片+风格滤镜 */
function previewArtHtml(item, style, size) {
  if (item.custom) {
    const filter = CUSTOM_FILTERS[wsStyleId] || 'none';
    return `<div class="pv-custom" style="background:${style.pal.bg}"><img src="${item.img}" style="filter:${filter}" alt="${item.name}"></div>`;
  }
  return sizedSvg(item.build(style.pal, true), size, size);
}

function renderPreview() {
  if (!wsGenerated) return;
  const item = getWsItem();
  const style = getStyle(wsStyleId);
  const art = previewArtHtml(item, style, 420);
  const stage = document.getElementById('previewResult');
  stage.classList.remove('hidden');

  if (wsMode === 'postcard') {
    stage.innerHTML = `
    <div class="postcard" style="background:${style.pal.paper}">
      <div class="pc-art">${art}</div>
      <div class="pc-right">
        <div class="pc-stamp" style="border-color:${style.pal.accent};color:${style.pal.accent}">信阳<br>印象</div>
        <div class="pc-poem" style="color:${style.pal.deep}">${wsPoem.split('\n').map(l => `<span>${l}</span>`).join('')}</div>
        <div class="pc-title" style="color:${style.pal.deep}">信阳风物 · ${item.name}</div>
      </div>
      <div class="pc-foot">大别山乡土风物 AI 文创 · ${style.name}</div>
    </div>`;
  } else {
    stage.innerHTML = `
    <div class="teabox" style="background:${style.pal.paper};border-color:${style.pal.deep}">
      <div class="tb-brand" style="color:${style.pal.deep}">信阳毛尖</div>
      <div class="tb-sub" style="color:${style.pal.main}">XINYANG MAOJIAN · 大别山云雾茶</div>
      <div class="tb-art" style="border-color:${style.pal.main}">${item.custom ? previewArtHtml(item, style, 300) : sizedSvg(item.build(style.pal, true), 300, 300)}</div>
      <div class="tb-name" style="color:${style.pal.deep}">${item.name} · ${item.alias}</div>
      <div class="tb-poem" style="color:${style.pal.deep}">${wsPoem.split('\n').slice(0, 2).join('　')}</div>
      <div class="tb-seal" style="background:${style.pal.accent}">${item.name.slice(0, 1)}</div>
    </div>`;
  }
}

/* ---------- 下载文创成品 ---------- */
function loadSvgImg(svg, w, h) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sizedSvg(svg, w, h));
  });
}

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/* 取当前项的 canvas 用图（内置=SVG图，自定义=带滤镜图片） */
async function getArtImage(item, size) {
  if (item.custom) return { img: await loadImg(item.img), filter: CUSTOM_FILTERS[wsStyleId] || 'none', custom: true };
  return { img: await loadSvgImg(item.build(getStyle(wsStyleId).pal, true), size, size), filter: 'none', custom: false };
}

/* cover 方式绘制图片（带滤镜）到指定方形区域 */
function drawCover(ctx, art, x, y, w, h) {
  const img = art.img;
  ctx.save();
  try { ctx.filter = art.filter; } catch (e) { /* 老浏览器无滤镜则原样绘制 */ }
  if (art.custom) {
    const s = Math.max(w / img.width, h / img.height);
    const dw = img.width * s, dh = img.height * s;
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  } else {
    ctx.drawImage(img, x, y, w, h);
  }
  ctx.restore();
}

async function downloadArtwork() {
  if (!wsGenerated) { toast('请先点击「AI魔法生成」'); return; }
  const item = getWsItem();
  const style = getStyle(wsStyleId);
  const pal = style.pal;
  const lines = wsPoem.split('\n');
  const KAI = '"KaiTi","STKaiti","楷体",serif';

  let canvas, ctx;
  if (wsMode === 'postcard') {
    canvas = document.createElement('canvas');
    canvas.width = 1200; canvas.height = 760;
    ctx = canvas.getContext('2d');
    // 纸面与边框
    ctx.fillStyle = pal.paper; ctx.fillRect(0, 0, 1200, 760);
    ctx.strokeStyle = pal.main; ctx.lineWidth = 4; ctx.strokeRect(24, 24, 1152, 712);
    ctx.strokeStyle = pal.main; ctx.lineWidth = 1.5; ctx.strokeRect(40, 40, 1120, 680);
    // 左侧插画
    if (item.custom) { ctx.fillStyle = pal.bg; ctx.fillRect(60, 110, 500, 500); }
    drawCover(ctx, await getArtImage(item, 500), 60, 110, 500, 500);
    ctx.strokeStyle = pal.main; ctx.lineWidth = 2; ctx.strokeRect(60, 110, 500, 500);
    // 右侧邮票框
    ctx.strokeStyle = pal.accent; ctx.lineWidth = 3; ctx.strokeRect(1000, 80, 120, 140);
    ctx.fillStyle = pal.accent; ctx.font = `34px ${KAI}`; ctx.textAlign = 'center';
    ctx.fillText('信阳', 1060, 140); ctx.fillText('印象', 1060, 185);
    // 右侧竖排小诗（从右往左排列）
    ctx.fillStyle = pal.deep; ctx.font = `38px ${KAI}`;
    lines.forEach((line, col) => {
      const x = 880 - col * 76;
      [...line].forEach((ch, row) => ctx.fillText(ch, x, 180 + row * 52));
    });
    // 标题与落款
    ctx.fillStyle = pal.deep; ctx.font = `44px ${KAI}`; ctx.textAlign = 'left';
    ctx.fillText(`信阳风物 · ${item.name}`, 620, 640);
    ctx.font = `24px ${KAI}`; ctx.fillStyle = pal.main;
    ctx.fillText(`大别山乡土风物 AI 文创 · ${style.name} · 风物魔法调色派对`, 620, 690);
  } else {
    canvas = document.createElement('canvas');
    canvas.width = 1000; canvas.height = 1000;
    ctx = canvas.getContext('2d');
    ctx.fillStyle = pal.paper; ctx.fillRect(0, 0, 1000, 1000);
    ctx.strokeStyle = pal.deep; ctx.lineWidth = 6; ctx.strokeRect(30, 30, 940, 940);
    ctx.strokeStyle = pal.deep; ctx.lineWidth = 2; ctx.strokeRect(52, 52, 896, 896);
    ctx.textAlign = 'center';
    // 品牌
    ctx.fillStyle = pal.deep; ctx.font = `90px ${KAI}`;
    ctx.fillText('信阳毛尖', 500, 170);
    ctx.fillStyle = pal.main; ctx.font = `26px ${KAI}`;
    ctx.fillText('XINYANG MAOJIAN · 大别山云雾茶', 500, 220);
    // 圆形插画
    const art = await getArtImage(item, 420);
    ctx.save();
    ctx.beginPath(); ctx.arc(500, 480, 215, 0, Math.PI * 2); ctx.clip();
    if (item.custom) { ctx.fillStyle = pal.bg; ctx.fillRect(285, 265, 430, 430); }
    drawCover(ctx, art, 290, 270, 420, 420);
    ctx.restore();
    ctx.strokeStyle = pal.main; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(500, 480, 215, 0, Math.PI * 2); ctx.stroke();
    // 名称与小诗
    ctx.fillStyle = pal.deep; ctx.font = `46px ${KAI}`;
    ctx.fillText(`${item.name} · ${item.alias}`, 500, 780);
    ctx.font = `34px ${KAI}`;
    ctx.fillText(lines[0] + '　' + lines[1], 500, 850);
    // 印章
    ctx.fillStyle = pal.accent; ctx.fillRect(790, 800, 84, 84);
    ctx.fillStyle = '#FFF'; ctx.font = `52px ${KAI}`;
    ctx.fillText(item.name.slice(0, 1), 832, 860);
  }

  const a = document.createElement('a');
  a.download = `信阳风物_${item.name}_${style.name}_${wsMode === 'postcard' ? '明信片' : '茶叶礼盒'}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
  toast('文创成品已保存到本地');
}
