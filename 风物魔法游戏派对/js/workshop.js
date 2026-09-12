/* =====================================================
 * workshop.js  AI调色文创工坊
 * 支持：内置线稿 + 用户上传图片（可改名/删除）
 * 上传图片：按风格套滤镜模拟AI上色，按名字生成藏名小诗
 * ===================================================== */

let wsItemId = null;        // 选中的风物（内置id 或 custom:xxx）
let wsStyleId = 'spring';   // 选中的色调
let wsPoem = '';            // AI 生成的小诗
let wsGenerated = false;    // 是否已生成
let wsAiImage = null;       // AI 风格化后的图片（dataURL），null 时回退 CSS 滤镜
let wsMode = 'postcard';    // 预览模式 postcard | teabox

/* 下载分辨率档位：基准尺寸的 1x/2x/3x 等比放大导出，选择存 localStorage 刷新保持 */
const WS_RES = {
  postcard: [
    { label: '标准', w: 1200, h: 760 },
    { label: '高清', w: 2400, h: 1520 },
    { label: '超清', w: 3600, h: 2280 }
  ],
  teabox: [
    { label: '标准', w: 1000, h: 1000 },
    { label: '高清', w: 2000, h: 2000 },
    { label: '超清', w: 3000, h: 3000 }
  ]
};
const WS_BASE = { postcard: { w: 1200, h: 760 }, teabox: { w: 1000, h: 1000 } };
let wsResIdx = Math.min(2, Math.max(0, parseInt(localStorage.getItem('wm_resolution'), 10) || 0)); // 当前档位下标，默认「标准」

/* 版式模板：每种预览模式独立记忆当前模板 */
const WS_TPLS = {
  postcard: [
    { id: 'classic', name: '经典', tip: '经典竖诗款：左图右竖排诗 + 邮票框' },
    { id: 'wide', name: '横版', tip: '横版全图款：上方大幅横图，下方标题与横排小诗' },
    { id: 'journal', name: '手账', tip: '手账拼贴款：旋转照片贴纸 + 胶带 + 标签标题' }
  ],
  teabox: [
    { id: 'classic', name: '经典', tip: '经典圆图款：品牌大字 + 圆形插画 + 印章' },
    { id: 'landscape', name: '山水', tip: '山水开窗款：左侧竖排品牌 + 圆角开窗插画' },
    { id: 'minimal', name: '极简', tip: '极简大字款：超大风物名主视觉 + 大量留白' }
  ]
};
let wsTpl = { postcard: 'classic', teabox: 'classic' };

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
  wsAiImage = null;
  markActiveCell();
  document.getElementById('poemBox').classList.add('hidden');
  document.getElementById('previewModeBar').classList.add('hidden');
  document.getElementById('previewTplBar').classList.add('hidden');
  document.getElementById('previewResult').classList.add('hidden');
  document.getElementById('previewEmpty').classList.remove('hidden');
  renderPreviewLineArt();
  SoundFX.click();
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
      wsAiImage = null;
      SoundFX.click();
      renderStyles();
      renderTplBar();
      if (!document.getElementById('previewResult').classList.contains('hidden')) {
        document.getElementById('previewResult').classList.add('hidden');
        document.getElementById('previewEmpty').classList.remove('hidden');
        document.getElementById('previewModeBar').classList.add('hidden');
        document.getElementById('previewTplBar').classList.add('hidden');
        document.getElementById('poemBox').classList.add('hidden');
      }
    };
    list.appendChild(el);
  });
}

/* ---------- AI 魔法生成 ---------- */
const AI_STEPS = ['AI 正在理解线稿结构…', 'AI 正在调配艺术色彩…', 'AI 正在吟咏国风小诗…', 'AI 正在装裱文创成品…'];
const AI_STEPS_CUSTOM = ['AI 正在识别你的风物…', 'AI 正在分析名字意境…', 'AI 正在吟咏专属小诗…', 'AI 正在装裱文创成品…'];

/* ---------- 真实 AI API 调用（Cloudflare Workers AI） ---------- */
async function callAIPoem(item, style) {
  try {
    const resp = await fetch('/api/generate-poem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: item.name,
        alias: item.alias || '',
        styleName: style.name,
        styleDesc: style.desc,
        isCustom: !!item.custom
      })
    });
    if (!resp.ok) throw new Error('poem API ' + resp.status);
    const data = await resp.json();
    const lines = (data.poem || '').split('\n').filter(l => l.trim());
    if (lines.length >= 2) return data.poem.trim();
    throw new Error('poem format invalid');
  } catch (e) { return null; }
}

