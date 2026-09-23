# 风物魔法调色派对

> 多智能体协作的大别山乡土风物 AI 文创生成系统
> 大学生 AI 应用创新大赛参赛作品 · 赛道：**AI + 工科综合**

立足河南信阳大别山农林本土风物（信阳毛尖、山茶花、板栗、南湾鱼、罗山甜柿、映山红、银杏、春笋……），以**多智能体工程编排**视角重构乡土文创生产链路：用户通过休闲消除小游戏收集风物线稿，再在对话式工坊中用自然语言描述想法，由 **Planner / Poet / Painter / Critic** 四个 AI 智能体分工协作流式生成诗、画、评一体化的国风文创成品，支持多版式预览与高清下载。

## 项目亮点

- **多智能体串行-并行混合编排**：Planner 解析意图 →（Poet 赋诗 ∥ Painter 绘画）→ Critic 命名短评，NDJSON 流式逐事件返回
- **真实大模型调用**：Cloudflare Workers AI · Qwen3-30B（LLM）+ SDXL 1.0（图像生成），非模拟
- **对话式协作工坊**：用户描述风格，Planner 即时生成专属色板与 SDXL 提示词，不再局限于 4 种预设
- **Function Calling 闭环**：小风助手支持多步工具调用（selectItem → selectStyle → sendChatMessage），自然语言端到端操控
- **工程化降级容错**：AI 失败回退本地诗库 + CSS 滤镜；JSON 解析失败保留原风格；图生图超时回退 SVG 着色
- **零依赖零构建**：纯 HTML/CSS/JS + Cloudflare Pages Functions，PWA 离线可用，Web Audio 合成音效
- **移动端响应式**：四档断点（980/640/380/safe-area），iOS 刘海/Home Indicator 安全区适配

## 功能模块

### 1. 首页
项目介绍与创作引导，国风青绿 UI，流程卡展示"游戏 → 工坊 → 关于"三段式动线。

### 2. 消除小游戏（8 关）
- 点击两张相同风物卡片即可消除，全部消除即通关
- 难度平缓递增（4 对 → 16 对），适合现场演示
- 通关解锁对应风物**黑白线稿** + **信阳乡土科普**
- 误点计数 + 三星评级（最佳成绩本地存档）

### 3. 多智能体 AI 调色文创工坊（核心模块）
- **12 种风物线稿**：茶叶 / 山茶花 / 板栗 / 茶罐 / 麦穗 / 杜鹃花 / 南湾鱼 / 甜柿 / 荷花 / 银杏 / 香菇 / 春笋
- **对话式交互**：选风物 + 描述风格 → 聊天流分步展示 4 个智能体协作过程 → 作品卡 + 历史列表
- **4 种预设色调 + 无限自定义**：春日青绿 · 秋意赅黄 · 国潮艳彩 · 淡雅水墨，或自然语言描述任意风格（赛博朋克 / 敦煌壁画 / 浮世绘 / 印象派…）
- **流式协作过程可观测**：每个智能体 running 时图标旋转，done 时填入诗/图/评论，最后追加作品卡
- **上传我的风物**：支持上传图片并命名，Painter 调 SDXL 图生图艺术化处理，Poet 将风物名融入诗中
- **多版式预览**：明信片 3 版式（经典竖诗 / 横版全图 / 手账拼贴）+ 礼盒 3 版式（经典圆图 / 山水开窗 / 极简大字）
- **一键下载**：Canvas 高分辨率重绘，导出 PNG（明信片 1200×760 / 礼盒 1000×1000），三档分辨率
- **四风格对比生成**：2×2 对比图展示 AI 多风格上色能力

### 4. 关于页面
项目赛道、背景、功能简介、AI 应用说明，供评审阅读。

## 多智能体架构

```
用户输入（风物 + 风格描述）
        ↓
┌─────────────────────────────────────┐
│  Planner 规划（Qwen3）              │  串行
│  解析意图 → JSON（风格 / 色板 /    │
│  SDXL 提示词 / 创作意图）           │
└────────────┬────────────────────────┘
             ↓
   ┌─────────┴─────────┐
   ↓                   ↓
┌──────────┐    ┌──────────────┐
│ Poet 诗  │    │ Painter 画   │  并行
│ Qwen3    │    │ SDXL 图生图  │
│ 七言绝句 │    │ 或 SVG 着色  │
└─────┬────┘    └──────┬───────┘
      └────────┬───────┘
               ↓
   ┌───────────────────────┐
   │  Critic 评论（Qwen3）  │  串行
   │  命名 + 短评 + 创作意图 │
   └───────────┬───────────┘
               ↓
       NDJSON done 事件
   （回填诗/图/标题/评论/色板）
               ↓
      前端渲染作品卡 + 历史
```

**NDJSON 事件结构**：
- `{"agent":"Planner","status":"running|done","message":"...","result":{...}}`
- `{"agent":"Poet","status":"done","result":{"poem":"..."}}`
- `{"agent":"Painter","status":"done","result":{"image":"..."}}`
- `{"agent":"Critic","status":"done","result":{"title":"...","critique":"...","intent":"..."}}`
- `{"done":true,"poem":"","image":"","title":"","critique":"","intent":"","item":{...},"style":{...}}`

## AI 能力调用

| 模型 | 用途 | 调用方式 |
|---|---|---|
| Cloudflare Workers AI · Qwen3-30B-A3B-FP8 | Planner 意图解析、Poet 赋诗、Critic 命名短评 | `env.AI.run()` 请求-响应式 |
| Cloudflare Workers AI · SDXL 1.0 | Painter 图生图风格迁移（strength=0.6） | `env.AI.run()` 传入 `image_b64` + `prompt` |
| Qwen3 Function Calling | 小风助手多步工具调用 | TOOLS 定义 + tool_calls 串行执行 |

