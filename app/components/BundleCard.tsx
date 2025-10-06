"use client";
import TokenLogo from "./TokenLogo";

export default function BundleCard({ bundle, onBuy }:{ bundle:any; onBuy:(b:any)=>void }) {
  const w1h = (bundle.metrics?.w1h ?? 0).toFixed(2);
  const badge = bundle.badge ?? (bundle.kind === "fresh" ? "NEW" : bundle.kind === "updated" ? "UPDATED" : bundle.kind.toUpperCase());
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold">{bundle.name}</div>
        <span className="badge">{badge}</span>
      </div>
      <div className="text-sm text-white/70">{bundle.tokens.length} tokens • 1h {w1h}%</div>
      <div className="flex -space-x-2">
        {bundle.tokens.slice(0,8).map((t:any)=>(
          <div key={t.address} className="w-7 h-7 rounded-full bg-white/0 flex items-center justify-center">
            <TokenLogo url={t.logo} symbol={t.symbol} mint={t.address} size={28}/>
          </div>
        ))}
      </div>
      <button className="btn" onClick={()=>onBuy(bundle)}>Buy</button>
    </div>
  );
}
