/* =====================================================
 * main.js  页面路由 · 演示提示浮窗 · Toast
 * ===================================================== */

const PAGE_HINTS = {
  home: '点击「开始创作之旅」进入消除关卡，收集信阳风物线稿；也可直接进入「AI调色工坊」体验创作。点右上角 🔊 按钮可随时开关音效。',
  game: '玩法：点击两张<strong>相同</strong>的风物卡片即可消除，全部消除通关，解锁对应黑白线稿与乡土科普。',
  workshop: '四步创作：① 左侧选线稿（也可点「＋上传我的风物」传自己的图片并起名）→ ② 挑色调 → ③ 点「AI魔法生成」，AI 会按风物名字赋诗 → ④ 切换预览并下载。生成后还可在预览下方切换版式模板（明信片：经典/横版/手账，礼盒：经典/山水/极简），下载会按当前选中的模板导出 PNG；分辨率 chip 可选三档（标准/高清/超清，明信片最高 3600×2280、礼盒最高 3000×3000，选择刷新保持）；点「四风格对比」可把同一风物的四套色调效果拼成 2×2 对比图一键下载。',
  about: '本页面向大赛评审：项目赛道、背景、功能与 AI 应用说明，页面整洁，可直接截图用于参赛文档。页面底部有「演示工具」：可一键解锁全部关卡与线稿，或重置全部本地存档恢复初始状态。'
};

function goPage(page) {
  SoundFX.click();
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  document.getElementById('hintBody').innerHTML = PAGE_HINTS[page];
  window.scrollTo({ top: 0 });

  if (page === 'game') { backToLevels(); }
  if (page === 'workshop') { renderGallery(); }
}

/* ---------- 提示浮窗 ---------- */
function toggleHint() {
  const body = document.getElementById('hintBody');
  const icon = document.getElementById('hintToggleIcon');
  const hidden = body.classList.toggle('hidden');
  icon.textContent = hidden ? '＋' : '—';
}

/* ---------- 通用弹窗（替代 prompt / confirm，兼容禁用原生弹窗的环境） ---------- */
function showNameDialog(title, tip, def) {
  return new Promise(resolve => {
    const modal = document.getElementById('inputModal');
    const field = document.getElementById('inputModalField');
    document.getElementById('inputModalTitle').textContent = title;
    document.getElementById('inputModalTip').textContent = tip;
    field.value = def || '';
    modal.classList.remove('hidden');
    setTimeout(() => { field.focus(); field.select(); }, 50);

    const done = val => {
      modal.classList.add('hidden');
      okBtn.onclick = cancelBtn.onclick = field.onkeydown = null;
      resolve(val);
    };
    const okBtn = document.getElementById('inputModalOk');
    const cancelBtn = document.getElementById('inputModalCancel');
    okBtn.onclick = () => { SoundFX.click(); done(field.value.trim().slice(0, 8)); };
    cancelBtn.onclick = () => done(null);
    field.onkeydown = e => {
      if (e.key === 'Enter') done(field.value.trim().slice(0, 8));
      if (e.key === 'Escape') done(null);
    };
  });
}

function showConfirmDialog(text) {
  return new Promise(resolve => {
    const modal = document.getElementById('confirmModal');
    document.getElementById('confirmModalText').textContent = text;
    modal.classList.remove('hidden');
    const done = val => {
      modal.classList.add('hidden');
      okBtn.onclick = cancelBtn.onclick = null;
      resolve(val);
    };
    const okBtn = document.getElementById('confirmModalOk');
    const cancelBtn = document.getElementById('confirmModalCancel');
    okBtn.onclick = () => { SoundFX.click(); done(true); };
    cancelBtn.onclick = () => done(false);
  });
}

/* ---------- 音效开关 ---------- */
function updateSoundBtn() {
  const on = SoundFX.enabled;
  document.getElementById('soundIconOn').style.display = on ? '' : 'none';
  document.getElementById('soundIconOff').style.display = on ? 'none' : '';
  document.getElementById('soundBtn').classList.toggle('off', !on);
}

function toggleSound() {
  const on = SoundFX.toggle();
  updateSoundBtn();
  toast(on ? '音效已开启' : '音效已关闭');
}

/* ---------- Toast ---------- */
let toastTimer = null;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.classList.add('hidden'), 300);
  }, 2200);
}

/* ---------- 演示模式 / 重置存档 ---------- */
/* 一键解锁全部风物线稿与关卡；仅尚未全解锁时才写入。fromParam=true 表示 URL 参数触发（已全解锁时不打扰） */
function enableDemoMode(fromParam) {
  const allIds = ITEMS.map(i => i.id);
  const allLv = LEVELS.map((_, i) => i);
  const full = allIds.every(id => getUnlocked().includes(id)) && allLv.every(i => getLevelsDone().includes(i));
  if (full) {
    if (!fromParam) toast('已是全部解锁状态，可直接体验完整内容');
    return;
  }
  localStorage.setItem('wm_unlocked', JSON.stringify(allIds));
  localStorage.setItem('wm_levels', JSON.stringify(allLv));
  renderLevelSelect();
  renderGallery();
  toast('演示模式：全部关卡与线稿已解锁');
}

async function resetAllSaves() {
  if (!(await showConfirmDialog('确定重置全部存档吗？将清除线稿解锁、关卡进度、星级记录与已上传的自定义风物，恢复到初始状态。'))) return;
  ['wm_unlocked', 'wm_levels', 'wm_stars', 'wm_custom'].forEach(k => localStorage.removeItem(k));
  toast('存档已重置，即将刷新页面');
  setTimeout(() => { location.href = location.pathname; }, 700);
}

/* ---------- PWA：注册 Service Worker（仅 http/https 环境，file:// 跳过） ---------- */
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* 离线支持不可用时静默 */ });
  });
}

/* ---------- 初始化 ---------- */
(function init() {
  // 演示模式：URL 带 ?demo=1 时一键全解锁（仅首次写入）
  if (new URLSearchParams(location.search).get('demo') === '1') enableDemoMode(true);

  // 首页漂浮装饰
  const deco1 = getItem('tea'), deco2 = getItem('camellia'), deco3 = getItem('azalea');
  document.getElementById('heroDeco1').innerHTML = sizedSvg(deco1.build(deco1.icon, false), 110, 110);
  document.getElementById('heroDeco2').innerHTML = sizedSvg(deco2.build(deco2.icon, false), 90, 90);
  document.getElementById('heroDeco3').innerHTML = sizedSvg(deco3.build(deco3.icon, false), 100, 100);

  document.getElementById('hintBody').innerHTML = PAGE_HINTS.home;
  updateSoundBtn();
  renderLevelSelect();
  renderStyles();
  renderGallery();
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === wsMode));
})();
