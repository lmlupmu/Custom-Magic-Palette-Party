/* =====================================================
 * data.js  风物数据 · 艺术配色 · AI小诗库 · 关卡配置
 * ===================================================== */

const STROKE = '#33413c';

/* ---------- 四套艺术色调 ---------- */
const STYLES = [
  {
    id: 'spring', name: '春日青绿', desc: '新绿初醒 · 春意盎然',
    pal: { main: '#5FA96F', sub: '#8FCB9B', deep: '#3E7D54', accent: '#F2C94C', bg: '#EAF6EC', paper: '#FDFBF3' }
  },
  {
    id: 'autumn', name: '秋意赭黄', desc: '层林尽染 · 丰收暖调',
    pal: { main: '#C9803B', sub: '#E0A75E', deep: '#8C4F21', accent: '#A63D2A', bg: '#F7ECD8', paper: '#FBF4E4' }
  },
  {
    id: 'guochao', name: '国潮艳彩', desc: '浓墨重彩 · 年轻国潮',
    pal: { main: '#E63946', sub: '#F4A261', deep: '#1D3557', accent: '#2A9D8F', bg: '#FFF3E2', paper: '#FFFBF2' }
  },
  {
    id: 'ink', name: '淡雅水墨', desc: '留白写意 · 东方禅意',
    pal: { main: '#6B7B75', sub: '#9AA8A2', deep: '#3E4E48', accent: '#A63D2A', bg: '#F2F0EA', paper: '#F8F6F0' }
  }
];

/* 线稿模式：全部留白，仅墨线 */
const LINE_PAL = { main: '#FFFFFF', sub: '#FFFFFF', deep: '#FFFFFF', accent: '#FFFFFF', bg: '#FDFDFB' };

/* ---------- SVG 小工具 ---------- */
function spikyRing(cx, cy, rOut, rIn, n, fill) {
  let pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = Math.PI * i / n - Math.PI / 2;
    const r = i % 2 === 0 ? rOut : rIn;
    pts.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1));
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}"/>`;
}
function petal(cx, cy, rx, ry, angle, fill) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" transform="rotate(${angle} ${cx} ${cy})"/>`;
}
function svgWrap(inner, deco, pal) {
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">` +
    (deco ? `<circle cx="100" cy="100" r="90" fill="${pal.bg}"/>` : '') +
    `<g stroke="${STROKE}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${inner}</g></svg>`;
}

/* ---------- 六种风物线稿/上色绘制 ---------- */
function teaArt(pal, deco = true) {
  const inner =
    `<path d="M100 156 C100 116 100 84 100 46" fill="none"/>` +
    `<path d="M100 124 C 80 119 62 104 60 82 C 82 86 98 100 100 116 Z" fill="${pal.sub}"/>` +
    `<path d="M100 124 C 120 119 138 104 140 82 C 118 86 102 100 100 116 Z" fill="${pal.main}"/>` +
    `<path d="M100 92 C 86 84 78 70 80 54 C 94 60 100 74 100 86 Z" fill="${pal.deep}"/>` +
    `<path d="M100 92 C 114 84 122 70 120 54 C 106 60 100 74 100 86 Z" fill="${pal.sub}"/>` +
    `<path d="M100 48 C 94 42 94 32 100 26 C 106 32 106 42 100 48 Z" fill="${pal.accent}"/>` +
    `<path d="M84 156 C 84 146 116 146 116 156" fill="none"/>`;
  return svgWrap(inner, deco, pal);
}

function camelliaArt(pal, deco = true) {
  let petals = '';
  const cx = 100, cy = 92;
  for (let i = 0; i < 5; i++) {
    const a = i * 72 - 90;
    const rad = a * Math.PI / 180;
    const px = cx + 30 * Math.cos(rad), py = cy + 30 * Math.sin(rad);
    petals += petal(px.toFixed(1), py.toFixed(1), 22, 30, a + 90, i % 2 ? pal.main : pal.sub);
  }
  const inner =
    `<path d="M100 150 C 96 138 96 130 100 118" fill="none"/>` +
    `<path d="M96 146 C 76 150 60 142 54 126 C 74 126 90 132 96 140 Z" fill="${pal.deep}"/>` +
    `<path d="M102 148 C 122 152 140 144 146 128 C 126 128 108 134 102 142 Z" fill="${pal.main}"/>` +
    petals +
    `<circle cx="100" cy="92" r="13" fill="${pal.accent}"/>` +
    `<circle cx="100" cy="92" r="5" fill="${pal.deep}"/>`;
  return svgWrap(inner, deco, pal);
}

