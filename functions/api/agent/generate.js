/* =====================================================
 * 编排智能体 /api/agent/generate
 * 多智能体协作：Planner → (Poet ∥ Painter) → Critic
 * 以 NDJSON 流式返回每一步进度与结果，前端按智能体顺序追加聊天卡片
 * ===================================================== */

/* 风格名→SDXL 提示词映射（与 data.js 中「秋意赭黄」保持一致） */
const STYLE_PROMPTS = {
  '春日青绿': 'Traditional Chinese ink painting, spring green palette, fresh vibrant, elegant botanical art',
  '秋意赭黄': 'Traditional Chinese ink painting, autumn golden brown palette, warm harvest colors',
  '国潮艳彩': 'Chinese guochao art style, bold vibrant saturated colors, modern traditional fusion',
  '淡雅水墨': 'Chinese ink wash painting, minimalist black and white, zen aesthetic, subtle brushwork'
};

const STYLE_BY_ID = {
  spring:  { id: 'spring',  name: '春日青绿', desc: '雨前初绽 · 春和盎然', pal: { main: '#5FA96F', sub: '#8FCB9B', deep: '#3E7D54', accent: '#F2C94C', bg: '#EAF6EC', paper: '#FDFBF3' } },
  autumn:  { id: 'autumn',  name: '秋意赭黄', desc: '层林尽染 · 丰收暖阳', pal: { main: '#C9803B', sub: '#E0A75E', deep: '#8C4F21', accent: '#A63D2A', bg: '#F7ECD8', paper: '#FBF4E4' } },
  guochao: { id: 'guochao', name: '国潮艳彩', desc: '浓墨重彩 · 年轻国潮', pal: { main: '#E63946', sub: '#F4A261', deep: '#1D3557', accent: '#2A9D8F', bg: '#FFF3E2', paper: '#FFFBF2' } },
  ink:     { id: 'ink',     name: '淡雅水墨', desc: '留白写意 · 东方禅意', pal: { main: '#6B7B75', sub: '#9AA8A2', deep: '#3E4E48', accent: '#A63D2A', bg: '#F2F0EA', paper: '#F8F6F0' } }
};

/* 构造最终风格对象：预设风格直接复用，自定义风格用 Planner 输出的色板+提示词 */
function buildFinalStyle(plan, fallbackStyle) {
  if (plan.finalStyleId && plan.finalStyleId !== 'custom' && STYLE_BY_ID[plan.finalStyleId]) {
    return STYLE_BY_ID[plan.finalStyleId];
  }
  const p = plan.customPalette || {};
  return {
    id: 'custom',
    name: plan.customStyleName || '自定义风格',
    desc: plan.customStyleDesc || '',
    pal: {
      main:   /^#[0-9a-fA-F]{6}$/.test(p.main)   ? p.main   : '#888888',
      sub:    /^#[0-9a-fA-F]{6}$/.test(p.sub)    ? p.sub    : '#aaaaaa',
      deep:   /^#[0-9a-fA-F]{6}$/.test(p.deep)   ? p.deep   : '#444444',
      accent: /^#[0-9a-fA-F]{6}$/.test(p.accent) ? p.accent : '#fbbf24',
      bg:     /^#[0-9a-fA-F]{6}$/.test(p.bg)     ? p.bg     : '#f5f5f5',
      paper:  /^#[0-9a-fA-F]{6}$/.test(p.paper)  ? p.paper  : '#fafafa'
    },
    sdxlPrompt: plan.sdxlPrompt || `art style, ${plan.customStyleName || 'custom aesthetic'}`
  };
}

const ITEMS_INFO = {
  tea:        { name: '茶叶',   alias: '信阳毛尖' },
  camellia:   { name: '山茶花', alias: '大别山茶花' },
  chestnut:   { name: '板栗',   alias: '大别山板栗' },
  tin:        { name: '茶罐',   alias: '储茶锡罐' },
  wheat:      { name: '麦穗',   alias: '淮上麦浪' },
  azalea:     { name: '杜鹃花', alias: '映山红' },
  fish:       { name: '南湾鱼', alias: '南湾湖鲜' },
  persimmon:  { name: '甜柿',   alias: '罗山甜柿' },
  lotus:      { name: '荷花',   alias: '豫南清荷' },
  ginkgo:     { name: '银杏',   alias: '大别山古银杏' },
  mushroom:   { name: '香菇',   alias: '大别山山珍' },
  shoot:      { name: '春笋',   alias: '竹海春笋' }
};

