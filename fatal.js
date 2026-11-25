import { setupWalletSelector } from 'https://esm.sh/@near-wallet-selector/core@9';
import { setupModal } from 'https://esm.sh/@near-wallet-selector/modal-ui@9';
import { setupMyNearWallet } from 'https://esm.sh/@near-wallet-selector/my-near-wallet@9';

const C = window.FATAL_CONFIG;
const es = (navigator.language || 'en').toLowerCase().startsWith('es');
const S = es ? {
  title: 'NIGHT OF THE MUTANT CAT x $FATAL',
  intro: 'Conecta tu wallet de NEAR testnet para jugar. Jugar cuesta {fee} $FATAL. Si ganas, recibes {prize} $FATAL. La primera vez que entras te regalamos {welcome}.',
  connect: 'CONECTAR WALLET', as: 'Wallet', bal: 'Saldo', play: 'JUGAR (cuesta {fee} $FATAL)', out: 'Desconectar',
  poor: 'No tienes {fee} $FATAL. Pide a otro jugador que te pase $FATAL (P2P) y vuelve.',
  gas: 'Necesitas un poco de NEAR de testnet para el gas. Consíguelo gratis en el faucet.',
  faucet: 'Faucet de testnet', welcomed: 'Te regalamos {welcome} $FATAL de bienvenida.',
  paying: 'Esperando la confirmación de tu pago...', err: 'Algo falló', retry: 'REINTENTAR',
  disclaimer: 'Es un token de prueba en NEAR testnet, sin valor de mercado. No hay pools de DeFi ni mercado: solo puedes intercambiarlo con otros jugadores (P2P) entre wallets de testnet.',
  won: 'Ganaste {prize} $FATAL.', paid: 'Te enviamos {prize} $FATAL a {acct}.',
  expiry: 'Ojo: tus $FATAL caducan en 2 semanas si no los mueves. Cada vez que envías o recibes, el reloj se reinicia.',
  trade: 'Puedes intentar intercambiarlos P2P con otros jugadores. Busca pools de DeFi donde les gusten los gatos mutantes (en testnet no hay liquidez real).',
  wait: 'El premio se libera un poco después de empezar; reintenta en {s} s.', again: 'JUGAR OTRA VEZ'
} : {
  title: 'NIGHT OF THE MUTANT CAT x $FATAL',
  intro: 'Connect a NEAR testnet wallet to play. Playing costs {fee} $FATAL. Win and you get {prize} $FATAL. First visit: we give you {welcome} free.',
  connect: 'CONNECT WALLET', as: 'Wallet', bal: 'Balance', play: 'PLAY (costs {fee} $FATAL)', out: 'Disconnect',
  poor: 'You do not have {fee} $FATAL. Ask another player to send you some (P2P) and come back.',
  gas: 'You need a little testnet NEAR for gas. Get it free from the faucet.',
  faucet: 'Testnet faucet', welcomed: 'We sent you {welcome} $FATAL as a welcome gift.',
  paying: 'Waiting for your payment to confirm...', err: 'Something failed', retry: 'RETRY',
  disclaimer: 'This is a test token on NEAR testnet with no market value. There are no DeFi pools or market: you can only swap it with other players (P2P) between testnet wallets.',
  won: 'You won {prize} $FATAL.', paid: 'We sent {prize} $FATAL to {acct}.',
  expiry: 'Heads up: your $FATAL expires in 2 weeks if you do not move it. Every send or receive resets the clock.',
  trade: 'You can try to swap it P2P with other players. Look for DeFi pools where they like mutant cats (on testnet there is no real liquidity).',
  wait: 'The prize unlocks a little after you start; retry in {s}s.', again: 'PLAY AGAIN'
};
const f = (s, o = {}) => s.replace(/\{(\w+)\}/g, (_, k) => (k in o ? o[k] : C[k] ?? ''));
const $ = id => document.getElementById(id);
const card = () => $('card');
const J = async (path, body) => { const r = await fetch(C.api + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return [r.status, await r.json().catch(() => ({}))]; };

const savedCardHTML = card().innerHTML;      // the game's own language-select card
const savedBind = () => card().querySelectorAll('.lang').forEach(b => b.onclick = () => window.start(b.dataset.lang));
const set = html => { card().innerHTML = html; $('overlay').classList.add('on'); };
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

async function balanceOf(account) {
  const r = await fetch(C.rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'query', params: { request_type: 'call_function', account_id: C.contract, method_name: 'ft_balance_of', args_base64: btoa(JSON.stringify({ account_id: account })), finality: 'optimistic' } }) });
  const j = await r.json();
  if (!j.result || !j.result.result) return 0;
  return Number(JSON.parse(new TextDecoder().decode(new Uint8Array(j.result.result))));
}