function chestnutArt(pal, deco = true) {
  const inner =
    spikyRing(100, 102, 74, 58, 16, pal.sub) +
    `<path d="M64 118 C 60 76 84 54 100 54 C 116 54 140 76 136 118 C 132 146 116 156 100 156 C 84 156 68 146 64 118 Z" fill="${pal.main}"/>` +
    `<path d="M100 54 C 116 54 140 76 136 118 C 118 108 84 108 64 118 C 60 76 84 54 100 54 Z" fill="${pal.deep}"/>` +
    `<ellipse cx="86" cy="130" rx="12" ry="7" fill="${pal.accent}" transform="rotate(-18 86 130)"/>` +
    `<path d="M100 54 C 98 48 100 42 104 38" fill="none"/>`;
  return svgWrap(inner, deco, pal);
}

function tinArt(pal, deco = true) {
  const inner =
    `<rect x="62" y="66" width="76" height="92" rx="10" fill="${pal.main}"/>` +
    `<rect x="58" y="50" width="84" height="20" rx="9" fill="${pal.deep}"/>` +
    `<rect x="88" y="38" width="24" height="14" rx="6" fill="${pal.deep}"/>` +
    `<rect x="74" y="84" width="52" height="56" rx="6" fill="${pal.bg}"/>` +
    `<rect x="74" y="84" width="52" height="56" rx="6" fill="none"/>` +
    `<text x="100" y="124" font-size="34" text-anchor="middle" fill="${pal.accent}" stroke="none" font-family="KaiTi,STKaiti,serif">茶</text>` +
    `<path d="M70 158 C 84 166 116 166 130 158" fill="none"/>`;
  return svgWrap(inner, deco, pal);
}

function wheatArt(pal, deco = true) {
  let grains = '';
  for (let i = 0; i < 5; i++) {
    const y = 52 + i * 20;
    grains += petal(88, y, 10, 16, -28, i % 2 ? pal.main : pal.sub);
    grains += petal(112, y, 10, 16, 28, i % 2 ? pal.sub : pal.main);
  }
  const inner =
    `<path d="M100 168 C 100 130 100 92 100 44" fill="none"/>` +
    grains +
    petal(100, 40, 10, 17, 0, pal.accent) +
    `<path d="M100 150 C 82 154 70 148 64 136" fill="none"/>` +
    `<path d="M100 150 C 118 154 130 148 136 136" fill="none"/>` +
    `<path d="M100 168 C 100 176 96 180 90 182 M100 168 C 100 176 104 180 110 182" fill="none"/>`;
  return svgWrap(inner, deco, pal);
}

function azaleaArt(pal, deco = true) {
  let petals = '';
  const cx = 100, cy = 92;
  for (let i = 0; i < 5; i++) {
    const a = i * 72 - 90;
    const rad = a * Math.PI / 180;
    const px = cx + 28 * Math.cos(rad), py = cy + 28 * Math.sin(rad);
    petals += petal(px.toFixed(1), py.toFixed(1), 18, 32, a + 90, i % 2 ? pal.main : pal.sub);
  }
  let stamens = '';
  for (let i = 0; i < 3; i++) {
    const a = (-50 + i * 40) * Math.PI / 180;
    const ex = 100 + 26 * Math.cos(a), ey = 92 + 26 * Math.sin(a);
    stamens += `<line x1="100" y1="92" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke-width="2"/>` +
      `<circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="3.5" fill="${pal.accent}"/>`;
  }
  const inner =
    `<path d="M100 152 C 98 140 98 130 100 118" fill="none"/>` +
    `<path d="M98 148 C 78 154 62 148 54 134 C 74 132 90 138 98 142 Z" fill="${pal.deep}"/>` +
    petals +
    `<circle cx="100" cy="92" r="8" fill="${pal.accent}"/>` +
    stamens;
  return svgWrap(inner, deco, pal);
}

