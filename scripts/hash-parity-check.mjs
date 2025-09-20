// Node script to verify that frontend hashing (client-side serialization) matches
// backend stored hashes in wh_row_hashes/wh_block_hashes/wh_table_hashes.
//
// Usage (Node 18+):
//   API_BASE_URL=http://mexico.localhost:8000/api API_TOKEN=YOUR_BEARER_TOKEN node scripts/hash-parity-check.mjs --table wh_tasks
//   API_BASE_URL=... API_TOKEN=... node scripts/hash-parity-check.mjs --table wh_tasks --block 0
//   API_BASE_URL=... API_TOKEN=... node scripts/hash-parity-check.mjs --table wh_categories
//
// Notes:
// - API_BASE_URL must point to the backend /api root.
// - API_TOKEN must be a valid Bearer token for your API (same as the client app uses).
// - --table must be one of: wh_tasks, wh_categories, wh_teams, wh_workspaces
// - If --block is omitted, all blocks are verified. Otherwise only that block is checked.

import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Try to load .env from current or parent directories if API_* vars are missing
function loadEnvFallback() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const candidates = [
    path.resolve(__dirname, '..', '.env'),
    path.resolve(__dirname, '..', '..', '.env'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8');
        for (const line of content.split(/\r?\n/)) {
          if (!line || line.trim().startsWith('#')) continue;
          const idx = line.indexOf('=');
          if (idx === -1) continue;
          const key = line.slice(0, idx).trim();
          let val = line.slice(idx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!(key in process.env)) process.env[key] = val;
        }
        break; // stop after first .env found
      }
    } catch {}
  }
}

loadEnvFallback();

// ---------- Config ----------
const API_BASE_URL = process.env.API_BASE_URL;
const API_TOKEN = process.env.API_TOKEN;
if (!API_BASE_URL || !API_TOKEN) {
  console.error('Missing API_BASE_URL or API_TOKEN.');
  process.exit(1);
}

// robust arg parsing: --key=value or --key value
const args = new Map();
for (let i = 2; i < process.argv.length; i++) {
  const tok = process.argv[i];
  if (tok.startsWith('--')) {
    const body = tok.slice(2);
    if (body.includes('=')) {
      const [k, v] = body.split('=');
      if (k) args.set(k, v);
    } else {
      const k = body;
      const next = process.argv[i + 1];
      if (next && !next.startsWith('--')) {
        args.set(k, next);
        i++;
      } else {
        args.set(k, true);
      }
    }
  }
}

const TABLE = args.get('table') ?? 'wh_tasks';
const ONLY_BLOCK = args.has('block') ? parseInt(args.get('block')) : null;
const specifiedVariant = args.get('variant');
const VARIANT = specifiedVariant || (TABLE === 'wh_workspaces' ? 'pg' : (TABLE === 'wh_categories' ? 'tf' : 'client')); // client | pg | tf | truefalse
const PROBE = args.has('probe'); // try multiple variants on mismatches
const PRINT_ROW = args.has('print-row'); // print row string used for hashing

// Support connecting to a different network endpoint while preserving the original Host header
// Example: API_BASE_URL=http://mexico.localhost:8000/api CONNECT_HOST=127.0.0.1:8000
let CONNECT_HOST = process.env.CONNECT_HOST || null;
let baseURL = API_BASE_URL;
let extraHeaders = {};
try {
  const u = new URL(API_BASE_URL);
  // Auto fallback: if hostname ends with .localhost and no CONNECT_HOST provided, default to 127.0.0.1:port
  if (!CONNECT_HOST && u.hostname.endsWith('.localhost')) {
    CONNECT_HOST = `127.0.0.1:${u.port || (u.protocol === 'https:' ? '443' : '80')}`;
  }
  if (CONNECT_HOST) {
    const [chost, cport] = CONNECT_HOST.split(':');
    const newUrl = new URL(API_BASE_URL);
    newUrl.hostname = chost;
    if (cport) newUrl.port = cport;
    baseURL = newUrl.toString();
    extraHeaders.Host = u.host;
  }
} catch {}

const api = axios.create({
  baseURL,
  headers: { Authorization: `Bearer ${API_TOKEN}`, ...extraHeaders },
  timeout: 60000,
});

const sha256Hex = (s) => crypto.createHash('sha256').update(s).digest('hex');

// Helpers to emulate Postgres jsonb::text formatting
function pgJsonText(input) {
  const toText = (value) => {
    if (value === null) return 'null';
    const type = typeof value;
    if (type === 'number' || type === 'bigint') return String(value);
    if (type === 'boolean') return value ? 'true' : 'false';
    if (type === 'string') return JSON.stringify(value);
    if (Array.isArray(value)) {
      return '[' + value.map(v => toText(v)).join(', ') + ']';
    }
    if (type === 'object') {
      const keys = Object.keys(value).sort();
      const parts = [];
      for (const k of keys) {
        const keyText = JSON.stringify(k);
        const valText = toText(value[k]);
        parts.push(keyText + ': ' + valText);
      }
      return '{' + parts.join(', ') + '}';
    }
    return '';
  };
  if (input === undefined) return '';
  try { return toText(input); } catch { return ''; }
}

