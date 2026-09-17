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
  spring:  { id: 'spring',  name: '春日青绿', desc: '雨前初绽 · 春和盎然' },
  autumn:  { id: 'autumn',  name: '秋意赭黄', desc: '层林尽染 · 丰收暖阳' },
  guochao: { id: 'guochao', name: '国潮艳彩', desc: '浓墨重彩 · 年轻国潮' },
  ink:     { id: 'ink',     name: '淡雅水墨', desc: '留白写意 · 东方禅意' }
};

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
      { role: 'system', content: '你是一位专精国风诗词的AI诗人，擅长即兴创作七言绝句。只输出诗句，不加任何额外文字。' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.85,
    max_tokens: 200
  });

  let poem = '';
  if (response.choices && response.choices[0]) poem = response.choices[0].message.content;
  else if (response.response) poem = response.response;

  poem = poem.replace(/^[\d\s•\-、。.]+/gm, '').replace(/["""''"]/g, '').trim();
  return poem;
}

/* ---------- Painter 智能体：SDXL 图生图风格化（仅自定义图片） ---------- */
async function runPainter(env, item, style) {
  if (!item.custom || !item.img) return null;
  const base64 = item.img.replace(/^data:image\/\w+;base64,/, '');
  const stylePrompt = STYLE_PROMPTS[style.name] || `Chinese art style, ${style.name}, ${style.desc}`;

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
    const style = STYLE_BY_ID[styleId] || STYLE_BY_ID.spring;

    /* NDJSON 流式响应：每行一个事件 JSON，前端逐行解析 */
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));

        /* Step 1: Planner 规划智能体（解析意图） */
        send({ agent: 'Planner', status: 'running', message: '正在理解你的创作意图…' });
        await new Promise(r => setTimeout(r, 300));
        const planText = `风物：${item.name}${item.alias ? ' · ' + item.alias : ''}，风格：${style.name}${userPrompt ? '，你的想法：「' + userPrompt + '」' : ''}`;
        send({ agent: 'Planner', status: 'done', message: planText });

        /* Step 2: Poet + Painter 并行 */
        send({ agent: 'Poet', status: 'running', message: '诗人智能体正在吟咏国风小诗…' });
        if (item.custom) {
          send({ agent: 'Painter', status: 'running', message: '画师智能体正在风格化你的图片…' });
        }

        const [poem, image] = await Promise.all([
          runPoet(env, item, style, userPrompt).catch(() => null),
          item.custom ? runPainter(env, item, style).catch(() => null) : Promise.resolve(null)
        ]);

        send({ agent: 'Poet', status: 'done', result: { poem: poem || '' } });
        if (item.custom) send({ agent: 'Painter', status: 'done', result: { image: image || '' } });

        /* Step 3: Critic 评论智能体（依赖诗+图结果） */
        send({ agent: 'Critic', status: 'running', message: '评论家智能体正在为作品命名与短评…' });
        const critique = await runCritic(env, item, style, poem || '', userPrompt).catch(() => ({
          title: `${item.name}·${style.name}`,
          critique: 'AI 文创作品。',
          intent: '智能体协作生成。'
        }));
        send({ agent: 'Critic', status: 'done', result: critique });

        /* Done：汇总结果 */
        send({
          done: true,
          poem: poem || '',
          image: image || '',
          title: critique.title || `${item.name}·${style.name}`,
          critique: critique.critique || '',
          intent: critique.intent || '',
          item: { id: item.id, name: item.name, alias: item.alias || '', custom: !!item.custom },
          style: { id: style.id, name: style.name, desc: style.desc }
        });

        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive'
      }
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