function fishArt(pal, deco = true) {
  const inner =
    `<path d="M52 100 C 72 74 112 70 134 96 C 142 90 152 82 162 76 C 158 90 158 110 162 124 C 152 118 142 110 134 104 C 112 130 72 126 52 100 Z" fill="${pal.main}"/>` +
    `<path d="M134 96 C 142 90 152 82 162 76 C 158 90 158 110 162 124 C 152 118 142 110 134 104 Z" fill="${pal.sub}"/>` +
    `<path d="M96 82 C 104 70 118 68 124 74 C 116 82 104 86 96 82 Z" fill="${pal.sub}"/>` +
    `<path d="M96 116 C 104 124 116 124 122 118 C 114 112 104 112 96 116 Z" fill="${pal.sub}"/>` +
    `<circle cx="72" cy="94" r="4.5" fill="${STROKE}"/>` +
    `<path d="M84 86 C 80 96 80 104 84 114" fill="none"/>` +
    `<path d="M40 140 C 60 132 80 148 100 140 C 120 132 140 148 160 140" fill="none" stroke="${pal.accent}"/>` +
    `<circle cx="46" cy="68" r="5" fill="none"/><circle cx="38" cy="54" r="3.5" fill="none"/>`;
  return svgWrap(inner, deco, pal);
}

function persimmonArt(pal, deco = true) {
  const inner =
    `<path d="M100 62 C 134 62 152 86 152 110 C 152 140 128 158 100 158 C 72 158 48 140 48 110 C 48 86 66 62 100 62 Z" fill="${pal.main}"/>` +
    `<path d="M100 62 C 96 88 96 130 100 158 M62 78 C 76 92 76 130 66 146 M138 78 C 124 92 124 130 134 146" fill="none" stroke-width="2"/>` +
    `<path d="M100 62 L 80 52 L 90 42 L 100 50 L 110 42 L 120 52 Z" fill="${pal.deep}"/>` +
    `<path d="M100 50 C 100 42 102 36 106 32" fill="none"/>` +
    `<path d="M108 42 C 122 32 138 34 144 44 C 134 54 118 52 108 42 Z" fill="${pal.deep}"/>` +
    `<ellipse cx="78" cy="96" rx="10" ry="16" fill="${pal.sub}" transform="rotate(-14 78 96)"/>`;
  return svgWrap(inner, deco, pal);
}

function lotusArt(pal, deco = true) {
  const inner =
    petal(100, 72, 16, 32, 0, pal.main) +
    petal(76, 84, 15, 29, -28, pal.sub) +
    petal(124, 84, 15, 29, 28, pal.sub) +
    petal(60, 102, 14, 26, -52, pal.main) +
    petal(140, 102, 14, 26, 52, pal.main) +
    `<path d="M86 108 C 88 126 112 126 114 108 C 112 100 88 100 86 108 Z" fill="${pal.accent}"/>` +
    `<circle cx="94" cy="110" r="2" fill="${STROKE}" stroke="none"/><circle cx="100" cy="114" r="2" fill="${STROKE}" stroke="none"/><circle cx="106" cy="110" r="2" fill="${STROKE}" stroke="none"/>` +
    `<path d="M100 124 C 100 138 100 150 100 162" fill="none"/>` +
    `<path d="M52 152 C 60 132 92 130 104 144 C 96 162 64 166 52 152 Z" fill="${pal.deep}"/>`;
  return svgWrap(inner, deco, pal);
}

function ginkgoArt(pal, deco = true) {
  const inner =
    `<path d="M100 98 C 60 98 44 68 52 42 C 76 52 92 64 98 80 L 100 86 L 102 80 C 108 64 124 52 148 42 C 156 68 140 98 100 98 Z" fill="${pal.main}"/>` +
    `<path d="M100 96 L 68 58 M100 96 L 86 50 M100 96 L 114 50 M100 96 L 132 58" fill="none" stroke-width="2"/>` +
    `<path d="M100 98 L 100 158" fill="none" stroke="${pal.deep}"/>` +
    `<path d="M100 158 C 98 166 96 172 92 178 M100 158 C 102 166 104 172 108 178" fill="none" stroke="${pal.deep}"/>` +
    `<path d="M56 150 C 62 138 78 134 86 140 C 80 152 64 156 56 150 Z" fill="${pal.sub}"/>` +
    `<ellipse cx="128" cy="86" rx="9" ry="14" fill="${pal.sub}" transform="rotate(24 128 86)"/>`;
  return svgWrap(inner, deco, pal);
}