async function callAIStylize(item, style) {
  if (!item.custom) return null;
  try {
    const resp = await fetch('/api/stylize-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: item.img,
        styleName: style.name,
        styleDesc: style.desc
      })
    });
    if (!resp.ok) throw new Error('image API ' + resp.status);
    const data = await resp.json();
    if (data.image) return data.image;
    throw new Error('no image in response');
  } catch (e) { return null; }
}

/* 自定义图片 HTML：AI 风格化图优先，否则 CSS 滤镜 */
function customImgTag(item, pal, fillClass) {
  const cls = fillClass ? ' ' + fillClass : '';
  if (wsAiImage) {
    return `<div class="pv-custom${cls}" style="background:${pal.bg}"><img src="${wsAiImage}" alt="${item.name}"></div>`;
  }
  const filter = CUSTOM_FILTERS[wsStyleId] || 'none';
  return `<div class="pv-custom${cls}" style="background:${pal.bg}"><img src="${item.img}" style="filter:${filter}" alt="${item.name}"></div>`;
}

function fallbackPoem(item, styleId) {
  if (item.custom) return generateCustomPoem(item.name, styleId);
  const bank = POEMS[wsItemId];
  return bank ? bank[styleId] : POEMS.tea.spring;
}

async function generateArtwork() {
  const item = getWsItem();
  if (!item) { toast('请先在左侧选择一张已解锁的风物线稿'); return; }
  const btn = document.getElementById('btnMagic');
  btn.disabled = true;

  document.getElementById('previewEmpty').classList.add('hidden');
  document.getElementById('previewResult').classList.add('hidden');
  document.getElementById('previewModeBar').classList.add('hidden');
  document.getElementById('previewTplBar').classList.add('hidden');
  document.getElementById('poemBox').classList.add('hidden');
  const loading = document.getElementById('aiLoading');
  const loadingText = document.getElementById('aiLoadingText');
  loading.classList.remove('hidden');

  const style = getStyle(wsStyleId);
  const steps = item.custom ? AI_STEPS_CUSTOM : AI_STEPS;
  let step = 0;
  loadingText.textContent = steps[0];
  const timer = setInterval(() => {
    step = (step + 1) % steps.length;
    loadingText.textContent = steps[step];
  }, 1000);

  try {
    const [aiPoem, aiImage] = await Promise.all([
      callAIPoem(item, style),
      callAIStylize(item, style)
    ]);

    clearInterval(timer);
    loading.classList.add('hidden');

    wsPoem = aiPoem || fallbackPoem(item, wsStyleId);
    wsAiImage = aiImage;

    if (!aiPoem) toast('AI 诗词服务暂不可用，已使用本地诗库');
    if (item.custom && !aiImage) toast('AI 图像风格化暂不可用，已使用滤镜模拟');
    finishGenerate();
  } catch (e) {
    clearInterval(timer);
    loading.classList.add('hidden');
    wsPoem = fallbackPoem(item, wsStyleId);
    wsAiImage = null;
    finishGenerate();
    toast('AI 服务暂时不可用，已使用本地生成');
  } finally {
    btn.disabled = false;
  }
}

function finishGenerate() {
  const item = getWsItem();
  const style = getStyle(wsStyleId);
  wsGenerated = true;

  document.getElementById('previewModeBar').classList.remove('hidden');
  renderResSelect();
  renderTplBar();
  document.getElementById('previewTplBar').classList.remove('hidden');
  renderPreview();

  // AI 小诗（带打字机效果）
  const poemBox = document.getElementById('poemBox');
  poemBox.classList.remove('hidden');
  document.getElementById('poemStyleName').textContent = `AI 为「${item.name}」赋诗 · ${style.name}`;
  typePoem(wsPoem);
  SoundFX.generate();
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
  renderResSelect();
  renderTplBar();
  renderPreview();
}

/* 分辨率 chip 条：按当前预览模式渲染三档（标签含实际像素），选中态存 localStorage 刷新保持 */
function renderResSelect() {
  const bar = document.getElementById('resChips');
  if (!bar) return;
  const accent = getStyle(wsStyleId).pal.accent;
  bar.innerHTML = '';
  WS_RES[wsMode].forEach((r, i) => {
    const on = i === wsResIdx;
    const b = document.createElement('button');
    b.className = 'res-chip' + (on ? ' active' : '');
    b.textContent = `${r.label} ${r.w}×${r.h}`;
    b.title = `下载 PNG 分辨率 ${r.w}×${r.h}`;
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) { b.style.background = accent; b.style.borderColor = accent; }
    b.onclick = () => setResolution(i);
    bar.appendChild(b);
  });
}

