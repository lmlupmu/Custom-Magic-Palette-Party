/* =====================================================
 * game.js  消除小游戏：点击两张相同卡片消除
 * 8 个关卡 · 误点计数 · 三星评级
 * ===================================================== */

const LEVEL_NUMERALS = ['壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌'];

let gameLevel = 0;
let boardCards = [];      // {itemId, el, matched}
let selectedCard = null;
let matchedPairs = 0;
let totalPairs = 0;
let mistakes = 0;         // 误点（配对失败）次数

/* ---------- 选关界面 ---------- */
function renderLevelSelect() {
  const wrap = document.getElementById('levelSelect');
  const done = getLevelsDone();
  const stars = getStars();
  wrap.innerHTML = LEVELS.map((lv, i) => {
    const locked = i > 0 && !done.includes(i - 1);
    const passed = done.includes(i);
    const unlockNames = lv.unlock.map(id => getItem(id).name).join('、');
    const starHtml = passed
      ? `<div class="level-stars">${[1, 2, 3].map(n => `<i class="${n <= (stars[i] || 0) ? 'on' : ''}">★</i>`).join('')}</div>`
      : '';
    return `
    <div class="level-card ${locked ? 'locked' : ''}" onclick="${locked ? '' : `startLevel(${i})`}">
      <div class="level-badge">${passed ? '已通关' : (locked ? '未解锁' : '挑战')}</div>
      <div class="level-num">${LEVEL_NUMERALS[i]}</div>
      <h3>${lv.name}</h3>
      ${starHtml}
      <p>${lv.tip}</p>
      <p class="level-unlock">通关解锁线稿：${unlockNames}</p>
    </div>`;
  }).join('');
}

/* ---------- 开局 ---------- */
function startLevel(idx) {
  gameLevel = idx;
  const lv = LEVELS[idx];
  totalPairs = lv.pairs;
  matchedPairs = 0;
  mistakes = 0;
  selectedCard = null;

  // 组牌：从全部风物中轮换选取，每关牌面组合不同，凑够对数，每张两张
  const offset = (idx * 3) % ITEMS.length;
  const deck = [];
  for (let i = 0; i < lv.pairs; i++) {
    const item = ITEMS[(offset + i) % ITEMS.length];
    deck.push(item.id, item.id);
  }
  shuffle(deck);

  document.getElementById('levelSelect').classList.add('hidden');
  document.getElementById('gameBoard').classList.remove('hidden');
  document.getElementById('gameLevelName').textContent = lv.name;
  document.getElementById('gameMatched').textContent = '0';
  document.getElementById('gameTotal').textContent = String(lv.pairs);
  document.getElementById('gameMistakes').textContent = '0';

  const board = document.getElementById('board');
  board.style.gridTemplateColumns = `repeat(${lv.cols}, 1fr)`;
  board.innerHTML = '';
  boardCards = deck.map((id, i) => {
    const item = getItem(id);
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `<div class="card-inner">${sizedSvg(item.build(item.icon, false), 120, 120)}</div><span class="card-name">${item.name}</span>`;
    el.dataset.idx = i;
    el.addEventListener('click', () => onCardClick(card));
    board.appendChild(el);
    const card = { itemId: id, el, matched: false };
    return card;
  });
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/* ---------- 点击消除 ---------- */
function onCardClick(card) {
  if (card.matched) return;
  if (selectedCard === card) {           // 再次点击取消选中
    card.el.classList.remove('selected');
    selectedCard = null;
    return;
  }
  if (!selectedCard) {
    selectedCard = card;
    card.el.classList.add('selected');
    SoundFX.flip();
    return;
  }
  const first = selectedCard;
  first.el.classList.remove('selected');
  selectedCard = null;
  SoundFX.flip();

  if (first.itemId === card.itemId) {    // 配对成功
    first.matched = card.matched = true;
    first.el.classList.add('matched');
    card.el.classList.add('matched');
    matchedPairs++;
    document.getElementById('gameMatched').textContent = String(matchedPairs);
    SoundFX.match();
    if (matchedPairs === totalPairs) setTimeout(showWin, 500);
  } else {                                // 配对失败，误点+1，轻摇提示
    mistakes++;
    SoundFX.miss();
    document.getElementById('gameMistakes').textContent = String(mistakes);
    first.el.classList.add('shake');
    card.el.classList.add('shake');
    setTimeout(() => { first.el.classList.remove('shake'); card.el.classList.remove('shake'); }, 420);
  }
}

function backToLevels() {
  document.getElementById('gameBoard').classList.add('hidden');
  document.getElementById('levelSelect').classList.remove('hidden');
  renderLevelSelect();
}

/* ---------- 通关弹窗（含星级评定） ---------- */
function calcStars() {
  if (mistakes <= Math.max(1, Math.floor(totalPairs * 0.25))) return 3;
  if (mistakes <= Math.ceil(totalPairs * 0.75)) return 2;
  return 1;
}

function showWin() {
  const lv = LEVELS[gameLevel];
  markLevelDone(gameLevel);
  unlockItems(lv.unlock);
  const stars = calcStars();
  saveStars(gameLevel, stars);

  document.getElementById('winTitle').textContent = `恭喜通关「${lv.name}」！`;
  document.getElementById('winStars').innerHTML =
    [1, 2, 3].map(n => `<i class="${n <= stars ? 'on' : ''}">★</i>`).join('') +
    `<span class="win-mistakes">误点 ${mistakes} 次</span>`;
  document.getElementById('winUnlocks').innerHTML = lv.unlock.map(id => {
    const item = getItem(id);
    return `
      <div class="unlock-art">
        <div class="unlock-svg">${sizedSvg(item.build(LINE_PAL, true), 140, 140)}</div>
        <p>解锁线稿 · ${item.name}</p>
      </div>`;
  }).join('');
  const feature = getItem(lv.unlock[0]);
  document.getElementById('winScienceText').textContent = feature.science;
  document.getElementById('winNextBtn').style.display = gameLevel < LEVELS.length - 1 ? '' : 'none';
  document.getElementById('winModal').classList.remove('hidden');
  SoundFX.clear();
  SoundFX.unlock();
}

function winNext() {
  closeWin();
  startLevel(Math.min(gameLevel + 1, LEVELS.length - 1));
}
function closeWinAndGo(page) {
  closeWin();
  goPage(page);
}
function closeWin() {
  document.getElementById('winModal').classList.add('hidden');
  backToLevels();
}