function mushroomArt(pal, deco = true) {
  const inner =
    `<path d="M88 98 L 84 148 C 84 160 116 160 116 148 L 112 98 Z" fill="${pal.sub}"/>` +
    `<path d="M44 100 C 44 62 72 42 100 42 C 128 42 156 62 156 100 C 156 108 148 110 140 106 C 132 112 124 108 120 104 C 112 110 106 108 100 104 C 94 108 88 110 80 104 C 76 108 68 112 60 106 C 52 110 44 108 44 100 Z" fill="${pal.main}"/>` +
    `<circle cx="76" cy="70" r="5" fill="${pal.accent}"/><circle cx="104" cy="58" r="4" fill="${pal.accent}"/><circle cx="128" cy="76" r="5" fill="${pal.accent}"/>` +
    `<path d="M58 168 C 80 160 120 160 142 168" fill="none" stroke="${pal.deep}"/>`;
  return svgWrap(inner, deco, pal);
}

function shootArt(pal, deco = true) {
  const inner =
    `<path d="M100 30 C 84 44 72 66 68 96 C 64 128 76 152 100 160 C 124 152 136 128 132 96 C 128 66 116 44 100 30 Z" fill="${pal.main}"/>` +
    `<path d="M84 66 C 92 74 108 74 116 66" fill="none"/>` +
    `<path d="M76 96 C 88 106 112 106 124 96" fill="none"/>` +
    `<path d="M74 124 C 88 134 112 134 126 124" fill="none"/>` +
    `<path d="M100 30 C 98 24 100 18 104 14" fill="none"/>` +
    `<path d="M60 158 C 68 146 84 142 92 148 C 86 160 70 164 60 158 Z" fill="${pal.accent}"/>` +
    `<path d="M140 158 C 132 146 116 142 108 148 C 114 160 130 164 140 158 Z" fill="${pal.deep}"/>` +
    `<ellipse cx="92" cy="116" rx="7" ry="14" fill="${pal.sub}" transform="rotate(-8 92 116)"/>`;
  return svgWrap(inner, deco, pal);
}

