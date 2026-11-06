class SoundManager {
  private ctx: AudioContext | null = null;
  private sfxEnabled = true;
  private musicEnabled = true;
  private isPlayingMusic = false;
  private jetpackMode = false;
  private musicTimer: number | null = null;
  private stepIndex = 0;
  private tempoBpm = 114;
  private noiseBuffer: AudioBuffer | null = null;

  public setPrefs(sfx: boolean, music: boolean) {
    this.sfxEnabled = sfx;
    this.musicEnabled = music;
    if (!music) {
      this.stopMusic();
    }
  }

  public getPrefs() {
    return { sfx: this.sfxEnabled, music: this.musicEnabled };
  }

  public unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.createNoiseBuffer();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private createNoiseBuffer() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 1.0;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  public setDynamicTempo(speedRatio: number, jetpack: boolean) {
    // speedRatio 0..1 -> 114 to 132 BPM
    this.tempoBpm = 114 + Math.min(1, Math.max(0, speedRatio)) * 18;
    this.jetpackMode = jetpack;
  }

  public startMusic() {
    this.unlock();
    if (!this.musicEnabled || this.isPlayingMusic) return;
    this.isPlayingMusic = true;
    this.stepIndex = 0;
    this.scheduleNextStep();
  }

  public stopMusic() {
    this.isPlayingMusic = false;
    if (this.musicTimer !== null) {
      window.clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private scheduleNextStep = () => {
    if (!this.isPlayingMusic || !this.musicEnabled) return;
    if (this.ctx && this.ctx.state === 'running') {
      this.playBeatStep(this.stepIndex);
    }
    this.stepIndex = (this.stepIndex + 1) % 16;
    const sixteenthMs = (60 / this.tempoBpm / 4) * 1000;
    this.musicTimer = window.setTimeout(this.scheduleNextStep, sixteenthMs);
  };

  private playBeatStep(step: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Boom-bap / Funk Kick on 0, 3, 8, 10
    if (step === 0 || step === 3 || step === 8 || step === 10) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(135, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.11);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.14);
    }

    // Crisp Snare on 4 and 12
    if ((step === 4 || step === 12) && this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1600, now);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      src.start(now);
      src.stop(now + 0.12);
    }

    // Hi-hat groove
    if (step % 2 === 0 && this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(7000, now);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(step % 4 === 2 ? 0.035 : 0.02, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      src.start(now);
      src.stop(now + 0.045);
    }

    // Funky minor pentatonic subway bassline (C2, Eb2, F2, G2, Bb2)
    const bassPattern: (number | null)[] = [
      65.41, null, 65.41, 77.78,
      null, 87.31, null, 98.0,
      65.41, null, 116.54, null,
      98.0, null, 77.78, 87.31,
    ];
    const bassFreq = bassPattern[step];
    if (bassFreq) {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(this.jetpackMode ? bassFreq * 2 : bassFreq, now);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(this.jetpackMode ? 1100 : 480, now);
      filter.frequency.exponentialRampToValueAtTime(180, now + 0.13);
      gain.gain.setValueAtTime(0.075, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    }

    // Bright street-synth chord stab on off-beats or soaring jetpack arps
    if (this.jetpackMode && step % 2 === 0) {
      const arpNotes = [523.25, 622.25, 783.99, 932.33, 1046.5, 932.33, 783.99, 622.25];
      const note = arpNotes[(step / 2) % arpNotes.length];
      this.triggerTone(note, 'triangle', 0.045, 0.11);
    } else if (step === 6 || step === 14) {
      this.triggerTone(step === 6 ? 523.25 : 622.25, 'triangle', 0.032, 0.08);
      this.triggerTone(step === 6 ? 783.99 : 932.33, 'sine', 0.025, 0.08);
    }
  }

  private triggerTone(freq: number, type: OscillatorType, volume: number, duration: number, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.01);
  }

  public playCoin(streak = 0) {
    this.unlock();
    if (!this.sfxEnabled || !this.ctx) return;
    // Ascending pentatonic sparkle up to 16 coins
    const semitones = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
    const idx = Math.min(streak, semitones.length - 1);
    const baseFreq = 880 * Math.pow(2, semitones[idx] / 12);
    this.triggerTone(baseFreq, 'sine', 0.11, 0.09, 0);
    this.triggerTone(baseFreq * 1.5, 'triangle', 0.07, 0.13, 0.035);
  }

  public playSwipe() {
    this.unlock();
    if (!this.sfxEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.075);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.085);
  }

  public playJump(superJump = false) {
    this.unlock();
    if (!this.sfxEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = superJump ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(superJump ? 240 : 210, now);
    osc.frequency.exponentialRampToValueAtTime(superJump ? 920 : 560, now + (superJump ? 0.22 : 0.14));
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (superJump ? 0.24 : 0.15));
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playRoll(fastDrop = false) {
    this.unlock();
    if (!this.sfxEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (fastDrop) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(85, now + 0.11);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    }
    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(900, now);
      filter.frequency.exponentialRampToValueAtTime(350, now + 0.16);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      src.start(now);
      src.stop(now + 0.18);
    }
  }

  public playWhistleAndBark() {
    this.unlock();
    if (!this.sfxEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Inspector's shrill pea-whistle
    const whistle = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const wGain = this.ctx.createGain();

    whistle.type = 'sine';
    whistle.frequency.setValueAtTime(2750, now);
    whistle.frequency.setValueAtTime(2920, now + 0.08);

    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(38, now);
    lfoGain.gain.setValueAtTime(140, now);

    lfo.connect(lfoGain);
    lfoGain.connect(whistle.frequency);

    wGain.gain.setValueAtTime(0.09, now);
    wGain.gain.setValueAtTime(0.1, now + 0.18);
    wGain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);

    whistle.connect(wGain);
    wGain.connect(this.ctx.destination);
    lfo.start(now);
    whistle.start(now);
    lfo.stop(now + 0.35);
    whistle.stop(now + 0.35);

    // Guard dog double bark ("woof! woof!")
    [0.18, 0.34].forEach((offset) => {
      if (!this.ctx) return;
      const t = now + offset;
      const bark = this.ctx.createOscillator();
      const bGain = this.ctx.createGain();
      bark.type = 'sawtooth';
      bark.frequency.setValueAtTime(210, t);
      bark.frequency.exponentialRampToValueAtTime(320, t + 0.03);
      bark.frequency.exponentialRampToValueAtTime(115, t + 0.11);
      bGain.gain.setValueAtTime(0.1, t);
      bGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      bark.connect(bGain);
      bGain.connect(this.ctx.destination);
      bark.start(t);
      bark.stop(t + 0.13);
    });
  }

  public playStumble() {
    this.unlock();
    if (!this.sfxEnabled || !this.ctx) return;
    // Side scrape thud + inspector whistle
    this.triggerTone(110, 'sawtooth', 0.18, 0.16, 0);
    this.playWhistleAndBark();
  }

  public playPowerup() {
    this.unlock();
    if (!this.sfxEnabled || !this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.triggerTone(n, 'triangle', 0.12, 0.16, idx * 0.055);
    });
  }

  public playHoverboardStart() {
    this.unlock();
    if (!this.sfxEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.28);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.33);
    this.triggerTone(880, 'sine', 0.1, 0.22, 0.12);
  }

  public playHoverboardBlast() {
    this.unlock();
    if (!this.sfxEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Big plasma shield burst
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.4);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.44);

    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const gainN = this.ctx.createGain();
      gainN.gain.setValueAtTime(0.18, now);
      gainN.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      src.connect(gainN);
      gainN.connect(this.ctx.destination);
      src.start(now);
      src.stop(now + 0.36);
    }

    // Heroic save chord
    this.triggerTone(523.25, 'triangle', 0.1, 0.25, 0.08);
    this.triggerTone(783.99, 'triangle', 0.1, 0.28, 0.12);
  }

  public playTrainHorn() {
    this.unlock();
    if (!this.sfxEnabled || !this.ctx) return;
    // Classic urban metro dual-tone warning horn
    this.triggerTone(311.13, 'sawtooth', 0.055, 0.28, 0);
    this.triggerTone(369.99, 'sawtooth', 0.055, 0.28, 0);
  }

  public playCrash() {
    this.unlock();
    if (!this.sfxEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Impact crunch
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(175, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.38);
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.42);

    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now);
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.2, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      src.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.ctx.destination);
      src.start(now);
      src.stop(now + 0.34);
    }

    this.playWhistleAndBark();
  }
}

export const sound = new SoundManager();
