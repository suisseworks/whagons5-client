export class StreamingTtsPlayer {
  private audioCtx: AudioContext | null = null;
  private gain: GainNode | null = null;
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
      this.gain = this.audioCtx.createGain();
      this.gain.gain.value = 1.0;
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
      src.connect(this.gain);
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

  stop(): void {
    for (const src of this.activeSources) {
      try {
        src.stop();
      } catch {}
    }
    this.activeSources.clear();
    this.playheadTime = 0;
    this.decodeChain = Promise.resolve();
    const ctx = this.audioCtx;
    this.audioCtx = null;
    this.gain = null;
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