/* 提取 SDXL 返回的图片 base64（兼容多种响应形态） */
async function extractImageBase64(response) {
  if (typeof response === 'string') return response;
  if (response.image) return response.image;
  if (response instanceof ReadableStream) {
    const buffer = await new Response(response).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  }
  throw new Error('Unknown image response format');
}

/* ---------- Planner 智能体：Qwen3 真正解析用户意图，决定最终风格+约束 ---------- */
async function runPlanner(env, item, style, userPrompt) {
  /* 无用户输入：直接返回默认规划，不浪费一次 AI 调用 */
  if (!userPrompt || userPrompt.trim().length < 2) {
    return {
      plan: {
        finalStyleId: style.id,
        customPrompt: '',
        intent: `按「${style.name}」风格创作${item.name}文创`
      },
      finalStyle: style
    };
  }

  const styleList = Object.values(STYLE_BY_ID)
    .map(s => `- ${s.id}：${s.name}（${s.desc}）`).join('\n');

  const prompt = `你是一位国风文创规划智能体。请分析用户的创作要求，输出结构化 JSON 指令。

当前风物：${item.name}${item.alias ? `（${item.alias}）` : ''}
当前风格：${style.name} — ${style.desc}

可选风格（按 finalStyleId 选择）：
${styleList}
- custom：用户描述的其他风格（不属于以上 4 种预设时选这个，需自定义色板和提示词）

用户要求：${userPrompt}

请判断：
1. 用户想要哪种风格？
   - 如果对应 4 种预设之一（关键词：黑白/水墨/写意→ink；春/青绿→spring；秋/金黄→autumn；国潮/艳彩→guochao），finalStyleId 设为对应 id
   - 如果是其他风格（如赛博朋克/敦煌壁画/浮世绘/印象派/极简/暖橙/冷蓝/复古/动漫等），finalStyleId 设为 "custom"，并填写 customStyleName/customStyleDesc/customPalette/sdxlPrompt
2. customPalette：4 个十六进制颜色（main 主色，sub 辅色，deep 深色，accent 点缀色，bg 背景，paper 纸色），契合风格特征
3. sdxlPrompt：英文 SDXL 提示词（30-60 词），描述视觉特征（如 "cyberpunk neon, futuristic, dark mood, blue purple palette, holographic"）
4. customPrompt：50 字内中文创作约束（融合用户想法+风格特征）
5. intent：一句话说明规划结论

严格输出 JSON（不要 markdown 代码块，不要解释）：
{"finalStyleId":"<spring|autumn|guochao|ink|custom>","customStyleName":"<自定义风格名，预设时为空>","customStyleDesc":"<20字内描述，预设时为空>","customPalette":{"main":"#hex","sub":"#hex","deep":"#hex","accent":"#hex","bg":"#hex","paper":"#hex"},"sdxlPrompt":"<英文SDXL提示词>","customPrompt":"<50字内创作约束>","intent":"<一句话规划结论>"}`;

  const response = await env.AI.run('@cf/qwen/qwen3-30b-a3b-fp8', {
    messages: [
      { role: 'system', content: '你是国风文创规划智能体，擅长解析用户意图并输出 JSON 指令。只输出 JSON，不加任何解释或 markdown 代码块。' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.4,
    max_tokens: 400
  });

  let text = '';
  if (response.choices && response.choices[0]) text = response.choices[0].message.content;
  else if (response.response) text = response.response;

  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      const finalStyle = buildFinalStyle(parsed, style);
      return {
        plan: parsed,
        finalStyle,
        customPrompt: (parsed.customPrompt || userPrompt).slice(0, 100),
        intent: parsed.intent || `按「${finalStyle.name}」风格创作`
      };
    } catch (e) {}
  }
  /* 解析失败：返回默认（保留原 style 和 userPrompt） */
  return {
    plan: { finalStyleId: style.id, customPrompt: userPrompt, intent: `按「${style.name}」风格创作` },
    finalStyle: style,
    customPrompt: userPrompt,
    intent: `按「${style.name}」风格创作`
  };
}