/* ---------- 风物档案（含信阳乡土科普） ---------- */
const ITEMS = [
  {
    id: 'tea', name: '茶叶', alias: '信阳毛尖', build: teaArt,
    icon: { main: '#4E9A5F', sub: '#7DBB84', deep: '#35784A', accent: '#F2C94C', bg: '#EAF6EC' },
    science: '信阳毛尖是中国十大名茶之一，产自大别山区，以“细、圆、光、直、多白毫”著称，汤色嫩绿明亮，1915 年曾在巴拿马万国博览会荣获金奖。'
  },
  {
    id: 'camellia', name: '山茶花', alias: '大别山茶花', build: camelliaArt,
    icon: { main: '#E26D7E', sub: '#F19AA6', deep: '#4E9A5F', accent: '#F2C94C', bg: '#FDEEF0' },
    science: '山茶花是信阳大别山区常见花木，冬春开花、花期持久。它耐寒坚韧，凌寒独自开，象征着信阳人朴实顽强的品格。'
  },
  {
    id: 'chestnut', name: '板栗', alias: '大别山板栗', build: chestnutArt,
    icon: { main: '#9C5B2E', sub: '#C98B4B', deep: '#6E3D1C', accent: '#F2D49B', bg: '#F7ECD8' },
    science: '信阳板栗种植历史悠久，大别山板栗颗粒饱满、香甜软糯，是国家地理标志产品，秋冬时节糖炒栗子的甜香飘满信阳街头。'
  },
  {
    id: 'tin', name: '茶罐', alias: '储茶锡罐', build: tinArt,
    icon: { main: '#D64B3C', sub: '#EAF6EC', deep: '#8C2F24', accent: '#2A9D8F', bg: '#FDEEE2' },
    science: '信阳人善于储茶，传统锡罐、陶罐密封存茶，能长久锁住毛尖的鲜爽。小小一罐茶，藏着大别山一整季的云雾春光。'
  },
  {
    id: 'wheat', name: '麦穗', alias: '淮上麦浪', build: wheatArt,
    icon: { main: '#E0A93E', sub: '#F0C96E', deep: '#B07E1E', accent: '#F6E3A1', bg: '#FBF2DC' },
    science: '信阳地处南北气候过渡带，稻麦兼作。初夏时节淮河两岸麦浪滚滚，豫南大地一片金黄，是丰收最动人的颜色。'
  },
  {
    id: 'azalea', name: '杜鹃花', alias: '映山红', build: azaleaArt,
    icon: { main: '#E2506A', sub: '#F38B9D', deep: '#4E9A5F', accent: '#F2C94C', bg: '#FDEEF1' },
    science: '大别山杜鹃花又名映山红，春日漫山遍野、花开如霞。它也是红色信阳的象征，见证了大别山革命老区的峥嵘岁月。'
  },
  {
    id: 'fish', name: '南湾鱼', alias: '南湾湖鲜', build: fishArt,
    icon: { main: '#6BA3C6', sub: '#9CC4DC', deep: '#3E7296', accent: '#F2C94C', bg: '#E8F2F8' },
    science: '南湾湖被誉为"中原明珠"，湖水清澈，盛产南湾鱼。南湾鱼肉质细嫩、鱼汤奶白，鱼头炖汤是信阳家喻户晓的招牌菜。'
  },
  {
    id: 'persimmon', name: '甜柿', alias: '罗山甜柿', build: persimmonArt,
    icon: { main: '#E8833A', sub: '#F5B87F', deep: '#4E9A5F', accent: '#F6D66B', bg: '#FDEEE0' },
    science: '罗山甜柿是信阳特产，自然脱涩、脆甜可口，摘下即可鲜食。金秋时节，大别山区柿子挂满枝头，像一盏盏红灯笼。'
  },
  {
    id: 'lotus', name: '荷花', alias: '豫南清荷', build: lotusArt,
    icon: { main: '#E88CA0', sub: '#F4B8C6', deep: '#4E9A5F', accent: '#F2D49B', bg: '#FDEEF2' },
    science: '信阳河湖众多，有"北国江南"之称，夏日荷塘处处。荷花出淤泥而不染，莲子、莲藕都是信阳人餐桌上的时令美味。'
  },
  {
    id: 'ginkgo', name: '银杏', alias: '大别山古银杏', build: ginkgoArt,
    icon: { main: '#E8C23E', sub: '#F0D675', deep: '#8C6E12', accent: '#4E9A5F', bg: '#FBF4DC' },
    science: '信阳大别山区古银杏众多，深秋满树金黄、落叶铺金。银杏叶形如小扇，白果还能入药入膳，是山乡的"活化石"。'
  },
  {
    id: 'mushroom', name: '香菇', alias: '大别山山珍', build: mushroomArt,
    icon: { main: '#A87B4F', sub: '#C9A172', deep: '#7A5230', accent: '#F2E3C9', bg: '#F5EEE2' },
    science: '大别山林木葱郁，是香菇的天然产地。信阳香菇肉厚香浓，被誉为"山珍"，如今更是山乡农家增收致富的宝贝。'
  },
  {
    id: 'shoot', name: '春笋', alias: '竹海春笋', build: shootArt,
    icon: { main: '#9B7B4E', sub: '#C4A26E', deep: '#6E5B34', accent: '#7FBF7F', bg: '#F2EFE4' },
    science: '大别山竹海连绵，春雷一响，春笋破土而出。春笋鲜嫩爽脆，信阳人最爱用它炖肉、炒腊肉，一口尝到山林的春天。'
  }
];