function setResolution(i) {
  if (i === wsResIdx) return;
  wsResIdx = i;
  try { localStorage.setItem('wm_resolution', String(i)); } catch (e) { /* 隐私模式下忽略 */ }
  SoundFX.click();
  renderResSelect();
  const r = WS_RES[wsMode][i];
  toast(`分辨率：${r.label} ${r.w}×${r.h}`);
}

/* 模板选择 chip 条：按当前模式渲染，选中态用当前风格 accent 色 */
function renderTplBar() {
  const bar = document.getElementById('previewTplBar');
  if (!bar) return;
  const accent = getStyle(wsStyleId).pal.accent;
  bar.innerHTML = '';
  WS_TPLS[wsMode].forEach(t => {
    const b = document.createElement('button');
    b.className = 'tpl-chip' + (wsTpl[wsMode] === t.id ? ' active' : '');
    b.textContent = t.name;
    b.title = t.tip;
    if (wsTpl[wsMode] === t.id) { b.style.background = accent; b.style.borderColor = accent; }
    b.onclick = () => { wsTpl[wsMode] = t.id; SoundFX.click(); renderTplBar(); renderPreview(); };
    bar.appendChild(b);
  });
}

/* SVG 设为 slice 裁切模式：用于横版/开窗等非方形区域 cover 显示内置线稿 */
function sliceSvg(svg) {
  return svg.indexOf('preserveAspectRatio') >= 0
    ? svg.replace(/preserveAspectRatio="[^"]*"/, 'preserveAspectRatio="xMidYMid slice"')
    : svg.replace('<svg ', '<svg preserveAspectRatio="xMidYMid slice" ');
}

/* 茶叶礼盒文案生成：按风物名自动识别茶类并去「信阳」前缀取核心名
   例：自定义「信阳龙井」→ 龙井 · 绿茶 / 信阳龙井 · 山水之礼 / 信阳龙井礼盒 */
function teaboxText(item) {
  const raw = item.name;
  const isTea = /茶|龙井|毛尖|普洱|观音|碧螺/.test(raw) || item.id === 'tea';
  const core = raw.replace(/^信阳/, '');
  const prod = isTea ? (item.id === 'tea' ? '毛尖' : (core.replace(/茶(叶)?$/, '') || '毛尖')) : core;
  return {
    brand: isTea ? `${prod} · 绿茶` : (item.custom ? core : `${raw} · ${item.alias}`),
    sub: `${raw} · 山水之礼`,
    subEn: isTea ? 'XINYANG TEA · 大别山云雾茶' : 'XINYANG FENGWU · 大别山风物',
    nameLine: isTea ? `${prod}礼盒` : (item.custom ? `${raw}礼盒` : `${raw} · ${item.alias}`)
  };
}

/* 预览用插画 HTML：内置=SVG上色，自定义=图片+风格滤镜 */
function previewArtHtml(item, style, size) {
  if (item.custom) return customImgTag(item, style.pal);
  return sizedSvg(item.build(style.pal, true), size, size);
}

