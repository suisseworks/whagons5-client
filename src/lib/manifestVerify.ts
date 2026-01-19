import { api as apiClient } from '@/store/api/internalApi';
import * as ed25519 from '@noble/ed25519';

type Manifest = { kid: string; globalRoot: string; blockRoots: Array<{ id: number; hash: string }>; sig: string };

let cachedPub: Uint8Array | null = null;

async function getPublicKey(): Promise<Uint8Array> {
  if (cachedPub) return cachedPub;
  const resp = await apiClient.get('/crypto/public-key');
  const b64 = resp.data?.data?.pub;
  if (!b64) throw new Error('missing public key');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  cachedPub = out;
  return cachedPub;
}

function canonicalize(manifest: Manifest): Uint8Array {
  const obj = {
    kid: manifest.kid,
    globalRoot: manifest.globalRoot,
    blockRoots: [...manifest.blockRoots].sort((a, b) => a.id - b.id).map(b => ({ id: b.id, hash: b.hash })),
  };
  const json = JSON.stringify(obj);
  return new TextEncoder().encode(json);
}

export async function verifyManifest(manifest: Manifest): Promise<boolean> {
  const pub = await getPublicKey();
  const msg = canonicalize(manifest);
  const sigB64 = manifest.sig;
  if (!sigB64) return false;
  const sigBin = atob(sigB64);
  const sig = new Uint8Array(sigBin.length);
  for (let i = 0; i < sigBin.length; i++) sig[i] = sigBin.charCodeAt(i);
  return await ed25519.verify(sig, msg, pub);
}


