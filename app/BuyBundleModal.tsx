"use client";
import { useEffect, useState } from "react";

export default function BuyBundleModal({ open, bundle, onClose, onAllocate, pubkey }:{
  open:boolean; bundle:any; onClose:()=>void; onAllocate:(alloc:any)=>void; pubkey?:string;
}) {
  const [amount, setAmount] = useState(1); // SOL
  const [alloc, setAlloc] = useState<any|null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(()=>{
    if(!open) return;
    setLoading(true);
    fetch(`/api/gw?op=allocate`, { method:"POST", body: JSON.stringify({ amountSol: amount, tokens: bundle?.tokens||[] })})
      .then(r=>r.json()).then(setAlloc).finally(()=>setLoading(false));
  },[open, amount, bundle]);

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
              {alloc.perToken.map((p:any)=>(
                <div key={p.mint} className="flex justify-between text-sm">
                  <span>{p.mint.slice(0,6)}…</span>
                  <span>{(p.weight*100).toFixed(1)}% • {p.sol.toFixed(4)} SOL</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <button disabled={!pubkey} className="btn-primary w-full"
          onClick={()=>onAllocate({ amountSol: amount, bundle, alloc })}>
          {pubkey ? "Get Quotes" : "Connect wallet first"}
        </button>
      </div>
    </div>
  );
}
