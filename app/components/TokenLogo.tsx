"use client";
import { useMemo } from "react";
function gradientFromMint(mint?: string) {
  const m = mint || "x";
  let h1 = 0, h2 = 0;
  for (let i=0;i<m.length;i++) { h1 = (h1*31 + m.charCodeAt(i)) % 360; h2 = (h2*17 + m.charCodeAt(i)) % 360; }
  return `conic-gradient(from 0deg, hsl(${h1} 90% 55%), hsl(${h2} 90% 55%), hsl(${(h1+h2)%360} 90% 50%))`;
}
export default function TokenLogo({ url, symbol, mint, size=28 }:{
  url?: string | null; symbol?: string; mint?: string; size?: number;
}) {
  const fallbackStyle = useMemo(()=>({
    width: size, height: size, borderRadius: "999px",
    background: gradientFromMint(mint),
    display: "inline-block", border: "1px solid rgba(255,255,255,0.12)"
  }), [mint, size]);

  if (url) {
    return (
      <img
        src={url}
        width={size}
        height={size}
        alt={symbol || mint || "token"}
        className="rounded-full border border-white/10 object-cover"
        onError={(e)=>{ (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return <span style={fallbackStyle} title={symbol || mint} />;
}