## 快速开始

### 线上访问

部署于 Cloudflare Pages，AI binding 通过 Dashboard 配置：

> 项目部署完成后，需在 Cloudflare Dashboard → 项目 → Settings → Functions → Bindings 添加 Workers AI binding，变量名 `AI`。

### 本地开发

```bash
# 1. 进入项目根目录（含 functions/ 与 风物魔法游戏派对/）
cd Custom-Magic-Palette-Party

# 2. 安装 wrangler（可选，已随 npx 调用）
npm i -g wrangler

# 3. 登录 Cloudflare（首次）
npx wrangler login

# 4. 启动本地 Pages + AI binding
npx wrangler pages dev 风物魔法游戏派对 --binding AI=AI
# 或在 风物魔法游戏派对/wrangler.toml 已配置 [ai] binding = "AI"
npx wrangler pages dev 风物魔法游戏派对

# 5. 浏览器访问 http://localhost:8788
```

> 注意：直接双击 index.html 打开（file://）无法调用后端 functions，AI 智能体功能不可用。

### 部署

```bash
# 手动部署到 production
npx wrangler pages deploy 风物魔法游戏派对 --branch production
```

或连接 GitHub 仓库自动部署（需在 Dashboard 配置 AI binding）。

## 目录结构

```
Custom-Magic-Palette-Party/
├── LICENSE
├── README.md                         # 仓库级说明
├── functions/                        # Cloudflare Pages Functions（后端编排）
│   └── api/
│       ├── chat.js                   # 小风助手 Qwen3 + Function Calling
│       ├── generate-poem.js          # Poet 备用接口（fallback）
│       ├── stylize-image.js          # Painter 备用接口（fallback）
│       └── agent/
│           └── generate.js           # 多智能体编排核心 · NDJSON 流式
└── 风物魔法游戏派对/                  # pages_build_output_dir = "."
    ├── index.html                    # 单页结构 + 各类弹窗
    ├── sw.js                         # Service Worker 缓存
    ├── manifest.json                 # PWA 清单
    ├── favicon.svg
    ├── wrangler.toml                 # Cloudflare Pages 配置 + AI binding
    ├── README.md                     # 本文件
    ├── css/
    │   └── style.css                 # 国风青绿 UI + 多断点响应式
    ├── js/
    │   ├── assistant.js              # 小风助手前端 · 多步 tool call 处理
    │   ├── audio.js                  # Web Audio 合成音效
    │   ├── data.js                   # 12 风物 SVG 线稿 / 色板 / 48 首预置诗 / 科普 / 关卡 / 藏名诗模板
    │   ├── game.js                   # 消除玩法 · 误点计数 · 三星评级 · 通关弹窗
    │   ├── main.js                   # 页面路由 · 通用弹窗 · Toast
    │   └── workshop.js               # 工坊对话式交互 · NDJSON 流式渲染 · 双状态同步 · PNG 导出
    ├── images/
    └── ppt/
        └── 风物魔法调色派对-复赛汇报/
            └── 风物魔法调色派对-复赛汇报.html   # 2 分钟复赛 PPT
```

## 数据持久化

使用浏览器 `localStorage` 本地存档，刷新/关闭不丢失：

| 键 | 内容 |
|---|---|
| `wm_unlocked` | 已解锁的风物线稿 |
| `wm_levels` | 已通关关卡进度 |
| `wm_stars` | 每关最佳星级 |
| `wm_custom` | 用户上传的自定义风物（图 + 名） |
| `wm_resolution` | 下载分辨率档位（0/1/2 = 标准/高清/超清） |

> 存档与浏览器绑定；`file://` 与 `http://localhost` 的存档相互独立。清除浏览器数据将丢失进度（可通过消除游戏演示模式一键恢复）。

## 技术要点

- **多智能体编排**：串行-并行混合拓扑，Planner 解析后并行调度 Poet/Painter，Critic 串行收尾，避免无谓串行等待
- **NDJSON 流式协议**：后端 `ReadableStream` + `TextEncoder` 逐行 JSON 编码，前端 `reader.read()` + `TextDecoder` 增量解析，长响应不阻塞
- **双状态同步**：前端维护 `wsStyleId`（预设）/ `wsCurrentStyle`（自定义含 pal），Planner 返回后同步工具 chip、风格列表高亮、预览着色
- **降级策略**：AI 调用失败回退本地 48 首诗库 + CSS 滤镜；JSON 解析失败保留原风格；图生图超时回退 SVG 着色
- **CORS 处理**：`onRequestOptions` 处理预检请求，所有响应统一加 CORS 头
- **真实大模型**：全部通过 `env.AI.run()` 调用 Cloudflare Workers AI 官方模型，非模拟
- **自定义风格生成**：Planner LLM 输出 6 色色板 + SDXL 英文提示词 + 创作意图，前端用色板着色 SVG
- **全部插图为手写 SVG 矢量线稿**：上色 = 调色板分区填充，黑白线稿 = 同一组路径留白描边
- **Canvas 下载**：2D 高分辨率重绘，竖排诗逐字排版，三档分辨率可选
- **PWA 离线**：Service Worker cache-first，版本号升级触发缓存失效
- **Web Audio 合成**：全部音效由 OscillatorNode + GainNode 合成，无外部音频文件
- **移动端响应式**：980/640/380/safe-area 四档断点，工坊顺序重排（聊天优先），iOS 刘海/Home Indicator 适配

## License

MIT（见仓库根目录 LICENSE）
