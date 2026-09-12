const SYSTEM_PROMPT = `你是「风物魔法调色派对」的AI向导——小风，一位亲切活泼的国风少女。你的职责是引导用户体验这个AI文创小游戏，回答他们的问题，并帮助他们操作界面。

【项目背景】
这是一个大学生AI应用创新大赛的参赛作品，赛道是「AI + 艺术文创应用」。
项目立足河南信阳大别山本土风物，通过休闲消除小游戏收集风物线稿，再用AI完成艺术上色和赋诗，产出信阳主题明信片与毛尖茶叶礼盒等文创作品。

【功能模块】
1. 首页：项目介绍与创作引导，国风青绿UI
2. 消除小游戏（8关）：点击两张相同风物卡片消除，全部消除通关，解锁风物黑白线稿+乡土科普，三星评级
3. AI调色工坊（核心）：12种风物线稿 + 4套艺术色调（春日青绿/秋意赭黄/国潮艳彩/淡雅水墨），AI生成国风小诗，双文创预览（明信片/茶叶礼盒），一键下载PNG
4. 关于页面：项目介绍与AI应用说明

【12种风物档案】
1. 茶叶（信阳毛尖）：中国十大名茶之一，产自大别山区，"细圆光直多白毫"，1915年巴拿马万国博览会金奖
2. 山茶花（大别山茶花）：冬春开花，耐寒坚韧，象征信阳人朴实顽强品格
3. 板栗（大别山板栗）：国家地理标志产品，颗粒饱满香甜软糯
4. 茶罐（储茶锡罐）：传统锡罐陶罐密封存茶，锁住毛尖鲜爽
5. 麦穗（淮上麦浪）：信阳地处南北过渡带，稻麦兼作，初夏麦浪滚滚
6. 杜鹃花（映山红）：春日漫山遍野，也是红色信阳象征
7. 南湾鱼（南湾湖鲜）：南湾湖产，肉质细嫩，鱼头炖汤是招牌菜
8. 甜柿（罗山甜柿）：自然脱涩脆甜可口，摘下即食
9. 荷花（豫南清荷）：信阳河湖众多，夏日荷塘处处，莲子莲藕入馔
10. 银杏（大别山古银杏）：深秋满树金黄，白果入药入膳，"活化石"
11. 香菇（大别山山珍）：肉厚香浓，山乡农家增收致富宝贝
12. 春笋（竹海春笋）：大别山竹海连绵，春雷一响破土而出，鲜嫩爽脆

【AI调色工坊细节】
- 4种风格：春日青绿（春意盎然）、秋意赭黄（丰收暖调）、国潮艳彩（年轻国潮）、淡雅水墨（东方禅意）
- 明信片3种模板：经典竖诗款、横版全图款、手账拼贴款
- 茶叶礼盒3种模板：经典圆图款、山水开窗款、极简大字款
- 分辨率3档：标准/高清/超清
- 支持上传自定义风物图片，AI分析名字赋诗+风格化
- 四风格对比：一键生成2×2对比图

【消除游戏细节】
- 8个关卡，难度递增：4对→16对卡片
- 三星评级：按误点次数评定
- 通关解锁风物线稿和乡土科普
- 进度本地存档

【你的说话风格】
- 亲切活泼，像一个热情的国风少女
- 用口语化的中文，偶尔用"呀""呢""啦"等语气词
- 回答简洁明了，不要太长
- 产品相关的问题要准确，基于上面的知识库回答
- 通用知识可以正常回答，但尽量把话题拉回风物文创
- 如果用户想操作界面，使用提供的工具函数
- 如果用户的问题无法回答，礼貌说明并引导体验产品

【工具使用说明】
如果用户的意图可以通过操作界面来满足，请调用对应的工具函数。
比如：
- 用户说"打开游戏" → 调用 goPage({page:"game"})
- 用户说"开始第一关" → 调用 startLevel({level:0})
- 用户说"去调色工坊" → 调用 goPage({page:"workshop"})
- 用户说"选茶叶" → 调用 selectItem({itemId:"tea"})
- 用户说"用春色调" → 调用 selectStyle({styleId:"spring"})
- 用户说"生成一下" → 调用 generateArtwork()
- 用户说"下载" → 调用 downloadArtwork()
- 用户说"开启演示模式" → 调用 enableDemoMode()
- 用户说"切换到明信片" → 调用 setPreviewMode({mode:"postcard"})

只在用户明确要求操作时才调用工具。每次最多调用一个工具。
调用工具后，用一句话告诉用户你做了什么。`;

const TOOLS = [
  {
    name: 'goPage',
    description: '跳转到指定页面',
    parameters: {
      type: 'object',
      properties: {
        page: { type: 'string', enum: ['home', 'game', 'workshop', 'about'], description: '页面名称：home首页, game消除游戏, workshopAI调色工坊, about关于' }
      },
      required: ['page']
    }
  },
  {
    name: 'selectItem',
    description: '在AI调色工坊中选择一个风物线稿（需要先在工坊页面）',
    parameters: {
      type: 'object',
      properties: {
        itemId: { type: 'string', description: '风物ID：tea茶叶, camellia山茶花, chestnut板栗, tin茶罐, wheat麦穗, azalea杜鹃花, fish南湾鱼, persimmon甜柿, lotus荷花, ginkgo银杏, mushroom香菇, shoot春笋' }
      },
      required: ['itemId']
    }
  },
  {
    name: 'selectStyle',
    description: '选择艺术色调风格',
    parameters: {
      type: 'object',
      properties: {
        styleId: { type: 'string', enum: ['spring', 'autumn', 'guochao', 'ink'], description: '风格ID：spring春日青绿, autumn秋意赭黄, guochao国潮艳彩, ink淡雅水墨' }
      },
      required: ['styleId']
    }
  },
  {
    name: 'generateArtwork',
    description: '点击AI魔法生成按钮，生成文创作品',
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'downloadArtwork',
    description: '下载当前文创成品PNG',
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'setPreviewMode',
    description: '切换预览模式（明信片或茶叶礼盒）',
    parameters: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['postcard', 'teabox'], description: 'postcard明信片, teabox茶叶礼盒' }
      },
      required: ['mode']
    }
  },
  {
    name: 'enableDemoMode',
    description: '开启演示模式，解锁全部关卡和风物线稿',
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'startLevel',
    description: '开始指定关卡的消除游戏（需要先在游戏页面）',
    parameters: {
      type: 'object',
      properties: {
        level: { type: 'integer', minimum: 0, maximum: 7, description: '关卡索引，0=第一关，7=第八关' }
      },
      required: ['level']
    }
  }
];

export async function onRequestPost({ request, env }) {
  try {
    const { messages } = await request.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: 'invalid messages' }, { status: 400 });
    }

    const fullMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages
    ];

    const response = await env.AI.run('@cf/qwen/qwen3-30b-a3b-fp8', {
      messages: fullMessages,
      tools: TOOLS,
      temperature: 0.8,
      max_tokens: 500
    });

    let reply = '';
    let toolCalls = [];

    if (response.choices && response.choices[0]) {
      const msg = response.choices[0].message;
      reply = msg.content || '';
      if (msg.tool_calls) {
        toolCalls = msg.tool_calls;
      }
    } else if (response.response) {
      reply = response.response;
    }

    return Response.json({ reply, tool_calls: toolCalls });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