function renderPreview() {
  if (!wsGenerated) return;
  const item = getWsItem();
  const style = getStyle(wsStyleId);
  const pal = style.pal;
  const art = previewArtHtml(item, style, 420);
  const stage = document.getElementById('previewResult');
  stage.classList.remove('hidden');
  const tpl = wsTpl[wsMode];
  const lines = wsPoem.split('\n');

  if (wsMode === 'postcard') {
    if (tpl === 'wide') {
      /* 横版全图款：上方大幅横图，下方标题 + 横排小诗 + 小印章 */
      const wideArt = item.custom
        ? customImgTag(item, pal, 'pv-fill')
        : sizedSvg(sliceSvg(item.build(pal, true)), 640, 352);
      stage.innerHTML = `
      <div class="postcard pc-wide" style="background:${pal.paper}">
        <div class="pcw-art">${wideArt}</div>
        <div class="pcw-stamp" style="border-color:${pal.accent};color:${pal.accent}">信阳<br>印象</div>
        <div class="pcw-info">
          <div class="pcw-title" style="color:${pal.deep}">信阳风物 · ${item.name}</div>
          <div class="pcw-poem" style="color:${pal.deep}">${lines.slice(0, 2).join('<br>')}</div>
        </div>
        <div class="pcw-seal" style="background:${pal.accent}">${item.name.slice(0, 1)}</div>
        <div class="pc-foot">大别山乡土风物 AI 文创 · ${style.name}</div>
      </div>`;
    } else if (tpl === 'journal') {
      /* 手账拼贴款：纸纹底 + 旋转照片 + 胶带 + 标签标题 + 手写感小诗 */
      stage.innerHTML = `
      <div class="postcard pc-journal" style="background-color:${pal.paper}">
        <div class="pcj-photo">
          <i class="pcj-tape" style="background:${pal.accent}"></i>
          ${art}
        </div>
        <div class="pcj-label" style="border-color:${pal.accent};color:${pal.deep}">信阳风物 · ${item.name}</div>
        <div class="pcj-poem" style="color:${pal.deep}">${lines.join('<br>')}</div>
        <div class="pcj-seal" style="background:${pal.accent}">${item.name.slice(0, 1)}</div>
        <div class="pc-foot">大别山乡土风物 AI 文创 · ${style.name}</div>
      </div>`;
    } else {
      /* 经典竖诗款（原有版式） */
      stage.innerHTML = `
      <div class="postcard" style="background:${pal.paper}">
        <div class="pc-art">${art}</div>
        <div class="pc-right">
          <div class="pc-stamp" style="border-color:${pal.accent};color:${pal.accent}">信阳<br>印象</div>
          <div class="pc-poem" style="color:${pal.deep}">${wsPoem.split('\n').map(l => `<span>${l}</span>`).join('')}</div>
          <div class="pc-title" style="color:${pal.deep}">信阳风物 · ${item.name}</div>
        </div>
        <div class="pc-foot">大别山乡土风物 AI 文创 · ${style.name}</div>
      </div>`;
    }
  } else {
    /* 品牌文案按风物名自动生成：茶类自动识别，去「信阳」前缀取核心名 */
    const tb = teaboxText(item);
    const core = tb.brand.split(' · ')[0];
    if (tpl === 'landscape') {
      /* 山水开窗款：左侧竖排品牌 + 右侧双线描边圆角开窗插画 */
      const winArt = item.custom
        ? customImgTag(item, pal, 'pv-fill')
        : sizedSvg(sliceSvg(item.build(pal, true)), 480, 360);
      stage.innerHTML = `
      <div class="teabox tb-landscape" style="background:${pal.paper};border-color:${pal.deep}">
        <div class="tbl-brand" style="color:${pal.deep}">${core}</div>
        <div class="tbl-main">
          <div class="tbl-frame" style="border-color:${pal.deep}">
            <div class="tbl-art" style="border-color:${pal.main}">${winArt}</div>
          </div>
          <div class="tbl-name" style="color:${pal.deep}">${tb.nameLine}</div>
          <div class="tbl-poem" style="color:${pal.deep}">${lines.slice(0, 2).join('　')}</div>
        </div>
        <div class="tb-seal" style="background:${pal.accent}">${item.name.slice(0, 1)}</div>
      </div>`;
    } else if (tpl === 'minimal') {
      /* 极简大字款：超大风物名主视觉 + 风格色带 + 底部小圆图 */
      stage.innerHTML = `
      <div class="teabox tb-minimal" style="background:${pal.paper};border-color:${pal.deep}">
        <div class="tbm-band" style="background:${pal.bg}"></div>
        <div class="tbm-sub" style="color:${pal.main}">${tb.sub}</div>
        <div class="tbm-big${core.length > 4 ? ' long' : ''}" style="color:${pal.deep}">${core}</div>
        <div class="tbm-en" style="color:${pal.main}">${tb.subEn}</div>
        <div class="tbm-art" style="border-color:${pal.main}">${previewArtHtml(item, style, 300)}</div>
        <div class="tbm-poem" style="color:${pal.deep}">${lines[0]}</div>
        <div class="tb-seal tbm-seal" style="background:${pal.accent}">${item.name.slice(0, 1)}</div>
      </div>`;
    } else {
      /* 经典圆图款（原有版式） */
      stage.innerHTML = `
      <div class="teabox" style="background:${pal.paper};border-color:${pal.deep}">
        <div class="tb-brand" style="color:${pal.deep}">${tb.brand}</div>
        <div class="tb-sub" style="color:${pal.main}">${tb.sub}</div>
        <div class="tb-art" style="border-color:${pal.main}">${item.custom ? previewArtHtml(item, style, 300) : sizedSvg(item.build(style.pal, true), 300, 300)}</div>
        <div class="tb-name" style="color:${pal.deep}">${item.name} · ${item.alias}</div>
        <div class="tb-poem" style="color:${pal.deep}">${wsPoem.split('\n').slice(0, 2).join('　')}</div>
        <div class="tb-seal" style="background:${pal.accent}">${item.name.slice(0, 1)}</div>
      </div>`;
    }
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

/* 取某项的 canvas 用图（内置=按指定风格上色的SVG图，自定义=带该风格滤镜的图片）；styleId 缺省取当前选中色调 */
async function getArtImage(item, size, styleId) {
  const sid = styleId || wsStyleId;
  if (item.custom) {
    if (wsAiImage && (!styleId || styleId === wsStyleId)) {
      return { img: await loadImg(wsAiImage), filter: 'none', custom: true };
    }
    return { img: await loadImg(item.img), filter: CUSTOM_FILTERS[sid] || 'none', custom: true };
  }
  return { img: await loadSvgImg(item.build(getStyle(sid).pal, true), size, size), filter: 'none', custom: false };
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

/* canvas 圆角矩形路径 */
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* 非方形区域的插画图（内置线稿用 slice 裁切，自定义图走 drawCover cover） */
async function getArtImageSlice(item, w, h) {
  if (item.custom) {
    if (wsAiImage) return { img: await loadImg(wsAiImage), filter: 'none', custom: true };
    return { img: await loadImg(item.img), filter: CUSTOM_FILTERS[wsStyleId] || 'none', custom: true };
  }
  return { img: await loadSvgImg(sliceSvg(item.build(getStyle(wsStyleId).pal, true)), w, h), filter: 'none', custom: false };
}

async function downloadArtwork() {
  if (!wsGenerated) { toast('请先点击「AI魔法生成」'); return; }
  const item = getWsItem();
  const style = getStyle(wsStyleId);
  const pal = style.pal;
  const lines = wsPoem.split('\n');
  const KAI = '"KaiTi","STKaiti","楷体",serif';
  const tpl = wsTpl[wsMode];
  const sealChar = item.name.slice(0, 1);

  /* 分辨率：绘制逻辑仍用基准尺寸坐标，通过 setTransform 等比放大，文字/线稿按矢量精度重绘不模糊；
     SVG 插画按 scale 请求更大尺寸，保证高分档下同样清晰 */
  const res = WS_RES[wsMode][wsResIdx];
  const scale = res.w / WS_BASE[wsMode].w;
  const sz = n => Math.round(n * scale);

  let canvas, ctx;
  if (wsMode === 'postcard') {
    canvas = document.createElement('canvas');
    canvas.width = res.w; canvas.height = res.h;
    ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = pal.paper; ctx.fillRect(0, 0, 1200, 760);

    if (tpl === 'wide') {
      /* 横版全图款：上方大幅横图约 55%，下方标题 + 横排小诗 + 右下小印章 */
      if (item.custom) { ctx.fillStyle = pal.bg; ctx.fillRect(40, 40, 1120, 400); }
      drawCover(ctx, await getArtImageSlice(item, sz(1120), sz(400)), 40, 40, 1120, 400);
      ctx.strokeStyle = pal.main; ctx.lineWidth = 2; ctx.strokeRect(40, 40, 1120, 400);
      // 右上角小邮票框
      ctx.strokeStyle = pal.accent; ctx.lineWidth = 3; ctx.strokeRect(1048, 62, 88, 102);
      ctx.fillStyle = pal.accent; ctx.font = `26px ${KAI}`; ctx.textAlign = 'center';
      ctx.fillText('信阳', 1092, 104); ctx.fillText('印象', 1092, 140);
      // 左对齐标题 + 横排小诗两句
      ctx.textAlign = 'left'; ctx.fillStyle = pal.deep;
      ctx.font = `46px ${KAI}`;
      ctx.fillText(`信阳风物 · ${item.name}`, 70, 550);
      ctx.font = `30px ${KAI}`;
      lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, 70, 610 + i * 46));
      // 右下小印章
      ctx.fillStyle = pal.accent; ctx.fillRect(1050, 570, 70, 70);
      ctx.fillStyle = '#FFF'; ctx.font = `42px ${KAI}`; ctx.textAlign = 'center';
      ctx.fillText(sealChar, 1085, 620);
      // 落款
      ctx.fillStyle = pal.main; ctx.font = `22px ${KAI}`; ctx.textAlign = 'left';
      ctx.fillText(`大别山乡土风物 AI 文创 · ${style.name} · 风物魔法调色派对`, 70, 715);
    } else if (tpl === 'journal') {
      /* 手账拼贴款：纸纹底 + 旋转白框照片 + 胶带 + 标签标题 + 横排小诗 */
      // 纸纹底点
      ctx.fillStyle = pal.main; ctx.globalAlpha = 0.07;
      for (let dx = 26; dx < 1200; dx += 34) {
        for (let dy = 26; dy < 760; dy += 34) { ctx.beginPath(); ctx.arc(dx, dy, 1.6, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
      // 旋转照片（白色相框边）
      ctx.save();
      ctx.translate(400, 390); ctx.rotate(-2 * Math.PI / 180);
      ctx.fillStyle = '#FFF'; ctx.fillRect(-290, -305, 580, 610);
      ctx.strokeStyle = pal.main; ctx.lineWidth = 2; ctx.strokeRect(-290, -305, 580, 610);
      if (item.custom) { ctx.fillStyle = pal.bg; ctx.fillRect(-258, -272, 516, 516); }
      drawCover(ctx, await getArtImage(item, sz(516)), -258, -272, 516, 516);
      // 顶部半透明胶带（accent 50%）
      ctx.globalAlpha = 0.5; ctx.fillStyle = pal.accent;
      ctx.fillRect(-100, -330, 200, 48);
      ctx.globalAlpha = 1;
      ctx.restore();
      // 标签贴纸标题（accent 描边胶囊）
      ctx.strokeStyle = pal.accent; ctx.lineWidth = 2.5;
      rr(ctx, 770, 90, 360, 74, 37); ctx.stroke();
      ctx.fillStyle = pal.deep; ctx.font = `34px ${KAI}`; ctx.textAlign = 'center';
      ctx.fillText(`信阳风物 · ${item.name}`, 950, 140);
      // 右下横排小诗（楷体手写感）
      ctx.font = `32px ${KAI}`; ctx.textAlign = 'left'; ctx.fillStyle = pal.deep;
      lines.forEach((l, i) => ctx.fillText(l, 770, 460 + i * 54));
      // 小印章
      ctx.fillStyle = pal.accent; ctx.fillRect(1048, 630, 64, 64);
      ctx.fillStyle = '#FFF'; ctx.font = `40px ${KAI}`; ctx.textAlign = 'center';
      ctx.fillText(sealChar, 1080, 677);
      ctx.fillStyle = pal.main; ctx.font = `20px ${KAI}`; ctx.textAlign = 'left';
      ctx.fillText(`大别山乡土风物 AI 文创 · ${style.name} · 风物魔法调色派对`, 60, 722);
    } else {
      /* 经典竖诗款（原有版式） */
      ctx.strokeStyle = pal.main; ctx.lineWidth = 4; ctx.strokeRect(24, 24, 1152, 712);
      ctx.strokeStyle = pal.main; ctx.lineWidth = 1.5; ctx.strokeRect(40, 40, 1120, 680);
      // 左侧插画
      if (item.custom) { ctx.fillStyle = pal.bg; ctx.fillRect(60, 110, 500, 500); }
      drawCover(ctx, await getArtImage(item, sz(500)), 60, 110, 500, 500);
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
    }
  } else {
    canvas = document.createElement('canvas');
    canvas.width = res.w; canvas.height = res.h;
    ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = pal.paper; ctx.fillRect(0, 0, 1000, 1000);
    const tb2 = teaboxText(item);
    const core = tb2.brand.split(' · ')[0];

    if (tpl === 'landscape') {
      /* 山水开窗款：左侧竖排品牌大字 + 右侧双线描边圆角开窗插画 */
      ctx.strokeStyle = pal.deep; ctx.lineWidth = 6; ctx.strokeRect(30, 30, 940, 940);
      ctx.strokeStyle = pal.deep; ctx.lineWidth = 2; ctx.strokeRect(52, 52, 896, 896);
      // 左侧竖排品牌
      ctx.fillStyle = pal.deep; ctx.font = `72px ${KAI}`; ctx.textAlign = 'center';
      [...core].forEach((ch, i) => ctx.fillText(ch, 132, 210 + i * 86));
      ctx.fillStyle = pal.main; ctx.font = `22px ${KAI}`;
      ctx.fillText('山水之礼', 132, 900);
      // 右侧开窗（双线描边）
      rr(ctx, 230, 150, 660, 480, 28); ctx.strokeStyle = pal.deep; ctx.lineWidth = 3.5; ctx.stroke();
      rr(ctx, 244, 164, 632, 452, 20); ctx.strokeStyle = pal.main; ctx.lineWidth = 1.5; ctx.stroke();
      // 窗内插画
      ctx.save();
      rr(ctx, 258, 178, 604, 424, 14); ctx.clip();
      if (item.custom) { ctx.fillStyle = pal.bg; ctx.fillRect(258, 178, 604, 424); }
      drawCover(ctx, await getArtImageSlice(item, sz(604), sz(424)), 258, 178, 604, 424);
      ctx.restore();
      // 窗下名称与小诗
      ctx.fillStyle = pal.deep; ctx.font = `44px ${KAI}`; ctx.textAlign = 'center';
      ctx.fillText(tb2.nameLine, 560, 735);
      ctx.font = `32px ${KAI}`;
      ctx.fillText(lines[0] + '　' + lines[1], 560, 805);
      ctx.fillStyle = pal.main; ctx.font = `22px ${KAI}`;
      ctx.fillText(tb2.subEn, 560, 855);
      // 印章右下角
      ctx.fillStyle = pal.accent; ctx.fillRect(830, 850, 70, 70);
      ctx.fillStyle = '#FFF'; ctx.font = `42px ${KAI}`;
      ctx.fillText(sealChar, 865, 899);
    } else if (tpl === 'minimal') {
      /* 极简大字款：超大风物名主视觉 + 风格色带 + 底部小圆图 */
      ctx.strokeStyle = pal.deep; ctx.lineWidth = 2; ctx.strokeRect(36, 36, 928, 928);
      // 顶部风格色带
      ctx.fillStyle = pal.bg; ctx.fillRect(36, 36, 928, 90);
      ctx.fillStyle = pal.accent; ctx.fillRect(36, 126, 928, 6);
      // 副标
      ctx.textAlign = 'center';
      ctx.fillStyle = pal.main; ctx.font = `26px ${KAI}`;
      ctx.fillText(tb2.sub, 500, 290);
      // 超大核心名（逐字拉开间距）
      const bigSize = core.length <= 2 ? 180 : core.length <= 4 ? 130 : 92;
      ctx.fillStyle = pal.deep; ctx.font = `${bigSize}px ${KAI}`;
      const gap = bigSize * 1.14;
      const totalW = gap * (core.length - 1);
      [...core].forEach((ch, i) => ctx.fillText(ch, 500 - totalW / 2 + i * gap, 300 + bigSize));
      // 英文小副标
      ctx.fillStyle = pal.main; ctx.font = `22px ${KAI}`;
      ctx.fillText(tb2.subEn, 500, 340 + bigSize);
      // 底部小圆图
      const artM = await getArtImage(item, sz(260));
      ctx.save();
      ctx.beginPath(); ctx.arc(500, 770, 120, 0, Math.PI * 2); ctx.clip();
      if (item.custom) { ctx.fillStyle = pal.bg; ctx.fillRect(380, 650, 240, 240); }
      drawCover(ctx, artM, 380, 650, 240, 240);
      ctx.restore();
      ctx.strokeStyle = pal.main; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(500, 770, 120, 0, Math.PI * 2); ctx.stroke();
      // 小诗一行与小印章
      ctx.fillStyle = pal.deep; ctx.font = `26px ${KAI}`;
      ctx.fillText(lines[0], 500, 945);
      ctx.fillStyle = pal.accent; ctx.fillRect(860, 880, 52, 52);
      ctx.fillStyle = '#FFF'; ctx.font = `32px ${KAI}`;
      ctx.fillText(sealChar, 886, 916);
    } else {
      /* 经典圆图款（原有版式） */
      ctx.strokeStyle = pal.deep; ctx.lineWidth = 6; ctx.strokeRect(30, 30, 940, 940);
      ctx.strokeStyle = pal.deep; ctx.lineWidth = 2; ctx.strokeRect(52, 52, 896, 896);
      ctx.textAlign = 'center';
      ctx.fillStyle = pal.deep; ctx.font = `90px ${KAI}`;
      ctx.fillText(tb2.brand, 500, 170);
      ctx.fillStyle = pal.main; ctx.font = `26px ${KAI}`;
      ctx.fillText(tb2.subEn, 500, 220);
      // 圆形插画
      const art = await getArtImage(item, sz(420));
      ctx.save();
      ctx.beginPath(); ctx.arc(500, 480, 215, 0, Math.PI * 2); ctx.clip();
      if (item.custom) { ctx.fillStyle = pal.bg; ctx.fillRect(285, 265, 430, 430); }
      drawCover(ctx, art, 290, 270, 420, 420);
      ctx.restore();
      ctx.strokeStyle = pal.main; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(500, 480, 215, 0, Math.PI * 2); ctx.stroke();
      // 名称与小诗
      ctx.fillStyle = pal.deep; ctx.font = `46px ${KAI}`;
      ctx.fillText(tb2.nameLine, 500, 780);
      ctx.font = `34px ${KAI}`;
      ctx.fillText(lines[0] + '　' + lines[1], 500, 850);
      // 印章
      ctx.fillStyle = pal.accent; ctx.fillRect(790, 800, 84, 84);
      ctx.fillStyle = '#FFF'; ctx.font = `52px ${KAI}`;
      ctx.fillText(item.name.slice(0, 1), 832, 860);
    }
  }

  const a = document.createElement('a');
  a.download = `${wsMode === 'postcard' ? '明信片' : '茶叶礼盒'}_${item.name}_${style.name}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
  toast(`已保存 ${res.w}×${res.h} PNG 到本地`);
}

/* ---------- 四风格对比：一键生成 2×2 对比图 ---------- */
let wsCompareUrl = '';      // 对比图 dataURL
let wsCompareName = '';     // 对比图对应风物名（用于下载文件名）

async function openStyleCompare() {
  if (!wsGenerated) { toast('请先点击「AI魔法生成」，生成后再做四风格对比'); return; }
  const item = getWsItem();
  const KAI = '"KaiTi","STKaiti","楷体",serif';
  const CELL = 596, SEAM = 8, SIZE = CELL * 2 + SEAM, ART = 460, BAR = 56;

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FAF7EF'; ctx.fillRect(0, 0, SIZE, SIZE);   // 纸色底（即四格间的缝色）

  for (let i = 0; i < STYLES.length; i++) {
    const style = STYLES[i], pal = style.pal;
    const cx = (i % 2) * (CELL + SEAM);
    const cy = Math.floor(i / 2) * (CELL + SEAM);
    // 格底：该风格纸底色
    ctx.fillStyle = pal.paper; ctx.fillRect(cx, cy, CELL, CELL);
    // 居中方形插画（cover）
    const ax = cx + (CELL - ART) / 2, ay = cy + (CELL - ART) / 2;
    const art = await getArtImage(item, ART, style.id);
    if (art.custom) { ctx.fillStyle = pal.bg; ctx.fillRect(ax, ay, ART, ART); }
    drawCover(ctx, art, ax, ay, ART, ART);
    ctx.strokeStyle = pal.main; ctx.lineWidth = 2; ctx.strokeRect(ax, ay, ART, ART);
    // 底部风格名标签条（风格名 + AI调色小字）
    const barY = cy + CELL - BAR;
    ctx.fillStyle = pal.bg; ctx.fillRect(cx, barY, CELL, BAR);
    ctx.textAlign = 'center';
    ctx.fillStyle = pal.deep; ctx.font = `26px ${KAI}`;
    ctx.fillText(style.name, cx + CELL / 2, barY + 26);
    ctx.fillStyle = pal.main; ctx.font = `14px ${KAI}`;
    ctx.fillText('AI 调色', cx + CELL / 2, barY + 47);
  }
  // 整体外框
  ctx.strokeStyle = '#33413C'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, SIZE - 4, SIZE - 4);

  wsCompareUrl = canvas.toDataURL('image/png');
  wsCompareName = item.name;
  document.getElementById('compareItemName').textContent = item.name;
  document.getElementById('compareImg').src = wsCompareUrl;
  document.getElementById('compareModal').classList.remove('hidden');
}

function downloadCompare() {
  if (!wsCompareUrl) return;
  const a = document.createElement('a');
  a.download = `四风格对比_${wsCompareName}.png`;
  a.href = wsCompareUrl;
  a.click();
  toast('四风格对比图已保存到本地');
}

function closeCompare() {
  document.getElementById('compareModal').classList.add('hidden');
}
