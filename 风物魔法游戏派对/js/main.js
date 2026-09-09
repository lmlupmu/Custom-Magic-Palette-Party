/* =====================================================
 * main.js  页面路由 · 演示提示浮窗 · Toast
 * ===================================================== */

const PAGE_HINTS = {
  home: '点击「开始创作之旅」进入消除关卡，收集信阳风物线稿；也可直接进入「AI调色工坊」体验创作。',
  game: '玩法：点击两张<strong>相同</strong>的风物卡片即可消除，全部消除通关，解锁对应黑白线稿与乡土科普。',
  workshop: '四步创作：① 左侧选线稿（也可点「＋上传我的风物」传自己的图片并起名）→ ② 挑色调 → ③ 点「AI魔法生成」，AI 会按风物名字赋诗 → ④ 切换预览并下载。生成后还可在预览下方切换版式模板（明信片：经典/横版/手账，礼盒：经典/山水/极简），下载会按当前选中的模板导出 PNG。',
  about: '本页面向大赛评审：项目赛道、背景、功能与 AI 应用说明，页面整洁，可直接截图用于参赛文档。'
};

function goPage(page) {
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
    okBtn.onclick = () => done(field.value.trim().slice(0, 8));
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
    okBtn.onclick = () => done(true);
    cancelBtn.onclick = () => done(false);
  });
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

/* ---------- 初始化 ---------- */
(function init() {
  // 首页漂浮装饰
  const deco1 = getItem('tea'), deco2 = getItem('camellia'), deco3 = getItem('azalea');
  document.getElementById('heroDeco1').innerHTML = sizedSvg(deco1.build(deco1.icon, false), 110, 110);
  document.getElementById('heroDeco2').innerHTML = sizedSvg(deco2.build(deco2.icon, false), 90, 90);
  document.getElementById('heroDeco3').innerHTML = sizedSvg(deco3.build(deco3.icon, false), 100, 100);

  document.getElementById('hintBody').innerHTML = PAGE_HINTS.home;
  renderLevelSelect();
  renderStyles();
  renderGallery();
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === wsMode));
})();