function boolText(value, style) {
  // style: '10' | 'tf' | 'truefalse'
  switch (style) {
    case 'tf': return value ? 't' : 'f';
    case 'truefalse': return value ? 'true' : 'false';
    case '10':
    default:
      return value ? '1' : '0';
  }
}

function epochOrEmpty(v) {
  if (!v) return '';
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? String(t) : '';
}

// Frontend-equivalent serializers
function serializeTask(t) {
  return [
    t.id,
    t.name || '',
    t.description || '',
    t.workspace_id,
    t.category_id,
    t.team_id,
    t.template_id || 0,
    t.spot_id || 0,
    t.status_id,
    t.priority_id,
    epochOrEmpty(t.start_date),
    epochOrEmpty(t.due_date),
    t.expected_duration,
    epochOrEmpty(t.response_date),
    epochOrEmpty(t.resolution_date),
    t.work_duration,
    t.pause_duration,
    new Date(t.updated_at).getTime()
  ].join('|');
}

function serializeCategory(c, options = {}) {
  const boolStyle = options.boolStyle || (VARIANT === 'pg' ? 'tf' : VARIANT === 'tf' ? 'tf' : VARIANT === 'truefalse' ? 'truefalse' : '10');
  return [
    c.id,
    c.name || '',
    c.description || '',
    c.color || '',
    c.icon || '',
    boolText(!!c.enabled, boolStyle),
    c.sla_id || 0,
    c.team_id,
    c.workspace_id,
    new Date(c.updated_at).getTime()
  ].join('|');
}

function serializeTeam(t) {
  return [
    t.id,
    t.name || '',
    t.description || '',
    t.color || '',
    new Date(t.updated_at).getTime()
  ].join('|');
}

function serializeWorkspace(w, options = {}) {
  const jsonStyle = options.jsonStyle || (VARIANT === 'pg' ? 'pg' : 'json');
  const teamsText = w.teams == null ? '' : (jsonStyle === 'pg' ? pgJsonText(w.teams) : JSON.stringify(w.teams));
  const spotsText = w.spots == null ? '' : (jsonStyle === 'pg' ? pgJsonText(w.spots) : JSON.stringify(w.spots));
  return [
    w.id,
    w.name || '',
    w.description || '',
    w.color || '',
    w.icon || '',
    teamsText,
    w.type || '',
    w.category_id || 0,
    spotsText,
    w.created_by,
    new Date(w.updated_at).getTime()
  ].join('|');
}

function getSerializer(table) {
  switch (table) {
    case 'wh_tasks': return (row, opts) => serializeTask(row);
    case 'wh_categories': return (row, opts) => serializeCategory(row, opts);
    case 'wh_teams': return (row, opts) => serializeTeam(row);
    case 'wh_workspaces': return (row, opts) => serializeWorkspace(row, opts);
    default: throw new Error(`Unsupported table ${table}`);
  }
}

function getResourcePath(table) {
  switch (table) {
    case 'wh_tasks': return 'tasks';
    case 'wh_categories': return 'categories';
    case 'wh_teams': return 'teams';
    case 'wh_workspaces': return 'workspaces';
    default: throw new Error(`Unsupported table ${table}`);
  }
}

async function fetchRowsByIds(table, ids) {
  const path = getResourcePath(table);
  const resp = await api.get(`/${path}`, { params: { ids: ids.join(','), per_page: ids.length, page: 1 } });
  return resp.data.data || resp.data.rows || [];
}

