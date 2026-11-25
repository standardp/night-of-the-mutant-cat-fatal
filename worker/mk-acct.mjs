import fs from 'fs';
import { KeyPair } from '@near-js/crypto';
const kp = KeyPair.fromRandom('ed25519'); const player='mcplayer-'+Math.floor(Math.random()*1e6)+'.testnet';
const r=await fetch('https://helper.testnet.near.org/account',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({newAccountId:player,newAccountPublicKey:kp.getPublicKey().toString()})});
console.log(r.status);
fs.writeFileSync('/tmp/pk.txt',kp.toString()); fs.writeFileSync('/tmp/acct.txt',player); console.log(player);