const selector = await setupWalletSelector({ network: C.network, modules: [setupMyNearWallet()] });
const modal = setupModal(selector, { contractId: C.contract });
const accountId = () => (selector.store.getState().accounts.find(a => a.active) || selector.store.getState().accounts[0] || {}).accountId;

function gateShell(inner) {
  set(`<h1>${S.title}</h1><p>${f(S.intro)}</p>${inner}<p style="color:#8d7fa0;font-size:11px;margin-top:14px">${S.disclaimer}</p>`);
}
function showConnect() {
  gateShell(`<button id="fConnect">${S.connect}</button>`);
  $('fConnect').onclick = () => modal.show();
}
async function showAccount(acct, note = '') {
  gateShell(`<p>${S.as}: <b>${esc(acct)}</b><br>${S.bal}: <b id="fBal">...</b> $FATAL ${note}</p><div id="fAct"></div>`);
  const bal = await balanceOf(acct);
  $('fBal').textContent = bal;
  const act = $('fAct');
  if (bal < C.fee) act.innerHTML = `<p>${f(S.poor)}</p>`;
  act.innerHTML += `<button id="fPlay" ${bal < C.fee ? 'disabled style="opacity:.4"' : ''}>${f(S.play)}</button><button id="fOut" class="lang">${S.out}</button><p style="font-size:11px">${S.gas} <a style="color:#5fd0a8" target="_blank" rel="noopener" href="https://near-faucet.io/">${S.faucet}</a></p>`;
  $('fOut').onclick = async () => { const w = await selector.wallet(); await w.signOut(); localStorage.removeItem('fatal.session'); location.href = location.pathname; };
  $('fPlay').onclick = async () => {
    const w = await selector.wallet();
    localStorage.setItem('fatal.pending', acct);
    await w.signAndSendTransaction({ receiverId: C.contract, callbackUrl: location.origin + location.pathname,
      actions: [{ type: 'FunctionCall', params: { methodName: 'ft_transfer', args: { receiver_id: C.treasury, amount: String(C.fee) }, gas: '30000000000000', deposit: '1' } }] });
  };
}
function launchGame() {
  card().innerHTML = savedCardHTML; savedBind();
  $('overlay').classList.add('on');
}

async function boot() {
  const acct = accountId();
  if (!acct) return showConnect();
  const q = new URLSearchParams(location.search);
  const tx = (q.get('transactionHashes') || '').split(',')[0];
  if (tx && localStorage.getItem('fatal.pending') === acct) {
    gateShell(`<p>${S.paying}</p>`);
    history.replaceState(null, '', location.pathname);
    let res;
    for (let i = 0; i < 8; i++) { res = await J('/start', { account: acct, tx }); if (res[0] !== 404) break; await new Promise(r => setTimeout(r, 2500)); }
    localStorage.removeItem('fatal.pending');
    if (res[0] === 200) { localStorage.setItem('fatal.session', JSON.stringify({ id: res[1].session, acct })); return launchGame(); }
    gateShell(`<p>${S.err}: ${esc(res[1].error || res[0])}</p><button id="fRe">${S.retry}</button>`);
    return ($('fRe').onclick = () => location.href = location.pathname);
  }
  let note = '';
  const [st, w] = await J('/welcome', { account: acct });
  if (st === 200 && w.granted) note = `<br>${f(S.welcomed)}`;
  showAccount(acct, note);
}
selector.on('signedIn', () => boot());

// Hook the game's win screen.
const origWin = window.win;
window.win = async function () {
  origWin();
  const s = JSON.parse(localStorage.getItem('fatal.session') || 'null');
  const c = card();
  const add = html => { const d = document.createElement('div'); d.innerHTML = html; c.insertBefore(d, $('again')); };
  if (!s) return;
  add(`<p id="fPay">...</p>`);
  let res = await J('/win', { session: s.id });
  if (res[0] === 429 && res[1].wait) { await new Promise(r => setTimeout(r, (res[1].wait + 1) * 1000)); res = await J('/win', { session: s.id }); }
  if (res[0] === 200) {
    localStorage.removeItem('fatal.session');
    $('fPay').outerHTML = `<p style="color:#5fd0a8;font-weight:bold">${f(S.won)} ${f(S.paid, { acct: esc(s.acct) })}</p><p>${S.expiry}</p><p>${S.trade}</p><p style="color:#8d7fa0;font-size:11px">${S.disclaimer}</p>`;
    $('again').textContent = S.again;
    $('again').onclick = () => { location.href = location.pathname; };
  } else $('fPay').textContent = `${S.err}: ${esc(res[1].error || res[0])}`;
};

boot();
