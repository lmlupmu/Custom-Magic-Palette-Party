/* =====================================================
 * assistant.js  AI 向导「小风」：语音对话 + TTS + 工具调用
 * 纯语音交互：语音识别输入 → AI 回复 → 语音播报输出
 * ===================================================== */

const Assistant = (() => {
  let chatHistory = [];
  let isSpeaking = false;
  let ttsEnabled = true;
  let voice = null;
  let chatWindow = null;
  let msgList = null;
  let avatarBtn = null;
  let micBtn = null;
  let minimized = true;
  let firstTrigger = true;
  let isListening = false;
  let recognition = null;
  let lastFinalText = '';   // 保存最终识别结果

  /* ---------- 初始化 ---------- */
  function init() {
    chatWindow = document.getElementById('assistantWindow');
    msgList = document.getElementById('assistantMessages');
    avatarBtn = document.getElementById('assistantAvatar');
    micBtn = document.getElementById('assistantMic');

    if (!chatWindow) return;

    avatarBtn.addEventListener('click', toggleWindow);
    document.getElementById('assistantClose').addEventListener('click', () => setMinimized(true));
    document.getElementById('assistantMute').addEventListener('click', toggleMute);
    if (micBtn) micBtn.addEventListener('click', toggleListening);

    initTTS();
    initSpeechRecognition();

    // 首次欢迎：点击「开始创作之旅」触发
    const startBtn = document.querySelector('.btn-primary.btn-big');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        if (firstTrigger) {
          firstTrigger = false;
          setTimeout(() => {
            setMinimized(false);
            showWelcome();
          }, 600);
        }
      });
    }
  }

  /* ---------- TTS 语音合成（固定 Microsoft Xiaoxiao） ---------- */
  let voiceQueue = [];
  let queueIndex = 0;

  function initTTS() {
    if (!('speechSynthesis' in window)) {
      ttsEnabled = false; return;
    }
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      // 固定使用 Microsoft Xiaoxiao
      voice = voices.find(v => /xiaoxiao/i.test(v.name)) ||
              voices.find(v => /zh|chinese|中文/i.test(v.lang)) ||
              voices[0];
    };
    loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }
    const savedMute = localStorage.getItem('wm_tts_muted');
    if (savedMute === '1') ttsEnabled = false;
    updateMuteIcon();
  }

  /* 分段朗读：按标点切分，逐句播放 */
  function speak(text) {
    if (!ttsEnabled || !voice) return;
    stopSpeak();

    const clean = text.replace(/[*_`#]/g, '').replace(/<[^>]+>/g, '');
    voiceQueue = clean.split(/([，。？！；\n]+)/).filter(s => s.trim());
    const merged = [];
    for (let i = 0; i < voiceQueue.length; i++) {
      if (/^[，。？！；\n]+$/.test(voiceQueue[i])) {
        if (merged.length) merged[merged.length - 1] += voiceQueue[i];
      } else {
        merged.push(voiceQueue[i]);
      }
    }
    voiceQueue = merged.filter(s => s.trim());
    queueIndex = 0;
    if (voiceQueue.length) playNextSegment();
  }

  function playNextSegment() {
    if (queueIndex >= voiceQueue.length) {
      isSpeaking = false; setAvatarState('idle'); return;
    }
    const seg = voiceQueue[queueIndex];
    const utter = new SpeechSynthesisUtterance(seg);
    utter.voice = voice;
    utter.lang = 'zh-CN';
    utter.rate = 0.95;
    utter.pitch = 1.0;
    utter.volume = 0.9;

    utter.onstart = () => { isSpeaking = true; setAvatarState('speaking'); };
    utter.onend = () => {
      queueIndex++;
      setTimeout(() => playNextSegment(), 300);
    };
    utter.onerror = () => {
      queueIndex++;
      setTimeout(() => playNextSegment(), 300);
    };
    speechSynthesis.speak(utter);
  }

  function stopSpeak() {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
      voiceQueue = []; queueIndex = 0;
      isSpeaking = false; setAvatarState('idle');
    }
  }

  function toggleMute() {
    ttsEnabled = !ttsEnabled;
    localStorage.setItem('wm_tts_muted', ttsEnabled ? '0' : '1');
    updateMuteIcon();
    if (!ttsEnabled) stopSpeak();
    toast(ttsEnabled ? '语音已开启' : '语音已静音');
  }

  function updateMuteIcon() {
    const btn = document.getElementById('assistantMute');
    if (btn) btn.textContent = ttsEnabled ? '🔊' : '🔇';
  }

  /* ---------- 语音识别（支持普通话 + 部分方言） ---------- */
  function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast('您的浏览器不支持语音识别，请使用 Chrome/Edge');
      if (micBtn) micBtn.style.display = 'none';
      return;
    }
    recognition = new SpeechRecognition();
    recognition.continuous = false;      // 单次识别
    recognition.interimResults = true;   // 实时显示中间结果
    recognition.lang = 'zh-CN';          // 中文（浏览器会自动处理方言）
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isListening = true;
      setMicState('listening');
      setAvatarState('thinking');
      showListeningHint(true);
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      // 保存最终结果
      if (finalTranscript) lastFinalText = finalTranscript;
      // 显示给用户看（优先显示最终结果，否则显示中间结果）
      updateListeningText(finalTranscript || interimTranscript);
    };

    recognition.onerror = (event) => {
      isListening = false;
      setMicState('idle');
      setAvatarState('idle');
      showListeningHint(false);
      lastFinalText = '';
      if (event.error === 'no-speech') {
        toast('没听到声音呢，请靠近麦克风再说一次');
      } else if (event.error === 'audio-capture') {
        toast('无法访问麦克风，请检查权限设置');
      } else if (event.error === 'not-allowed') {
        toast('麦克风权限被拒绝，请在浏览器设置中允许');
      } else {
        toast('语音识别出错：' + event.error);
      }
    };

    recognition.onend = () => {
      // 无论怎么结束的（自然结束 / 用户手动停止），只要有识别结果就发送
      const wasListening = isListening;
      isListening = false;
      setMicState('idle');
      setAvatarState('idle');
      showListeningHint(false);

      const text = lastFinalText.trim();
      lastFinalText = '';  // 清空，防止重复发送

      if (text) {
        sendMessage(text);
      } else if (wasListening) {
        // 用户确实在听但没识别出内容
        toast('没听清呢，请再说一次吧');
      }
    };
  }

  function toggleListening() {
    if (!recognition) {
      toast('语音识别不可用'); return;
    }
    if (isListening) {
      recognition.stop();
      isListening = false;
      setMicState('idle');
      setAvatarState('idle');
      showListeningHint(false);
    } else {
      // 停止当前播报，开始聆听
      stopSpeak();
      try {
        recognition.start();
      } catch (e) {
        toast('语音识别启动失败，请刷新页面重试');
      }
    }
  }

  function setMicState(state) {
    if (!micBtn) return;
    micBtn.classList.remove('listening', 'idle');
    micBtn.classList.add(state);
    micBtn.innerHTML = state === 'listening'
      ? '<span class="mic-wave"></span><span class="mic-wave"></span><span class="mic-wave"></span>'
      : '🎙';
  }

  function showListeningHint(show) {
    let hint = document.getElementById('assistantListenHint');
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'assistantListenHint';
      hint.className = 'as-listen-hint';
      const inputArea = document.querySelector('.as-input-area');
      if (inputArea) inputArea.appendChild(hint);
    }
    hint.classList.toggle('hidden', !show);
    if (!show) { hint.textContent = ''; hint.dataset.text = ''; }
  }

  function updateListeningText(text) {
    const hint = document.getElementById('assistantListenHint');
    if (hint) {
      hint.textContent = text;
      hint.dataset.text = text;
    }
  }

  /* ---------- 头像动画 ---------- */
  function setAvatarState(state) {
    const avatar = document.querySelector('.as-avatar-img');
    if (!avatar) return;
    avatar.classList.remove('speaking', 'thinking', 'idle');
    avatar.classList.add(state);
  }

  /* ---------- 窗口控制 ---------- */
  function toggleWindow() {
    setMinimized(!minimized);
    if (!minimized && chatHistory.length === 0) showWelcome();
  }

  function setMinimized(m) {
    minimized = m;
    if (chatWindow) chatWindow.classList.toggle('minimized', m);
    if (avatarBtn) avatarBtn.classList.toggle('hidden', !m);
    if (m) {
      stopSpeak();
      if (isListening && recognition) recognition.stop();
    }
  }

  /* ---------- 欢迎语 ---------- */
  function showWelcome() {
    const welcome = '你好呀～我是小风！🎋\n\n你可以直接对着麦克风说话问我问题，或者让我帮你操作界面。比如：「打开游戏」、「选茶叶生成明信片」、「介绍一下信阳毛尖」……\n\n想聊什么，直接说吧～';
    addMessage('assistant', welcome);
    speak(welcome);
  }

  /* ---------- 消息渲染 ---------- */
  function addMessage(role, text) {
    if (!msgList) return;
    const wrap = document.createElement('div');
    wrap.className = 'as-msg as-msg-' + role;
    const bubble = document.createElement('div');
    bubble.className = 'as-bubble';
    bubble.textContent = text;
    if (role === 'assistant') {
      const avatar = document.createElement('img');
      avatar.className = 'as-msg-avatar';
      avatar.src = 'images/assistant-avatar-new.jpg';
      avatar.alt = '小风';
      wrap.appendChild(avatar);
    }
    wrap.appendChild(bubble);
    msgList.appendChild(wrap);
    msgList.scrollTop = msgList.scrollHeight;
    return bubble;
  }

  function addTyping() {
    if (!msgList) return null;
    const wrap = document.createElement('div');
    wrap.className = 'as-msg as-msg-assistant';
    const avatar = document.createElement('img');
    avatar.className = 'as-msg-avatar';
    avatar.src = 'images/assistant-avatar-new.jpg';
    avatar.alt = '小风';
    const bubble = document.createElement('div');
    bubble.className = 'as-bubble as-typing';
    bubble.innerHTML = '<span></span><span></span><span></span>';
    wrap.appendChild(avatar);
    wrap.appendChild(bubble);
    msgList.appendChild(wrap);
    msgList.scrollTop = msgList.scrollHeight;
    return wrap;
  }

  /* ---------- 发送消息（语音输入后调用） ---------- */
  async function sendMessage(text) {
    if (!text || !text.trim()) return;
    text = text.trim();

    addMessage('user', text);
    chatHistory.push({ role: 'user', content: text });

    const typingEl = addTyping();
    setAvatarState('thinking');
    stopSpeak();

    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatHistory })
      });

      if (!resp.ok) throw new Error('API ' + resp.status);
      const data = await resp.json();

      if (typingEl) typingEl.remove();

      if (data.tool_calls && data.tool_calls.length > 0) {
        const toolCall = data.tool_calls[0];
        const result = executeToolCall(toolCall.name, toolCall.arguments);
        chatHistory.push({
          role: 'assistant',
          content: data.reply || '',
          tool_calls: data.tool_calls
        });
        chatHistory.push({
          role: 'tool',
          name: toolCall.name,
          content: JSON.stringify(result)
        });

        const actionText = data.reply || `好的，我来帮你${toolNameToText(toolCall.name)}～`;
        addMessage('assistant', actionText);
        speak(actionText);

        if (result && result.message) {
          setTimeout(() => {
            addMessage('assistant', result.message);
            speak(result.message);
          }, 800);
        }
      } else {
        const reply = data.reply || '抱歉，我没听清，能再说一次吗？';
        addMessage('assistant', reply);
        chatHistory.push({ role: 'assistant', content: reply });
        speak(reply);
      }
    } catch (e) {
      if (typingEl) typingEl.remove();
      const fallback = fallbackReply(text);
      addMessage('assistant', fallback);
      chatHistory.push({ role: 'assistant', content: fallback });
      speak(fallback);
    } finally {
      setAvatarState('idle');
    }
  }

  function toolNameToText(name) {
    const map = {
      goPage: '跳转页面',
      selectItem: '选择风物',
      selectStyle: '选择风格',
      generateArtwork: '生成文创',
      downloadArtwork: '下载作品',
      setPreviewMode: '切换预览',
      enableDemoMode: '开启演示模式',
      startLevel: '开始关卡'
    };
    return map[name] || '操作';
  }

  /* ---------- 工具调用执行 ---------- */
  function executeToolCall(name, argsStr) {
    let args = {};
    try { args = JSON.parse(argsStr); } catch (e) {}

    switch (name) {
      case 'goPage':
        if (args.page) goPage(args.page);
        return { success: true, message: `已切换到${pageName(args.page)}页面` };
      case 'selectItem':
        if (args.itemId) {
          if (document.getElementById('page-workshop').classList.contains('active')) {
            selectItem(args.itemId);
          } else {
            goPage('workshop');
            setTimeout(() => selectItem(args.itemId), 400);
          }
          return { success: true, message: `已为你选中「${itemName(args.itemId)}」` };
        }
        break;
      case 'selectStyle':
        if (args.styleId) {
          wsStyleId = args.styleId;
          wsGenerated = false;
          wsAiImage = null;
          renderStyles();
          renderTplBar();
          return { success: true, message: `已切换到${styleName(args.styleId)}风格` };
        }
        break;
      case 'generateArtwork':
        generateArtwork();
        return { success: true, message: 'AI 正在为你创作，请稍等片刻～' };
      case 'downloadArtwork':
        downloadArtwork();
        return { success: true, message: '正在下载文创成品' };
      case 'setPreviewMode':
        if (args.mode) {
          setPreviewMode(args.mode);
          return { success: true, message: `已切换到${args.mode === 'postcard' ? '明信片' : '茶叶礼盒'}预览` };
        }
        break;
      case 'enableDemoMode':
        enableDemoMode();
        return { success: true, message: '已开启演示模式，全部风物和关卡都解锁啦！' };
      case 'startLevel':
        if (typeof args.level === 'number') {
          if (document.getElementById('page-game').classList.contains('active')) {
            startLevel(args.level);
          } else {
            goPage('game');
            setTimeout(() => startLevel(args.level), 400);
          }
          return { success: true, message: `开始第${args.level + 1}关，加油哦！` };
        }
        break;
    }
    return { success: false, message: '抱歉，这个操作我暂时不会呢' };
  }

  function pageName(p) {
    return { home: '首页', game: '消除游戏', workshop: 'AI调色工坊', about: '关于' }[p] || p;
  }
  function itemName(id) {
    const item = getItem(id);
    return item ? item.name : id;
  }
  function styleName(id) {
    const s = getStyle(id);
    return s ? s.name : id;
  }

  /* ---------- 降级回复（本地规则库，覆盖常见问题） ---------- */
  function fallbackReply(text) {
    const t = text.toLowerCase();

    // 问候类
    if (/你好|^嗨$|^hi$|^hello$|^在吗$|^在嘛$|^干嘛$|^干什么呢$/.test(t))
      return '你好呀～我是小风！风物魔法调色派对的AI向导，有什么可以帮你的吗？';

    if (/早上好|中午好|晚上好|晚安/.test(t))
      return '你好呀～今天想创作点什么？我可以陪你玩游戏，也可以帮你生成文创作品哦～';

    // 自我介绍
    if (/你是谁|你叫什么|介绍一下你|你是干嘛的/.test(t))
      return '我是小风～风物魔法调色派对的AI向导！我会陪你玩游戏、帮你创作文创、回答关于信阳风物的问题。有什么想知道的尽管问我吧！';

    // 玩法介绍
    if (/怎么玩|玩法|这是什么|介绍.*项目|这是什么游戏/.test(t))
      return '风物魔法调色派对有两个核心玩法哦：\n\n1️⃣ 消除小游戏：8关 progressively 变难，点击两张相同风物卡片消除，通关解锁线稿和科普\n2️⃣ AI调色工坊：选线稿→挑艺术风格→AI生成国风小诗+上色→下载明信片或茶叶礼盒\n\n想体验哪个？直接说「打开游戏」或「去调色工坊」就行～';

    // 游戏相关
    if (/游戏|消除|关卡|通关|几关/.test(t))
      return '消除小游戏有8关呢，从4对卡片到16对，难度慢慢增加。三星评级看误点次数，通关还能解锁风物线稿和乡土科普哦！要不要我帮你打开游戏页面？';

    // 工坊相关
    if (/工坊|调色|生成|创作|明信片|礼盒|上色|风格/.test(t))
      return 'AI调色工坊是核心功能！选一张风物线稿，挑一个艺术风格（春日青绿/秋意赭黄/国潮艳彩/淡雅水墨），点AI魔法生成，就能得到一首国风小诗和上色插画，还能下载明信片和茶叶礼盒封面呢～';

    // 风物/信阳
    if (/风物|信阳|毛尖|茶叶|大别山|河南/.test(t))
      return '信阳在大别山区，物产超丰富！有中国十大名茶之一的信阳毛尖，还有板栗、南湾鱼、罗山甜柿、大别山香菇、春笋……一共12种风物线稿可以收集，每种都有乡土科普小知识哦。';

    // 具体风物询问
    if (/毛尖|龙井|茶叶|绿茶|红茶/.test(t))
      return '信阳毛尖是中国十大名茶之一，产自大别山区，特点就是「细圆光直多白毫」。1915年还在巴拿马万国博览会上拿了金奖呢！冲泡后汤色嫩绿，香气高雅，入口鲜爽回甘～';

    if (/板栗|栗子/.test(t))
      return '大别山板栗是国家地理标志产品，颗粒饱满、香甜软糯，秋天来一袋糖炒栗子，简直是人间美味～';

    if (/鱼|南湾|湖鲜/.test(t))
      return '南湾鱼产自信阳南湾湖，水质好所以鱼肉特别细嫩。鱼头炖汤是当地招牌菜，汤色奶白、鲜美无比，有机会一定要尝尝！';

    if (/荷花|莲花|荷叶/.test(t))
      return '信阳河湖众多，夏日荷塘处处可见。荷花不仅好看，莲子、莲藕还能入馔，荷叶包饭更是清香可口～';

    if (/银杏|白果/.test(t))
      return '大别山的古银杏一到深秋就满树金黄，超级壮观！银杏果又叫白果，可以入药也可以入膳，银杏树还被称为「活化石」呢。';

    // 演示模式
    if (/演示|全解锁|全部|作弊|解锁/.test(t))
      return '想要体验完整内容的话，我可以帮你开启演示模式，全部8个关卡和12种风物线稿都会解锁哦！需要我现在开启吗？';

    // 操作指令
    if (/打开|跳转|去.*页面|去.*首页|去.*游戏|去.*工坊|去.*关于/.test(t))
      return '你可以直接说「打开游戏」、「去调色工坊」、「打开关于页面」等，我可以帮你自动跳转哦～';

    if (/下载|保存|导出/.test(t))
      return '在AI调色工坊生成作品后，点击预览图下方的「下载PNG」按钮就能保存文创成品啦！支持明信片和茶叶礼盒两种模板哦～';

    // 技术/项目背景
    if (/技术|用什么|怎么做的|开发|代码|框架/.test(t))
      return '这个项目用了不少技术呢：前端是原生HTML+CSS+JS，AI能力通过Cloudflare Workers AI部署了Qwen3大语言模型和SDXL扩散模型，语音识别和语音合成用的是浏览器原生Web Speech API，部署在Cloudflare Pages上～';

    if (/比赛|大赛|参赛|赛道|获奖/.test(t))
      return '这是大学生AI应用创新大赛的参赛作品，赛道是「AI + 艺术文创应用」。项目立足河南信阳大别山本土风物，用AI降低乡土文创创作门槛，让人人都是乡土文创设计师！';

    // 天气/时间（通用知识）
    if (/天气|下雨|下雪|温度|气温/.test(t)) {
      const date = new Date();
      const hour = date.getHours();
      let timeDesc = '';
      if (hour < 12) timeDesc = '上午';
      else if (hour < 18) timeDesc = '下午';
      else timeDesc = '晚上';
      return `我现在没法获取实时天气数据呢～建议你打开天气APP看看。不过${timeDesc}适合泡一杯信阳毛尖，边喝茶边创作文创作品，岂不快哉～`;
    }

    if (/时间|几点|日期|今天几号|星期几/.test(t)) {
      const now = new Date();
      return `现在是 ${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}。时不我待，快来创作一幅风物文创吧～`;
    }

    // 情感/闲聊
    if (/无聊|没事|闲/.test(t))
      return '无聊的话来玩消除小游戏呀！或者去调色工坊创作一幅专属文创，我可以一步步带你操作哦～';

    if (/好看|漂亮|美|棒|厉害|牛/.test(t))
      return '谢谢夸奖呀～小风会继续努力的！你要不要也创作一幅漂亮的文创作品？';

    if (/难|不会|不懂|帮帮我|教教我/.test(t))
      return '别担心，我一步一步教你！消除小游戏很简单：找到两张一样的风物卡片，依次点击就能消除。AI调色工坊更简单了：选风物→选风格→点生成，三步搞定！';

    if (/加油|鼓励|我行吗|我能/.test(t))
      return '当然可以啦！你超棒的～来试试消除小游戏第一关，或者去调色工坊随便创作一幅作品，你会发现自己比想象中更厉害！';

    if (/谢谢|感谢|谢了/.test(t))
      return '不客气呀～祝你创作愉快！有需要随时找我哦 🎋';

    if (/再见|拜拜|bye|回头见/.test(t))
      return '再见啦～记得常来玩，小风随时在这里等你哦！拜拜 👋';

    if (/笑话|搞笑|幽默/.test(t))
      return '为什么茶叶不能去参加派对？因为它太「泡」了～哈哈，冷笑话一个，不要介意呀！';

    if (/饿|吃|美食|好吃/.test(t))
      return '说到吃的，信阳美食可多了！南湾鱼头汤、罗山大肠汤、信阳热干面、固始鹅块……说着说着我都饿了。要不你先创作一幅「南湾鱼」主题的文创，然后真的去吃一顿？';

    // 默认回复：不再敷衍，而是引导用户
    return '这个问题好有意思～不过我现在需要联网AI才能给你最完美的回答呢。\n\n你可以先试试这些：\n• 问我关于信阳风物的问题\n• 说「打开游戏」或「去调色工坊」让我帮你操作\n• 让我开启演示模式体验全部内容\n\n有什么想聊的随时说哦～';
  }

  /* ---------- 公开方法 ---------- */
  return {
    init,
    toggleWindow,
    speak
  };
})();
