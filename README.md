# Night of the Mutant Cat x $FATAL

The point-and-click adventure [Night of the Mutant Cat](https://github.com/standardp/night-of-the-mutant-cat), with a wallet gate and a test-token economy on **NEAR testnet**.

**Play:** https://standardp.github.io/night-of-the-mutant-cat-fatal/

## How it works

1. Connect a NEAR **testnet** wallet (MyNearWallet).
2. First visit only: you get **8 $FATAL** free.
3. Playing costs **8 $FATAL** (a signed `ft_transfer` to the treasury).
4. Finish the game and you win **10 $FATAL**.
5. The win screen says your tokens expire in 2 weeks if you do not move them (every send or receive resets the clock).

$FATAL here is a **test token with no market value**. There are no DeFi pools or exchange for it on testnet. Players can only swap it with each other, wallet to wallet.

## Pieces

| Path | What |
|---|---|
| `index.html` | The game (single file, EN/ES) |
| `fatal.js`, `config.js` | Wallet connect, entry fee, win hook |
| `worker/` | Cloudflare Worker that pays the welcome gift and the prize. Holds the treasury key as a secret, verifies the entry fee on-chain, one prize per paid session |
| Token contract | `mcfatal-38428.testnet`, a fresh instance of the [fatal-inflation](https://github.com/standardp/fatal-inflation) contract with a 14-day expiry window and 0 decimals |
| Treasury | `mcfatal-cause-38428.testnet`. It is the contract's "cause", so it is never swept, and expired player balances flow back to it |

## Limits (a toy, not production)

- The win is decided in the browser, so a determined player can fake it. The Worker only pays once per paid session, waits 90 seconds after the fee, and caps 20 prizes per wallet per day.
- 2,000 welcome gifts in total.
- Free hosting limits: 1,000 KV writes per day, so roughly 200 plays or welcomes a day.

MIT licensed.
