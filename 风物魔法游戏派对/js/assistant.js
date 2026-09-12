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
      updateListeningText(interimTranscript || finalTranscript);
    };

    recognition.onerror = (event) => {
      isListening = false;
      setMicState('idle');
      setAvatarState('idle');
      showListeningHint(false);
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
      if (isListening) {
        // 正常结束：获取最终结果并发送
        isListening = false;
        setMicState('idle');
        setAvatarState('idle');
        showListeningHint(false);
        // 最后一次结果在 onresult 中已处理，这里通过 DOM 读取
        const hintEl = document.getElementById('assistantListenHint');
        if (hintEl && hintEl.dataset.text) {
          const text = hintEl.dataset.text.trim();
          if (text) sendMessage(text);
        }
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

  /* ---------- 降级回复 ---------- */
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
