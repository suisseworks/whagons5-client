import { DB } from './DB';

type AvatarRow = {
  id: number | string;
  data: string; // data URL (base64)
  timestamp: number; // ms since epoch
  url?: string | null;
};

export class AvatarCache {
  private static readonly STORE = 'avatars';
  private static readonly TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
  private static initPromise: Promise<boolean> | null = null;
  private static memory: Map<string | number, AvatarRow> = new Map();
  private static pending: Map<string | number, Promise<string | null>> = new Map();

  public static async init(): Promise<boolean> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      await DB.init();
      // Avatars are not sensitive; disable encryption to avoid perf overhead
      try { DB.setEncryptionForStore(this.STORE, false); } catch {}
      return true;
    })();
    try { return await this.initPromise; } finally { this.initPromise = null; }
  }

  private static isExpired(ts: number): boolean {
    return Date.now() - ts > this.TTL_MS;
  }

  public static async getRow(userId: number | string): Promise<AvatarRow | null> {
    await this.init();
    const mem = this.memory.get(userId);
    if (mem && !this.isExpired(mem.timestamp)) return mem;

    const row = (await DB.get(this.STORE as any, userId)) as AvatarRow | null;
    if (!row) return null;
    if (!row.timestamp || this.isExpired(row.timestamp)) {
      try { await DB.delete(this.STORE as any, userId); } catch {}
      this.memory.delete(userId);
      return null;
    }
    this.memory.set(userId, row);
    return row;
  }

  public static async get(userId: number | string): Promise<string | null> {
    const row = await this.getRow(userId);
    return row?.data || null;
  }

  public static async put(userId: number | string, dataUrl: string, url?: string | null): Promise<void> {
    await this.init();
    const payload: AvatarRow = { id: userId, data: dataUrl, timestamp: Date.now(), url: url ?? null };
    await DB.put(this.STORE as any, payload);
    this.memory.set(userId, payload);
  }

  public static async getByAny(ids: Array<number | string | undefined | null>): Promise<string | null> {
    await this.init();
    for (const id of ids) {
      if (id == null) continue;
      const v = await this.get(id);
      if (v) return v;
    }
    return null;
  }

  public static async getByAnyRow(ids: Array<number | string | undefined | null>): Promise<AvatarRow | null> {
    await this.init();
    for (const id of ids) {
      if (id == null) continue;
      const row = await this.getRow(id);
      if (row) return row;
    }
    return null;
  }

  public static async putUnderAliases(primaryId: number | string, dataUrl: string, url?: string | null, aliases?: Array<number | string | undefined | null>): Promise<void> {
    await this.put(primaryId, dataUrl, url);
    if (aliases && aliases.length) {
      for (const a of aliases) {
        if (a == null) continue;
        try {
          const existing = await this.get(a);
          if (!existing) await this.put(a, dataUrl, url);
        } catch {}
      }
    }
  }

  public static async fetchAndCache(userId: number | string, url?: string | null, aliases?: Array<number | string | undefined | null>): Promise<string | null> {
    await this.init();
    if (!url) return null;
    if (this.pending.has(userId)) return this.pending.get(userId)!;

    const job = (async () => {
      try {
      const resp = await fetch(url);
      if (!resp.ok) {
        if (resp.status === 429) return null;
        return null;
      }
      const blob = await resp.blob();

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('reader error'));
        reader.readAsDataURL(blob);
      });
      await this.putUnderAliases(userId, dataUrl, url, aliases);
      return dataUrl;
      } catch {
        return null;
      } finally {
        this.pending.delete(userId);
      }
    })();
    this.pending.set(userId, job);
    return job;
  }

  public static async getOrFetch(userId: number | string, url?: string | null, aliases?: Array<number | string | undefined | null>): Promise<string | null> {
    const cached = await this.getByAny([userId, ...(aliases || [])]);
    if (cached) return cached;
    return await this.fetchAndCache(userId, url, aliases);
  }

  public static async delete(userId: number | string): Promise<void> {
    await this.init();
    try {
      await DB.delete(this.STORE as any, userId);
      this.memory.delete(userId);
      // Also clear from pending requests
      this.pending.delete(userId);
      console.log('AvatarCache: Deleted cache for', userId);
    } catch (error) {
      console.error('AvatarCache: Error deleting cache for', userId, error);
    }
  }

  public static async deleteByAny(ids: Array<number | string | undefined | null>): Promise<void> {
    await this.init();
    console.log('AvatarCache: deleteByAny called with ids:', ids);
    for (const id of ids) {
      if (id == null) continue;
      await this.delete(id);
    }
    console.log('AvatarCache: deleteByAny completed');
  }
}