/* ---------- Poet 智能体：Qwen3 写七言绝句 ---------- */
async function runPoet(env, item, style, userPrompt) {
  const prompt = `你是一位国风诗人。请为以下风物创作一首四句七言国风小诗。

风物：${item.name}${item.alias ? `（${item.alias}）` : ''}
艺术风格：${style.name} — ${style.desc}
${item.custom ? '这是用户自定义上传的风物，请将风物名融入诗中。\n' : ''}${userPrompt ? `用户特别要求：${userPrompt}\n` : ''}要求：
1. 严格四句，每句七字，共二十八字
2. 融入该风物特征与信阳大别山乡土意境
3. 诗意契合「${style.name}」风格
4. 仅输出四句诗，换行分隔，不要标题、序号或任何解释`;

  const response = await env.AI.run('@cf/qwen/qwen3-30b-a3b-fp8', {
    messages: [
      { role: 'system', content: '你是一位专精国风诗词的AI诗人，擅长即兴创作七言绝句。只输出四句七言诗，每句一行，不加任何标题、序号、解释或额外文字。' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.85,
    max_tokens: 200
  });

  let poem = '';
  if (response.choices && response.choices[0]) poem = response.choices[0].message.content;
  else if (response.response) poem = response.response;
  else if (typeof response === 'string') poem = response;

  /* 温和清洗：去掉行首数字序号、中文序号、首尾引号、HTML 标签；保留正文每个字 */
  poem = (poem || '')
    .replace(/^[\d]+\s*[\.、．)]?\s*/gm, '')              // 行首数字序号 1. 1、 1)
    .replace(/^[一二三四五六七八九十百]+[、.．]\s*/gm, '')   // 中文序号 一、 二.
    .replace(/^[•·●▪\-–—]+\s*/gm, '')                    // 行首项目符号
    .replace(/^["""'']+|["""'']+$/gm, '')                 // 行首行尾引号
    .replace(/^```[a-z]*$|^```$/gm, '')                   // 代码块标记
    .replace(/<[^>]+>/g, '')                              // HTML 标签
    .replace(/\n{3,}/g, '\n\n')                           // 多空行压缩
    .trim();

  /* 兜底校验：至少要有两行非空内容才返回，否则返回空让前端 fallback */
  const lines = poem.split('\n').filter(l => l.trim());
  if (lines.length < 2) return '';

  return poem;
}

/* ---------- Painter 智能体：SDXL 图生图风格化（仅自定义图片） ---------- */
async function runPainter(env, item, style) {
  if (!item.custom || !item.img) return null;
  const base64 = item.img.replace(/^data:image\/\w+;base64,/, '');
  /* 优先用 finalStyle.sdxlPrompt（自定义风格），fallback 到 STYLE_PROMPTS[name]（预设风格） */
  const stylePrompt = style.sdxlPrompt || STYLE_PROMPTS[style.name] || `art style, ${style.name}, ${style.desc}`;

  const response = await env.AI.run('@cf/stabilityai/stable-diffusion-xl-base-1.0', {
    prompt: stylePrompt,
    image_b64: base64,
    strength: 0.6,
    guidance: 7.5,
    num_steps: 20,
    width: 512,
    height: 512
  });

  const imageBase64 = await extractImageBase64(response);
  return `data:image/png;base64,${imageBase64}`;
}

/* ---------- Critic 智能体：Qwen3 命名 + 短评 + 创作意图 ---------- */
async function runCritic(env, item, style, poem, userPrompt) {
  const prompt = `你是一位国风文艺评论家。请为以下 AI 文创作品写一段简短的创作短评、命名、和创作意图说明。

风物：${item.name}${item.alias ? `（${item.alias}）` : ''}
风格：${style.name} — ${style.desc}
${item.custom ? '这是用户自定义上传的风物。\n' : ''}诗作：
${poem || '（无诗）'}

用户想法：${userPrompt || '默认创作'}

要求：
1. title：4-6字文创作品名（如"毛尖春色图"）
2. critique：80字内文艺点评，点出风格特色和诗画意境
3. intent：50字内说明 AI 如何融合风物、风格、用户想法

严格输出 JSON 格式（不要 markdown 代码块）：
{"title":"作品名","critique":"短评","intent":"创作意图"}`;

  const response = await env.AI.run('@cf/qwen/qwen3-30b-a3b-fp8', {
    messages: [
      { role: 'system', content: '你是国风文艺评论家，擅长为文创作品命名和短评。只输出 JSON。' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 300
  });

  let text = '';
  if (response.choices && response.choices[0]) text = response.choices[0].message.content;
  else if (response.response) text = response.response;

  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch (e) {}
  }
  return {
    title: `${item.name}·${style.name}`,
    critique: 'AI 融合风物特征与国风艺术生成的文创作品。',
    intent: '智能体协作：诗人赋诗，画师上色，评论家命名定调。'
  };
}

/* ---------- onRequestOptions：CORS 预检 ---------- */
export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}

/* 给所有响应加 CORS 头（同源场景无害，跨域场景必需） */
function corsHeaders(res) {
  const h = new Headers(res.headers);
  h.set('Access-Control-Allow-Origin', '*');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

/* ---------- onRequestPost：编排主流程 ---------- */
export async function onRequestPost({ request, env }) {
  try {
    const { itemId, styleId, customImage, customName, userPrompt } = await request.json();

    /* 解析风物（内置 / 自定义） */
    let item;
    if (itemId && String(itemId).startsWith('custom:')) {
      item = { id: itemId, name: customName || '我的风物', alias: '我的风物', custom: true, img: customImage };
    } else {
      const base = ITEMS_INFO[itemId] || ITEMS_INFO.tea;
      item = { ...base, custom: false };
    }
    /* 风格：前端未选预设时 styleId=null，用中性占位符让 Planner 根据用户描述自由决策 */
    const style = STYLE_BY_ID[styleId] || {
      id: 'neutral', name: '未选择', desc: '用户未指定预设风格，由 AI 根据描述决定',
      pal: { main: '#888888', sub: '#aaaaaa', deep: '#444444', accent: '#fbbf24', bg: '#f5f5f5', paper: '#fafafa' }
    };

    /* NDJSON 流式响应：每行一个事件 JSON，前端逐行解析 */
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));

        /* Step 1: Planner 规划智能体（真正调 LLM 解析用户意图，可能切换风格或构造自定义风格） */
        send({ agent: 'Planner', status: 'running', message: '正在理解你的创作意图…' });
        const planResult = await runPlanner(env, item, style, userPrompt).catch(() => ({
          plan: { finalStyleId: style.id, customPrompt: userPrompt, intent: `按「${style.name}」风格创作` },
          finalStyle: style,
          customPrompt: userPrompt,
          intent: `按「${style.name}」风格创作`
        }));
        const finalStyle = planResult.finalStyle;
        const finalPrompt = planResult.customPrompt;
        const styleChanged = finalStyle.id !== style.id;
        const planText = `风物：${item.name}${item.alias ? ' · ' + item.alias : ''}，风格：${finalStyle.name}${styleChanged ? `（由「${style.name}」切换）` : ''}${finalStyle.id === 'custom' && finalStyle.desc ? ' · ' + finalStyle.desc : ''}${finalPrompt ? '，创作约束：「' + finalPrompt + '」' : ''} · ${planResult.intent}`;
        send({ agent: 'Planner', status: 'done', message: planText });

        /* Step 2: Poet + Painter 并行（使用 Planner 解析后的 finalStyle 和 finalPrompt） */
        send({ agent: 'Poet', status: 'running', message: '诗人智能体正在吟咏国风小诗…' });
        if (item.custom) {
          send({ agent: 'Painter', status: 'running', message: '画师智能体正在风格化你的图片…' });
        }

        const [poem, image] = await Promise.all([
          runPoet(env, item, finalStyle, finalPrompt).catch(() => null),
          item.custom ? runPainter(env, item, finalStyle).catch(() => null) : Promise.resolve(null)
        ]);

        send({ agent: 'Poet', status: 'done', result: { poem: poem || '' } });
        if (item.custom) send({ agent: 'Painter', status: 'done', result: { image: image || '' } });

        /* Step 3: Critic 评论智能体（依赖诗+图结果） */
        send({ agent: 'Critic', status: 'running', message: '评论家智能体正在为作品命名与短评…' });
        const critique = await runCritic(env, item, finalStyle, poem || '', finalPrompt).catch(() => ({
          title: `${item.name}·${finalStyle.name}`,
          critique: 'AI 文创作品。',
          intent: '智能体协作生成。'
        }));
        send({ agent: 'Critic', status: 'done', result: critique });

        /* Done：汇总结果（带回完整 finalStyle 含 pal，让前端作品卡按自定义色板着色） */
        send({
          done: true,
          poem: poem || '',
          image: image || '',
          title: critique.title || `${item.name}·${finalStyle.name}`,
          critique: critique.critique || '',
          intent: critique.intent || planResult.intent,
          item: { id: item.id, name: item.name, alias: item.alias || '', custom: !!item.custom },
          style: {
            id: finalStyle.id,
            name: finalStyle.name,
            desc: finalStyle.desc,
            pal: finalStyle.pal,
            sdxlPrompt: finalStyle.sdxlPrompt || null
          }
        });

        controller.close();
      }
    });

    return corsHeaders(new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive'
      }
    }));
  } catch (err) {
    return corsHeaders(Response.json({ error: err.message }, { status: 500 }));
  }
}