/* ---------- AI 国风小诗库（风物 × 风格） ---------- */
const POEMS = {
  tea: {
    spring: '雨前新芽披翠露\n云山深处采春忙\n一盏清甘浮碧影\n毛尖香里信阳长',
    autumn: '秋焙新茶火未凉\n赭霞映盏味尤长\n山窗独坐听松雨\n一盏回甘念故乡',
    guochao: '翠色新芽着锦裳\n国潮一盏韵飞扬\n青春焙出山川气\n香透信阳日月光',
    ink: '淡墨云山藏翠叶\n清泉石上煮烟霞\n浮沉一盏知真味\n留白人生是故茶'
  },
  camellia: {
    spring: '山茶破蕾笑春风\n翠叶扶疏一点红\n大别山中春意早\n花开不畏晓寒浓',
    autumn: '霜染层林秋意重\n山茶犹自吐芳红\n不随落叶随风去\n独立疏篱画角中',
    guochao: '红妆艳艳斗春华\n翠袖翻飞映晚霞\n国色新妆潮涌处\n山茶开遍信阳花',
    ink: '墨叶疏疏衬雪腮\n淡妆原不染尘埃\n山间自有真颜色\n一点丹心入画来'
  },
  chestnut: {
    spring: '刺壳深藏春日梦\n新芽破土绿初匀\n山家最懂林间味\n留得甘甜待故人',
    autumn: '秋风摇落刺球黄\n栗熟深山满径香\n柴火慢煨甜似蜜\n丰收滋味暖心房',
    guochao: '金甲披身藏玉心\n甜香四溢值千金\n信阳板栗名声远\n潮出山乡万国临',
    ink: '刺猬团团卧墨林\n坚心一颗抵黄金\n山居岁月知甘苦\n淡写秋光落素襟'
  },
  tin: {
    spring: '锡罐封存一季春\n开时犹带雾云新\n青山绿水藏不住\n满室生香是故人',
    autumn: '秋收春藏岁月深\n一罐清茶一罐金\n启盖忽闻山气润\n秋光也作碧波吟',
    guochao: '红罐金纹映日新\n茶山春色入瓷珍\n国潮好物传千里\n一片叶香动四邻',
    ink: '素罐无言贮月华\n墨香茶韵两相加\n人间至味清欢里\n半亩心田半盏茶'
  },
  wheat: {
    spring: '麦苗青青覆陇长\n春风过处绿波浪\n大别山下农歌起\n盼得秋来满廪香',
    autumn: '金浪翻风麦熟时\n镰声唱彻夕阳迟\n谁知盘中香甜味\n尽是山乡汗水滋',
    guochao: '金穗垂垂映日红\n丰收锣鼓震晴空\n农耕文明新潮起\n麦浪翻腾国风中',
    ink: '淡墨轻描穗影斜\n山田无际接云涯\n低头不是无傲骨\n粒粒饱满自谦华'
  },
  azalea: {
    spring: '映山红透岭头霞\n疑是春姑织锦纱\n大别山中花似海\n杜鹃声里访仙家',
    autumn: '春红已化秋山土\n犹记当年映日红\n莫道花魂归去早\n来年依旧笑东风',
    guochao: '红遍山原势正豪\n映天霞彩作征袍\n英雄花伴英雄城\n红色基因涌新潮',
    ink: '浅绛轻匀岭上霞\n墨枝疏落见芳华\n春山不忍花零落\n留取丹青记岁华'
  },
  fish: {
    spring: '南湾春水碧于天\n浪里银鳞跃画船\n一网湖光收不住\n鲜香味里话丰年',
    autumn: '秋水长天雁字回\n南湾鱼美正堪煨\n一壶老酒邀明月\n满舱星辉载梦归',
    guochao: '碧波万顷跃金龙\n南湾鲜味正当红\n一尾游出国潮味\n香飘四海誉豫风',
    ink: '淡墨一泓湖水阔\n游鱼三两戏清波\n人间至味何须觅\n只在南湾烟雨蓑'
  },
  persimmon: {
    spring: '柿叶初萌翠玉圆\n春风细细护花眠\n莫言秋实遥遥待\n已把甜心酿日边',
    autumn: '霜降山林柿叶丹\n红灯万盏挂枝端\n罗山甜柿凝秋露\n一口脆甜忘岁寒',
    guochao: '万点朱红照眼明\n灯笼高挂庆丰登\n罗山柿子甜如蜜\n潮味出山路万程',
    ink: '疏枝淡墨点朱砂\n一盏红灯映晚霞\n不争春色争秋色\n甜到山乡百姓家'
  },
  lotus: {
    spring: '小荷尖角立蜻蜓\n春水初生绿满汀\n豫南风暖花信早\n一湖清气入诗屏',
    autumn: '留得残荷听雨声\n秋塘月色两分明\n莲心虽苦藏清味\n藕断丝连乡土情',
    guochao: '映日荷花别样红\n田田翠盖舞东风\n清香国色新腔调\n开遍江南北国中',
    ink: '水墨池塘烟雨中\n一茎清荷立晚风\n出泥不染真君子\n淡香留在画图中'
  },
  ginkgo: {
    spring: '古木逢春发嫩芽\n扇叶初舒翠羽纱\n千年守望山村静\n岁月深处有人家',
    autumn: '深秋满树黄金甲\n落叶铺成锦绣阶\n大别山中寻古韵\n一树金黄醉晚霞',
    guochao: '金扇摇风舞碧空\n千年古树正当红\n时光酿成潮颜色\n点亮山乡秋意浓',
    ink: '淡墨轻描扇影斜\n金黄点点落谁家\n古树无言藏岁月\n一叶知秋到天涯'
  },
  mushroom: {
    spring: '春雨绵绵润栎林\n小伞撑开遍地金\n大别山深藏至味\n一朵香菇一片心',
    autumn: '秋林露重菌香浓\n采得山珍满竹笼\n柴火慢炖汤如乳\n暖了寒舍暖了冬',
    guochao: '圆圆小伞立林间\n山珍美味出深山\n香菇走上国潮路\n香飘万里客知还',
    ink: '林下悄悄撑小伞\n墨痕点点缀衣衫\n山珍不与群芳竞\n自有清香出远山'
  },
  shoot: {
    spring: '一夜春雷催笋生\n破土尖尖带露青\n竹林深处寻鲜味\n炒盘腊肉香满庭',
    autumn: '春箨已成青竹枝\n秋风犹忆嫩芽时\n山家灶上留鲜味\n岁岁年年节节高',
    guochao: '尖尖角角破春泥\n层层紫箨裹玉肌\n山珍新潮两相得\n节节高升正当时',
    ink: '淡墨疏篁烟雨里\n新笋亭亭立翠微\n虚心如竹承山野\n一节清香一段诗'
  }
};