async function verifyBlock(table, blockId) {
  const [rowsResp, blocksResp] = await Promise.all([
    api.get(`/integrity/blocks/${blockId}/rows`, { params: { table } }),
    api.get('/integrity/blocks', { params: { table } }),
  ]);
  const serverRowHashes = rowsResp.data.data || [];
  const blockMeta = (blocksResp.data.data || []).find(b => b.block_id === blockId);
  const ids = serverRowHashes.map(r => r.row_id);

  // Batch fetch entities
  const chunk = 200;
  const entities = [];
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const page = await fetchRowsByIds(table, slice);
    entities.push(...page);
  }
  const entityIdSet = new Set(entities.map(e => e.id));
  const missingIds = ids.filter(id => !entityIdSet.has(id));

  const serialize = getSerializer(table);
  const mismatches = [];
  const pairs = [];
  for (const e of entities) {
    const rowString = serialize(e, {});
    const clientHash = sha256Hex(rowString);
    const server = serverRowHashes.find(r => r.row_id === e.id)?.row_hash;
    const record = { id: e.id, clientHash, serverHash: server };
    if (PRINT_ROW) record.row = rowString;
    // Probe alternative variants to detect expected server formatting
    if (server && clientHash !== server && PROBE) {
      const variants = [];
      if (table === 'wh_categories') {
        variants.push({ name: 'bool=tf', opts: { boolStyle: 'tf' } });
        variants.push({ name: 'bool=truefalse', opts: { boolStyle: 'truefalse' } });
        variants.push({ name: 'bool=10', opts: { boolStyle: '10' } });
      }
      if (table === 'wh_workspaces') {
        variants.push({ name: 'json=pg', opts: { jsonStyle: 'pg' } });
        variants.push({ name: 'json=json', opts: { jsonStyle: 'json' } });
      }
      for (const v of variants) {
        const s = serialize(e, v.opts);
        const h = sha256Hex(s);
        if (h === server) {
          record.matchingVariant = v.name;
          if (PRINT_ROW) record.variantRow = s;
          break;
        }
      }
    }
    pairs.push(record);
    if (!server || server !== clientHash) mismatches.push(record);
  }

  // Compute client-side block hash
  pairs.sort((a,b) => a.id - b.id);
  const blockConcat = pairs.map(p => p.clientHash).join('');
  const clientBlockHash = sha256Hex(blockConcat);
  const serverBlockHash = blockMeta?.block_hash;

  // Recompute server block hash directly from server row hashes for sanity
  const serverRowsConcat = serverRowHashes
    .slice()
    .sort((a,b) => a.row_id - b.row_id)
    .map(r => r.row_hash)
    .join('');
  const serverRecalcBlockHash = sha256Hex(serverRowsConcat);
  const serverMetaMatchesRows = !!serverBlockHash && serverBlockHash === serverRecalcBlockHash;
  const clientMatchesServerRows = clientBlockHash === serverRecalcBlockHash;

  return {
    blockId,
    ids: ids.length,
    missingIds,
    mismatches,
    clientBlockHash,
    serverBlockHash,
    serverRecalcBlockHash,
    blockHashEqual: !!serverBlockHash && clientBlockHash === serverBlockHash,
    serverMetaMatchesRows,
    clientMatchesServerRows,
  };
}

async function main() {
  console.log('API:', API_BASE_URL, 'TABLE:', TABLE, ONLY_BLOCK !== null ? `BLOCK:${ONLY_BLOCK}` : '(all blocks)', 'VARIANT:', VARIANT);

  // Global compare first
  const [blocksResp, globalResp] = await Promise.all([
    api.get('/integrity/blocks', { params: { table: TABLE } }),
    api.get('/integrity/global', { params: { table: TABLE } }),
  ]);
  const blocks = blocksResp.data.data || [];
  const serverGlobal = globalResp.data?.data?.global_hash || null;

  const blocksToCheck = ONLY_BLOCK !== null ? blocks.filter(b => b.block_id === ONLY_BLOCK) : blocks;
  if (blocksToCheck.length === 0) {
    console.log('No blocks on server. Consider rebuilding hashes.');
    process.exit(0);
  }

  const results = [];
  for (const b of blocksToCheck) {
    console.log(`Verifying block ${b.block_id} ...`);
    results.push(await verifyBlock(TABLE, b.block_id));
  }

  // Compute client global from client block hashes
  const clientGlobalConcat = results
    .slice()
    .sort((a,b) => a.blockId - b.blockId)
    .map(r => r.clientBlockHash)
    .join('');
  const clientGlobalHash = sha256Hex(clientGlobalConcat);

  const totalRows = results.reduce((acc, r) => acc + r.ids, 0);
  const totalMismatches = results.reduce((acc, r) => acc + r.mismatches.length, 0);
  const blockHashEqualCount = results.filter(r => r.blockHashEqual).length;
  const blockMetaMismatch = results.filter(r => !r.serverMetaMatchesRows).length;
  const blocksClientEqServerRows = results.filter(r => r.clientMatchesServerRows).length;

  console.log('\nSummary');
  console.log('========');
  console.log('Blocks checked:', results.length, '/', blocks.length);
  console.log('Rows checked:', totalRows);
  console.log('Row hash mismatches:', totalMismatches);
  console.log('Blocks with equal block_hash:', blockHashEqualCount);
  console.log('Blocks where server meta != recomputed rows hash:', blockMetaMismatch);
  console.log('Blocks where client block hash == recomputed rows hash:', blocksClientEqServerRows);
  console.log('Client global hash:', clientGlobalHash);
  console.log('Server global hash:', serverGlobal);
  console.log('Global equal:', !!serverGlobal && clientGlobalHash === serverGlobal);

  if (totalMismatches) {
    console.log('\nFirst 10 mismatches (id, clientHash, serverHash):');
    const sample = results.flatMap(r => r.mismatches.slice(0, 10)).slice(0, 10);
    for (const m of sample) console.log(m);
  }
}

main().catch((err) => {
  console.error('Error:', err?.response?.data || err);
  process.exit(1);
});


