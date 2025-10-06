"use client";
import useSWR from "swr";
import { useEffect, useState } from "react";
import WalletModal from "../components/WalletModal";
import BundleCard from "../components/BundleCard";
import BuyBundleModal from "../components/BuyBundleModal";

const fetcher = (url:string)=>fetch(url).then(r=>r.json());

export default function Page() {
  const { data, isLoading, mutate } = useSWR(`/api/gw?op=getBundles`, fetcher, { refreshInterval: 12000, dedupingInterval: 5000 });
  const [connecting, setConnecting] = useState(false);
  const [pubkey, setPubkey] = useState<string|undefined>(undefined);
  const [buying, setBuying] = useState<any|null>(null);

  useEffect(()=>{
    const w:any = window;
    if (w.solana?.publicKey) setPubkey(w.solana.publicKey.toString());
  },[]);

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      {/* Splash / header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-lime via-neon-cyan to-neon-violet" />
          <div>
            <div className="text-lg font-semibold">Burrito Bundles</div>
            <div className="text-xs text-white/60">Fresh tokens, auto-allocated, 1% BURRITO on every buy.</div>
          </div>
        </div>
        <button className="btn" onClick={()=>setConnecting(true)}>
          {pubkey ? `${pubkey.slice(0,4)}…${pubkey.slice(-4)}` : "Connect Wallet"}
        </button>
      </div>

      {/* Loading bar on first visit */}
      {isLoading && (
        <div className="card p-4 mb-6">
          <div className="text-sm mb-2">Summoning bundles…</div>
          <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
            <div className="h-3 bg-gradient-to-r from-neon-lime via-neon-cyan to-neon-violet animate-[pulse_1.5s_infinite] w-2/3 rounded-full"></div>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(data?.bundles || []).map((b:any)=>(
          <BundleCard key={b.id} bundle={b} onBuy={setBuying}/>
        ))}
      </div>

      {/* Wallet & buy modals */}
      <WalletModal open={connecting} onClose={()=>setConnecting(false)} onConnect={(pk)=>{ setPubkey(pk); setConnecting(false); }}/>
      <BuyBundleModal open={!!buying} bundle={buying} onClose={()=>setBuying(null)} pubkey={pubkey}
        onAllocate={async ({ amountSol, bundle, alloc })=>{
          const res = await fetch(`/api/gw?op=quote`, { method:"POST", body: JSON.stringify({ amountSol, alloc })}).then(r=>r.json());
          alert(`Quoted ${res?.routes?.length||0} legs.\n(This demo stops at quote; swap building next step.)`);
        }}
      />
    </main>
  );
}