/* ---------- 自定义上传风物 · AI 藏名小诗模板 ----------
 * {n} 会被替换为用户起的名字；每种风格3套模板，按名字哈希选取，
 * 不同名字生成不同诗句，模拟"AI分析名字赋诗"。
 */
const CUSTOM_POEMS = {
  spring: [
    '{n}含笑沐春风\n青山绿水映娇容\n丹青妙手添新彩\n一片生机入画中',
    '春日迟迟景正浓\n{n}带露韵无穷\n青绿点染山林意\n信阳风光画里逢',
    '雨润山川草木新\n{n}翩翩入画频\n春风若有怜才意\n留得青绿赠故人'
  ],
  autumn: [
    '秋染层林色正浓\n{n}灿灿映霞红\n赭黄写尽丰收意\n大别山中岁物丰',
    '霜天寥廓雁南飞\n{n}凝露染秋晖\n一笔赭黄收晚照\n山乡处处说丰归',
    '金风送爽桂香浮\n{n}盈枝画意稠\n秋色入笺情更暖\n信阳风物最宜秋'
  ],
  guochao: [
    '{n}惊艳出东方\n国色新妆意气扬\n浓墨重彩描风物\n潮涌信阳正当时',
    '朱红一点破云烟\n{n}夺目灿若燃\n国潮笔底春雷动\n老树新花别样鲜',
    '艳彩飞扬画卷开\n{n}昂首向未来\n传统风物新表达\n国潮澎湃滚滚来'
  ],
  ink: [
    '淡墨轻毫写{n}\n留白之处见天真\n不争浓艳争清气\n一纸素心养精神',
    '水墨氤氲意自闲\n{n}淡雅出尘寰\n寥寥数笔风骨在\n大别烟云入梦闲',
    '素笺淡墨两相宜\n{n}清影入新诗\n洗尽铅华存本真\n东方美学正当时'
  ]
};

