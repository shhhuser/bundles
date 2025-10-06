"use client";
import { useEffect, useState } from "react";
import { VersionedTransaction } from "@solana/web3.js";
import TokenLogo from "./TokenLogo";

function b64ToU8(b64:string) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

export default function BuyBundleModal({ open, bundle, onClose, pubkey }:{
  open:boolean; bundle:any; onClose:()=>void; pubkey?:string;
}) {
  const [amount, setAmount] = useState(1); // SOL
  const [alloc, setAlloc] = useState<any|null>(null);
  const [quotes, setQuotes] = useState<any|null>(null);
  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);

  useEffect(()=>{
    if(!open || !bundle) return;
    setLoading(true);
    fetch(`/api/gw?op=allocate`, { method:"POST", body: JSON.stringify({ amountSol: amount, tokens: bundle.tokens })})
      .then(r=>r.json()).then(setAlloc).finally(()=>setLoading(false));
  },[open, amount, bundle]);

  async function getQuotes() {
    setLoading(true);
    const res = await fetch(`/api/gw?op=quote`, { method:"POST", body: JSON.stringify({ amountSol: amount, alloc })}).then(r=>r.json());
    setQuotes(res); setLoading(false);
    alert(`Quoted ${res?.routes?.length||0} legs + BURRITO.`);
  }

  async function swapNow() {
    if (!pubkey || !alloc) return alert("Connect wallet first");
    setSwapping(true);
    const res = await fetch(`/api/gw?op=swap`, {
      method: "POST",
      body: JSON.stringify({ owner: pubkey, amountSol: amount, alloc })
    }).then(r=>r.json()).catch((e)=>({ error: String(e) }));

    if (res?.error) { setSwapping(false); return alert(`Swap build failed: ${res.error}`); }

    const txs:string[] = res?.txs || [];
    const w:any = window;
    try {
      for (const b64 of txs) {
        const u8 = b64ToU8(b64);
        const tx = VersionedTransaction.deserialize(u8);
        const sig = await w?.solana?.signAndSendTransaction ? w.solana.signAndSendTransaction(tx) :
                    await w?.solflare?.signAndSendTransaction ? w.solflare.signAndSendTransaction(tx) :
                    (()=>{ throw new Error("No wallet adapter") })();
        console.log("sent:", sig);
      }
      alert("All swaps submitted. Check your wallet activity.");
      onClose();
    } catch (e:any) {
      alert(`Swap error: ${e.message||e}`);
    } finally {
      setSwapping(false);
    }
  }

  if (!open || !bundle) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="card w-[560px] p-6 space-y-4" onClick={(e)=>e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">Buy {bundle.name}</h3>
          <button className="text-white/60" onClick={onClose}>✕</button>
        </div>
        <label className="text-sm">Amount (SOL)</label>
        <input type="number" min={0.1} step={0.1} value={amount} onChange={e=>setAmount(parseFloat(e.target.value||"0"))}
               className="w-full bg-white/10 rounded-xl px-3 py-2 outline-none"/>

        {loading ? <div>Calculating…</div> : alloc && (
          <div className="space-y-2">
            <div className="text-sm">Auto-buy BURRITO: <span className="font-semibold">{alloc.burritoSol.toFixed(4)} SOL</span></div>
            <div className="max-h-48 overflow-auto space-y-1">
              {alloc.perToken.map((p:any)=>{
                const tok = bundle.tokens.find((x:any)=>x.address===p.mint);
                return (
                  <div key={p.mint} className="flex justify-between items-center text-sm gap-2">
                    <div className="flex items-center gap-2">
                      <TokenLogo url={tok?.logo} symbol={tok?.symbol} mint={tok?.address} size={20}/>
                      <span>{tok?.symbol || p.mint.slice(0,6)}</span>
                    </div>
                    <span>{(p.weight*100).toFixed(1)}% • {p.sol.toFixed(4)} SOL</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button className="btn w-1/2" disabled={!alloc || loading} onClick={getQuotes}>Get Quotes</button>
          <button className="btn-primary w-1/2" disabled={!alloc || !pubkey || swapping} onClick={swapNow}>
            {swapping ? "Swapping…" : "Swap Now"}
          </button>
        </div>
      </div>
    </div>
  );
}
