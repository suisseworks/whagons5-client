export class StreamingTtsPlayer {
  private audioCtx: AudioContext | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private gain: GainNode | null = null;
  private baseVolume = 0.65;
  private ducked = false;
  private playheadTime = 0;
  private decodeChain: Promise<void> = Promise.resolve();
  private activeSources: Set<AudioBufferSourceNode> = new Set();

  /**
   * Called with a predicted wall-clock timestamp (performance.now-based) for when audio playback should begin.
   * Useful for dev-only latency metrics.
   */
  private onNextPlaybackScheduled: ((playbackStartPerfMs: number) => void) | null = null;

  async ensureStarted(): Promise<void> {
    if (!this.audioCtx) {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      this.audioCtx = new Ctx();
      // Light limiter/compressor to prevent "yelling" / clipping on hot TTS outputs.
      this.compressor = this.audioCtx.createDynamicsCompressor();
      // Conservative settings: tame peaks without sounding pumpy.
      this.compressor.threshold.value = -14; // dB
      this.compressor.knee.value = 18; // dB
      this.compressor.ratio.value = 4; // :1
      this.compressor.attack.value = 0.003; // seconds
      this.compressor.release.value = 0.25; // seconds

      this.gain = this.audioCtx.createGain();
      // Default lower than 1.0 to avoid "too loud" output; allow override via localStorage.
      // Set localStorage key `assistant:tts-volume` to a number in [0.0, 1.25].
      let vol = 0.65;
      try {
        const raw = localStorage.getItem("assistant:tts-volume");
        if (raw != null) {
          const n = Number(raw);
          if (Number.isFinite(n)) vol = n;
        }
      } catch {}
      this.baseVolume = Math.min(Math.max(vol, 0), 1.25);
      this.gain.gain.value = this.ducked ? this.baseVolume * 0.2 : this.baseVolume;

      // Chain: src -> compressor -> gain -> destination
      this.compressor.connect(this.gain);
      this.gain.connect(this.audioCtx.destination);
      this.playheadTime = this.audioCtx.currentTime;
    }
    if (this.audioCtx.state === "suspended") {
      try {
        await this.audioCtx.resume();
      } catch {
        // Autoplay restrictions: ignore and keep trying on next user gesture.
      }
    }
  }

  setDucked(ducked: boolean): void {
    this.ducked = ducked;
    if (this.gain) {
      try {
        this.gain.gain.value = this.ducked ? this.baseVolume * 0.2 : this.baseVolume;
      } catch {}
    }
  }

  /**
   * Enqueue a base64 MP3 chunk for playback.
   * If `onPlaybackScheduled` is provided, it will be invoked once (next chunk only) with an estimated
   * `performance.now()` timestamp for when playback should start.
   */
  enqueueBase64Mp3(
    audioBase64: string,
    onPlaybackScheduled?: (playbackStartPerfMs: number) => void
  ): void {
    if (!audioBase64) return;
    if (onPlaybackScheduled) this.onNextPlaybackScheduled = onPlaybackScheduled;
    this.decodeChain = this.decodeChain.then(async () => {
      await this.ensureStarted();
      if (!this.audioCtx || !this.gain) return;

      const arrayBuffer = base64ToArrayBuffer(audioBase64);
      let decoded: AudioBuffer;
      try {
        decoded = await this.audioCtx.decodeAudioData(arrayBuffer.slice(0));
      } catch (e) {
        // Chunk boundaries can occasionally be undecodable; skip gracefully.
        console.warn("[TTS] decodeAudioData failed, skipping chunk:", e);
        return;
      }

      const src = this.audioCtx.createBufferSource();
      src.buffer = decoded;
      // Route through compressor+gain chain.
      if (this.compressor) {
        src.connect(this.compressor);
      } else if (this.gain) {
        // Fallback (shouldn't happen): connect directly to gain.
        src.connect(this.gain);
      }
      this.activeSources.add(src);

      const now = this.audioCtx.currentTime;
      const startAt = Math.max(this.playheadTime, now + 0.05);
      try {
        src.start(startAt);
      } catch (e) {
        console.warn("[TTS] source.start failed:", e);
        this.activeSources.delete(src);
        return;
      }

      // Estimate playback start time in wall-clock (performance.now) space.
      // Note: this is an estimate; AudioContext scheduling is very accurate but decode time can vary.
      if (this.onNextPlaybackScheduled) {
        try {
          const deltaSec = Math.max(0, startAt - now);
          const perfStart = performance.now() + deltaSec * 1000;
          this.onNextPlaybackScheduled(perfStart);
        } catch {}
        this.onNextPlaybackScheduled = null;
      }

      src.onended = () => {
        this.activeSources.delete(src);
      };

      this.playheadTime = startAt + decoded.duration;
    });
  }

  /**
   * Stop current playback immediately, but keep the AudioContext alive.
   *
   * Important: closing the AudioContext on each turn can break subsequent TTS
   * due to autoplay/user-gesture restrictions. Use `dispose()` only when you
   * truly want to tear down audio (e.g., unmount).
   */
  stop(): void {
    for (const src of this.activeSources) {
      try {
        src.stop();
      } catch {}
    }
    this.activeSources.clear();
    this.decodeChain = Promise.resolve();
    this.onNextPlaybackScheduled = null;
    // Reset scheduler to "now" so the next chunk starts promptly.
    try {
      if (this.audioCtx) this.playheadTime = this.audioCtx.currentTime;
      else this.playheadTime = 0;
    } catch {
      this.playheadTime = 0;
    }
  }

  /**
   * Fully tear down audio resources (closes the AudioContext).
   * Call this on component unmount / when the widget is closed.
   */
  dispose(): void {
    this.stop();
    const ctx = this.audioCtx;
    this.audioCtx = null;
    this.compressor = null;
    this.gain = null;
    this.ducked = false;
    try {
      void ctx?.close();
    } catch {}
  }
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

