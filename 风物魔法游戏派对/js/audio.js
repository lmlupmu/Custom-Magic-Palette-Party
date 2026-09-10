/* =====================================================
 * audio.js  Web Audio 合成音效（无任何音频文件）
 * 单例 SoundFX 挂 window；懒初始化 AudioContext，
 * 首次用户交互时 resume，规避浏览器自动播放限制。
 * 开关状态存 localStorage 'wm_sound'（'1'/'0'，默认开）
 * ===================================================== */

const SoundFX = {
  enabled: (function () {
    try { return localStorage.getItem('wm_sound') !== '0'; } catch (e) { return true; }
  })(),
  _ctx: null,
  _unlockBound: false,

  /* 懒初始化 + suspended 时尝试 resume；首次交互再兜底 resume */
  _ensure() {
    if (!this._ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this._ctx = new AC();
      } catch (e) { return null; }
      if (!this._unlockBound) {
        this._unlockBound = true;
        const unlock = () => {
          if (this._ctx && this._ctx.state === 'suspended') this._ctx.resume().catch(() => {});
          document.removeEventListener('pointerdown', unlock);
          document.removeEventListener('keydown', unlock);
        };
        document.addEventListener('pointerdown', unlock);
        document.addEventListener('keydown', unlock);
      }
    }
    if (this._ctx.state === 'suspended') this._ctx.resume().catch(() => {});
    return this._ctx;
  },

  /* 基础单音：OscillatorNode + GainNode 包络，指数衰减防破音 */
  _tone(opt) {
    const ctx = this._ctx;
    const type = opt.type || 'sine';
    const freq = opt.freq || 440;
    const freqEnd = opt.freqEnd || null;
    const t = opt.t || 0;
    const dur = opt.dur || 0.1;
    const vol = opt.vol || 0.15;
    const decay = opt.decay || dur;
    const t0 = ctx.currentTime + t;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + decay + 0.05);
  },

  /* 每个音效的公共守卫：开关关闭或 AudioContext 不可用时静默返回 */
  _ok() {
    if (!this.enabled) return false;
    return !!this._ensure();
  },

  /* 翻牌：三角波 800→600Hz，60ms，轻快“嗒” */
  flip() {
    if (!this._ok()) return;
    this._tone({ type: 'triangle', freq: 800, freqEnd: 600, dur: 0.06, vol: 0.15 });
  },

  /* 消除成功：正弦五声双音 E5→A5，各 120ms 叠加泛音，清脆“叮” */
  match() {
    if (!this._ok()) return;
    [[659.25, 0], [880, 0.12]].forEach(pair => {
      this._tone({ type: 'sine', freq: pair[0], t: pair[1], dur: 0.12, vol: 0.15 });
      this._tone({ type: 'sine', freq: pair[0] * 2, t: pair[1], dur: 0.12, vol: 0.05 });
    });
  },

  /* 误点：低短 200Hz 方波 100ms，闷“咚” */
  miss() {
    if (!this._ok()) return;
    this._tone({ type: 'square', freq: 200, dur: 0.1, vol: 0.12 });
  },

  /* 通关：宫商角徵羽 C5 D5 E5 G5 A5 C6 琶音上行，每音 150ms，国风感 */
  clear() {
    if (!this._ok()) return;
    [523.25, 587.33, 659.25, 783.99, 880, 1046.5].forEach((f, i) =>
      this._tone({ type: 'sine', freq: f, t: i * 0.15, dur: 0.15, vol: 0.14, decay: 0.3 }));
  },

  /* 按钮/切换：极短 1000Hz 正弦 40ms */
  click() {
    if (!this._ok()) return;
    this._tone({ type: 'sine', freq: 1000, dur: 0.04, vol: 0.12 });
  },

  /* 解锁线稿：风铃感，1600Hz 正弦 + 指数衰减 600ms，叠高泛音 */
  unlock() {
    if (!this._ok()) return;
    this._tone({ type: 'sine', freq: 1600, dur: 0.6, vol: 0.12, decay: 0.6 });
    this._tone({ type: 'sine', freq: 3200, t: 0.02, dur: 0.5, vol: 0.04, decay: 0.5 });
  },

  /* AI 生成完成：C5 E5 G5 上行三音，柔和收束 */
  generate() {
    if (!this._ok()) return;
    [523.25, 659.25, 783.99].forEach((f, i) =>
      this._tone({ type: 'sine', freq: f, t: i * 0.1, dur: 0.18, vol: 0.13, decay: 0.32 }));
  },

  /* 开关切换并持久化；开启时顺手播一声 click 作为反馈 */
  toggle() {
    this.enabled = !this.enabled;
    try { localStorage.setItem('wm_sound', this.enabled ? '1' : '0'); } catch (e) { /* 存储不可用时仅内存态 */ }
    if (this.enabled) this.click();
    return this.enabled;
  }
};

window.SoundFX = SoundFX;
