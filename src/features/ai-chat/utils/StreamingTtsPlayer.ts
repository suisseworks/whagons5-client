export class StreamingTtsPlayer {
  private audioCtx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private playheadTime = 0;
  private decodeChain: Promise<void> = Promise.resolve();
  private activeSources: Set<AudioBufferSourceNode> = new Set();

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

  enqueueBase64Mp3(audioBase64: string): void {
    if (!audioBase64) return;
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

