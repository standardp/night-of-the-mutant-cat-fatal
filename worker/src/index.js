// Claim backend for Night of the Mutant Cat + FATAL (NEAR testnet, test token, no market value).
// Endpoints (JSON, CORS open):
//   POST /welcome {account}        one-time 8 FATAL per wallet (also registers token storage)
//   POST /start   {account, tx}    verifies the on-chain 8 FATAL entry fee, opens a play session
//   POST /win     {session}        pays 10 FATAL once per paid session
import { Account } from '@near-js/accounts';
import { KeyPairSigner } from '@near-js/signers';
import { JsonRpcProvider } from '@near-js/providers';
import { KeyPair } from '@near-js/crypto';

const FEE = 8n, WELCOME = 8n, PRIZE = 10n;
const MIN_PLAY_SECONDS = 90;      // a real win takes longer than this
const DAILY_PRIZES_PER_WALLET = 20;
const MAX_WELCOMES = 2000;        // total welcome grants ever (caps Sybil farming)
const SESSION_TTL = 6 * 3600;

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST,GET,OPTIONS' };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', ...cors } });

function chain(env) {
  const provider = new JsonRpcProvider({ url: env.RPC_URL || 'https://rpc.testnet.near.org' });
  const signer = new KeyPairSigner(KeyPair.fromString(env.TREASURY_KEY));
  const treasury = new Account(env.TREASURY, provider, signer);
  return { provider, treasury };
}
async function view(provider, contract, method, args) {
  const r = await provider.callFunction(contract, method, args);
  return r;
}
async function send(env, ch, method, args, deposit = 1n) {
  return ch.treasury.callFunction({ contractId: env.CONTRACT, methodName: method, args, gas: 30000000000000n, deposit });
}
const validAccount = a => typeof a === 'string' && /^[a-z0-9._-]{2,64}\.testnet$|^[a-f0-9]{64}$/.test(a);

export async function handle(req, env) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const url = new URL(req.url);
  if (req.method === 'GET') return json({ ok: true, contract: env.CONTRACT, fee: 8, prize: 10, welcome: 8 });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  let body; try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  const ch = chain(env);

  if (url.pathname === '/welcome') {
    const account = body.account;
    if (!validAccount(account)) return json({ error: 'bad account' }, 400);
    if (await env.KV.get('w:' + account)) return json({ granted: false, reason: 'already' });
    const count = Number(await env.KV.get('welcomes') || 0);
    if (count >= MAX_WELCOMES) return json({ granted: false, reason: 'cap' });
    // reserve first so concurrent calls cannot double-grant
    await env.KV.put('w:' + account, String(Date.now()));
    await env.KV.put('welcomes', String(count + 1));
    try {
      const reg = await view(ch.provider, env.CONTRACT, 'storage_balance_of', { account_id: account });
      if (!reg) await send(env, ch, 'storage_deposit', { account_id: account, registration_only: true }, 1380000000000000000000n);
      await send(env, ch, 'ft_transfer', { receiver_id: account, amount: String(WELCOME), memo: 'welcome grant' });
    } catch (e) {
      await env.KV.delete("w:" + account); await env.KV.put("welcomes", String(count)); // let them retry
      return json({ error: 'transfer failed', detail: String(e.message || e).slice(0, 200) }, 502);
    }
    return json({ granted: true, amount: Number(WELCOME) });
  }

  if (url.pathname === '/start') {
    const { account, tx } = body;
    if (!validAccount(account) || typeof tx !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(tx)) return json({ error: 'bad input' }, 400);
    if (await env.KV.get('tx:' + tx)) return json({ error: 'tx already used' }, 409);
    let res;
    try { res = await ch.provider.viewTransactionStatus(tx, account, 'FINAL'); } catch (e) { return json({ error: 'tx not found yet', detail: String(e.message || e).slice(0, 120) }, 404); }
    const t = res.transaction;
    const act = t.actions && t.actions[0] && t.actions[0].FunctionCall;
    let ok = t.signer_id === account && t.receiver_id === env.CONTRACT && act && act.method_name === 'ft_transfer' && res.status && res.status.SuccessValue !== undefined;
    if (ok) {
      const a = JSON.parse(Buffer.from(act.args, 'base64').toString());
      ok = a.receiver_id === env.TREASURY && BigInt(a.amount) === FEE;
    }
    if (!ok) return json({ error: 'tx is not a valid 8 FATAL entry fee' }, 400);
    await env.KV.put('tx:' + tx, '1', { expirationTtl: 30 * 86400 });
    const session = crypto.randomUUID();
    await env.KV.put('s:' + session, JSON.stringify({ account, started: Date.now(), paid: false }), { expirationTtl: SESSION_TTL });
    return json({ session });
  }

  if (url.pathname === '/win') {
    const raw = body.session && await env.KV.get('s:' + body.session);
    if (!raw) return json({ error: 'unknown or expired session' }, 404);
    const s = JSON.parse(raw);
    if (s.paid) return json({ error: 'already paid' }, 409);
    const minSecs = env.MIN_PLAY_SECONDS !== undefined ? Number(env.MIN_PLAY_SECONDS) : MIN_PLAY_SECONDS;
    const secs = (Date.now() - s.started) / 1000;
    if (secs < minSecs) return json({ error: "too fast", wait: Math.ceil(minSecs - secs) }, 429);
    const day = new Date().toISOString().slice(0, 10);
    const dk = `d:${day}:${s.account}`;
    const n = Number(await env.KV.get(dk) || 0);
    if (n >= DAILY_PRIZES_PER_WALLET) return json({ error: 'daily limit' }, 429);
    s.paid = true; // mark first so a retry cannot double-pay
    await env.KV.put('s:' + body.session, JSON.stringify(s), { expirationTtl: SESSION_TTL });
    await env.KV.put(dk, String(n + 1), { expirationTtl: 2 * 86400 });
    try { await send(env, ch, 'ft_transfer', { receiver_id: s.account, amount: String(PRIZE), memo: 'night of the mutant cat prize' }); }
    catch (e) { s.paid = false; await env.KV.put('s:' + body.session, JSON.stringify(s), { expirationTtl: SESSION_TTL }); return json({ error: 'transfer failed' }, 502); }
    return json({ paid: true, amount: Number(PRIZE) });
  }
  return json({ error: 'not found' }, 404);
}

export default { fetch: (req, env) => handle(req, env) };
