/* =====================================================
 * assistant.js  AI 向导「小风」：对话 + TTS 女声 + 工具调用
 * ===================================================== */

const Assistant = (() => {
  let chatHistory = [];       // 对话历史（不含 system prompt）
  let isSpeaking = false;
  let ttsEnabled = true;
  let voice = null;
  let chatWindow = null;
  let chatBubble = null;
  let chatInput = null;
  let msgList = null;
  let avatarBtn = null;
  let minimized = true;
  let firstTrigger = true;

  /* ---------- 初始化 ---------- */
  function init() {
    chatWindow = document.getElementById('assistantWindow');
    chatBubble = document.getElementById('assistantBubble');
    chatInput = document.getElementById('assistantInput');
    msgList = document.getElementById('assistantMessages');
    avatarBtn = document.getElementById('assistantAvatar');

    if (!chatWindow) return;

    avatarBtn.addEventListener('click', toggleWindow);
    document.getElementById('assistantClose').addEventListener('click', () => setMinimized(true));
    document.getElementById('assistantMute').addEventListener('click', toggleMute);
    document.getElementById('assistantSettings').addEventListener('click', toggleVoicePanel);
    document.getElementById('assistantSend').addEventListener('click', sendMessage);
    chatInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });

    initTTS();

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

    // 也可通过点击右下角小圆球主动唤醒
  }

  /* ---------- TTS 语音合成 ---------- */
  let allVoices = [];
  let voiceQueue = [];       // 分段朗读队列
  let queueIndex = 0;

  function initTTS() {
    if (!('speechSynthesis' in window)) {
      ttsEnabled = false;
      return;
    }
    const loadVoices = () => {
      allVoices = speechSynthesis.getVoices();
      pickBestVoice();
      populateVoiceSelector();
    };
    loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }
    const savedMute = localStorage.getItem('wm_tts_muted');
    if (savedMute === '1') ttsEnabled = false;
    updateMuteIcon();
  }

  /* 智能选音：优先御姐音，其次知性女声，再默认中文女声 */
  function pickBestVoice() {
    const zhVoices = allVoices.filter(v => /zh|chinese|中文|cmn|yue/i.test(v.lang));
    if (zhVoices.length === 0) { voice = allVoices[0]; return; }

    // 御姐/成熟女性语音关键词（按优先级排序）
    const matureKeywords = ['yaoyao', 'xiaoyi', 'yunxia', 'xiaohan', 'xiaoqiu'];
    for (const kw of matureKeywords) {
      const found = zhVoices.find(v => new RegExp(kw, 'i').test(v.name));
      if (found) { voice = found; return; }
    }
    // 次之：任何明确标记 female 的中文语音
    const female = zhVoices.find(v => /female|女/i.test(v.name));
    if (female) { voice = female; return; }
    // 兜底：第一个中文语音
    voice = zhVoices[0];
  }

  function populateVoiceSelector() {
    const sel = document.getElementById('assistantVoice');
    if (!sel) return;
    sel.innerHTML = '';
    allVoices.filter(v => /zh|chinese|中文|cmn|yue/i.test(v.lang)).forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.name;
      opt.textContent = v.name;
      if (voice && v.name === voice.name) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', e => {
      const chosen = allVoices.find(v => v.name === e.target.value);
      if (chosen) voice = chosen;
      localStorage.setItem('wm_tts_voice', e.target.value);
    });
    // 恢复上次选择
    const saved = localStorage.getItem('wm_tts_voice');
    if (saved) {
      const prev = allVoices.find(v => v.name === saved);
      if (prev) { voice = prev; sel.value = saved; }
    }
  }

  /* 分段朗读：按标点切分，逐句播放，更流畅自然 */
  function speak(text) {
    if (!ttsEnabled || !voice) return;
    stopSpeak();

    const clean = text.replace(/[*_`#]/g, '').replace(/<[^>]+>/g, '');
    // 按标点切分，保留标点；过滤空句
    voiceQueue = clean.split(/([，。？！；\n]+)/).filter(s => s.trim());
    // 把标点和前面的文字合并成一句
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
    utter.rate = 0.92;    // 稍慢更自然
    utter.pitch = 0.92;   // 稍低偏御姐
    utter.volume = 0.9;

    utter.onstart = () => { isSpeaking = true; setAvatarState('speaking'); };
    utter.onend = () => {
      queueIndex++;
      // 句间停顿 280ms，模拟自然呼吸
      setTimeout(() => playNextSegment(), 280);
    };
    utter.onerror = () => {
      queueIndex++;
      setTimeout(() => playNextSegment(), 280);
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

  function toggleVoicePanel() {
    const panel = document.getElementById('assistantVoicePanel');
    if (panel) panel.classList.toggle('hidden');
  }

  function updateMuteIcon() {
    const btn = document.getElementById('assistantMute');
    if (btn) btn.textContent = ttsEnabled ? '🔊' : '🔇';
  }

  /* ---------- 头像动画状态 ---------- */
  function setAvatarState(state) {
    const avatar = document.querySelector('.as-avatar-img');
    if (!avatar) return;
    avatar.classList.remove('speaking', 'thinking', 'idle');
    avatar.classList.add(state);
  }

  /* ---------- 窗口控制 ---------- */
  function toggleWindow() {
    setMinimized(!minimized);
    if (!minimized && chatHistory.length === 0) {
      showWelcome();
    }
  }

  function setMinimized(m) {
    minimized = m;
    if (chatWindow) chatWindow.classList.toggle('minimized', m);
    if (avatarBtn) avatarBtn.classList.toggle('hidden', !m);
    if (!m) {
      chatInput.focus();
    } else {
      stopSpeak();
    }
  }

  /* ---------- 欢迎语 ---------- */
  function showWelcome() {
    const welcome = '你好呀～我是风物魔法调色派对的AI向导小风！🎋\n\n在这里，你可以玩消除小游戏收集信阳风物，也可以用AI调色工坊创作专属文创明信片和茶叶礼盒。\n\n有什么想知道的，或者想让我帮你操作什么，随时告诉我哦～';
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
      const avatar = document.createElement('div');
      avatar.className = 'as-msg-avatar';
      avatar.textContent = '风';
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
    const avatar = document.createElement('div');
    avatar.className = 'as-msg-avatar';
    avatar.textContent = '风';
    const bubble = document.createElement('div');
    bubble.className = 'as-bubble as-typing';
    bubble.innerHTML = '<span></span><span></span><span></span>';
    wrap.appendChild(avatar);
    wrap.appendChild(bubble);
    msgList.appendChild(wrap);
    msgList.scrollTop = msgList.scrollHeight;
    return wrap;
  }

  /* ---------- 发送消息 ---------- */
  async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = '';

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

      // 处理工具调用
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

        // 显示操作说明
        const actionText = data.reply || `好的，我来帮你${toolNameToText(toolCall.name)}～`;
        addMessage('assistant', actionText);
        speak(actionText);

        // 执行工具后再请求一次 LLM 总结结果（简化：直接用工具返回结果）
        if (result && result.message) {
          setTimeout(() => {
            addMessage('assistant', result.message);
            speak(result.message);
          }, 800);
        }
      } else {
        // 纯文本回复
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

  /* ---------- 降级回复（API 失败时用本地规则） ---------- */
  function fallbackReply(text) {
    const t = text.toLowerCase();
    if (/你好|hi|hello|在吗|干嘛/i.test(t)) return '你好呀～我是小风！有什么我可以帮你的吗？';
    if (/怎么玩|玩法|介绍|什么是/i.test(t)) return '风物魔法调色派对有两个核心玩法哦：\n\n1️⃣ 消除小游戏：点击两张相同卡片消除，通关解锁风物线稿\n2️⃣ AI调色工坊：选线稿→挑风格→AI生成小诗和上色→下载明信片或礼盒\n\n想体验哪个？我可以带你去～';
    if (/游戏|消除|关卡|通关/i.test(t)) return '消除小游戏有8关呢，从4对卡片到16对，难度慢慢增加。通关还能解锁风物线稿和乡土科普哦！要不要我帮你打开游戏页面？';
    if (/工坊|调色|生成|创作|明信片|礼盒/i.test(t)) return 'AI调色工坊是核心功能呀！选一张风物线稿，挑一个喜欢的艺术风格，点一下AI魔法生成，就能得到一首国风小诗和上色插画，还能下载明信片和茶叶礼盒封面呢～';
    if (/风物|信阳|毛尖|茶叶|大别山/i.test(t)) return '信阳是个好地方呢！大别山区物产丰富，有信阳毛尖、板栗、南湾鱼、罗山甜柿……一共有12种风物线稿可以收集，每一种都有对应的乡土科普小知识哦。';
    if (/演示|全解锁|全部|作弊/i.test(t)) return '想要体验完整内容的话，可以开启演示模式，全部关卡和风物都会解锁哦！需要我帮你开启吗？';
    if (/你是谁|叫什么|介绍你自己/i.test(t)) return '我是小风～风物魔法调色派对的AI向导！我可以带你玩游戏、帮你创作文创、回答你关于信阳风物的各种问题。有什么想知道的尽管问我吧！';
    if (/谢谢|感谢|拜拜|再见/i.test(t)) return '不客气呀～祝你创作愉快！有需要随时找我哦 🎋';
    return '嗯嗯，我听到啦～不过我的AI大脑暂时需要休息一下。你可以先试试消除小游戏或者去调色工坊创作，等会儿再和我聊天吧！';
  }

  /* ---------- 公开方法 ---------- */
  return {
    init,
    toggleWindow,
    speak
  };
})();