/* AI 分析名字 → 选模板 → 嵌入名字 */
function generateCustomPoem(name, styleId) {
  const n = (name || '风物').trim().slice(0, 8) || '风物';
  let hash = 0;
  for (const ch of n) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  const bank = CUSTOM_POEMS[styleId] || CUSTOM_POEMS.spring;
  return bank[hash % bank.length].split('{n}').join(n);
}

/* 自定义图片的风格化滤镜（模拟 AI 风格上色） */
const CUSTOM_FILTERS = {
  spring: 'saturate(1.35) hue-rotate(10deg) brightness(1.06)',
  autumn: 'sepia(0.5) saturate(1.25) hue-rotate(-14deg) brightness(1.02)',
  guochao: 'saturate(1.9) contrast(1.18) brightness(1.04)',
  ink: 'grayscale(0.92) contrast(1.08)'
};

/* ---------- 关卡配置（8关，难度平缓，适合演示） ---------- */
const LEVELS = [
  { name: '第一关 · 初识风物', pairs: 4, cols: 4, unlock: ['camellia'], tip: '4 对卡片，轻松上手' },
  { name: '第二关 · 茶花争艳', pairs: 6, cols: 4, unlock: ['chestnut'], tip: '6 对卡片，小有挑战' },
  { name: '第三关 · 栗香满筐', pairs: 8, cols: 4, unlock: ['tin'], tip: '8 对卡片，渐入佳境' },
  { name: '第四关 · 茶罐藏春', pairs: 10, cols: 5, unlock: ['wheat'], tip: '10 对卡片，稳住节奏' },
  { name: '第五关 · 麦浪翻滚', pairs: 12, cols: 6, unlock: ['azalea'], tip: '12 对卡片，眼明手快' },
  { name: '第六关 · 鱼戏荷塘', pairs: 12, cols: 6, unlock: ['fish', 'lotus'], tip: '双份线稿，一次解锁' },
  { name: '第七关 · 柿柿如意', pairs: 14, cols: 6, unlock: ['persimmon', 'ginkgo'], tip: '14 对卡片，挑战升级' },
  { name: '第八关 · 大别山珍', pairs: 16, cols: 6, unlock: ['mushroom', 'shoot'], tip: '16 对卡片，圆满收官' }
];

/* ---------- 全局工具 ---------- */
function getItem(id) { return ITEMS.find(i => i.id === id); }
function getStyle(id) { return STYLES.find(s => s.id === id); }

/* 已解锁线稿（本地存档；默认赠礼解锁「茶叶」，方便直接演示工坊） */
function getUnlocked() {
  try { return JSON.parse(localStorage.getItem('wm_unlocked')) || ['tea']; }
  catch (e) { return ['tea']; }
}
function unlockItems(ids) {
  const cur = getUnlocked();
  ids.forEach(id => { if (!cur.includes(id)) cur.push(id); });
  localStorage.setItem('wm_unlocked', JSON.stringify(cur));
}
function getLevelsDone() {
  try { return JSON.parse(localStorage.getItem('wm_levels')) || []; }
  catch (e) { return []; }
}
function markLevelDone(idx) {
  const cur = getLevelsDone();
  if (!cur.includes(idx)) cur.push(idx);
  localStorage.setItem('wm_levels', JSON.stringify(cur));
}

/* 每关最佳星级（1-3星，按误点次数评定） */
function getStars() {
  try { return JSON.parse(localStorage.getItem('wm_stars')) || {}; }
  catch (e) { return {}; }
}
function saveStars(idx, stars) {
  const cur = getStars();
  cur[idx] = Math.max(cur[idx] || 0, stars);
  localStorage.setItem('wm_stars', JSON.stringify(cur));
}

/* 用户自定义上传的风物（图片 dataURL + 名字，本地持久化） */
function getCustomItems() {
  try { return JSON.parse(localStorage.getItem('wm_custom')) || []; }
  catch (e) { return []; }
}
function saveCustomItems(list) {
  try {
    localStorage.setItem('wm_custom', JSON.stringify(list));
    return true;
  } catch (e) { return false; }   // 超出存储配额
}

/* 给 svg 字符串补上宽高（canvas 绘制需要） */
function sizedSvg(svg, w, h) {
  return svg.replace('<svg ', `<svg width="${w}" height="${h}" `);
}
