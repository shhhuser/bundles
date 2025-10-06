"use client";
import { useEffect, useState } from "react";

export default function WalletModal({ open, onClose, onConnect }:{
  open: boolean; onClose: () => void; onConnect:(pubkey:string, adapter:"phantom"|"solflare")=>void;
}) {
  const [hasPhantom, setHasPhantom] = useState(false);
  const [hasSolflare, setHasSolflare] = useState(false);

  useEffect(() => {
    const w:any = window;
    setHasPhantom(!!w.solana?.isPhantom);
    setHasSolflare(!!w.solflare?.isSolflare || !!w.solflare);
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="card w-[420px] p-6 space-y-4" onClick={(e)=>e.stopPropagation()}>
        <h3 className="text-xl font-semibold">Connect Wallet</h3>
        <div className="grid grid-cols-2 gap-3">
          <button disabled={!hasPhantom} onClick={async ()=>{
            const w:any = window; const res = await w.solana?.connect(); if(res?.publicKey) onConnect(res.publicKey.toString(), "phantom");
          }} className="btn flex items-center justify-center gap-2">
            <img alt="phantom" src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26'><circle cx='13' cy='13' r='13' fill='%23a855f7'/></svg>"/>
            Phantom
          </button>
          <button disabled={!hasSolflare} onClick={async ()=>{
            const w:any = window; const res = await w.solflare?.connect(); if(res?.publicKey) onConnect(res.publicKey.toString(), "solflare");
          }} className="btn flex items-center justify-center gap-2">
            <img alt="solflare" src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26'><circle cx='13' cy='13' r='13' fill='%23f97316'/></svg>"/>
            Solflare
          </button>
        </div>
        <p className="text-xs text-white/60">Tip: Install Phantom or Solflare if buttons are disabled.</p>
      </div>
    </div>
  );
}
