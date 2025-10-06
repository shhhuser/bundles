import { NextRequest, NextResponse } from "next/server";
export const runtime = "edge";

const JUP_BASE = process.env.JUP_BASE!;
const BURRITO_MINT = process.env.BURRITO_MINT!;
const HELIUS_RPC = process.env.HELIUS_RPC!;
const MINT_SOL = "So11111111111111111111111111111111111111112";

type TokenSignal = {
  address: string; symbol: string; price: number;
  r1m:number; r5m:number; r1h:number;
  vol5m:number; vol1h:number; vol24h:number;
  liqUsd:number; trades24h:number;
  boosted?:boolean; profileUpdatedAt?:number; firstSeenAt?:number;
  routeHealth:number; logo?:string|null;
};

function json(data:any, init:any = {}) {
  return new NextResponse(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json", ...init.headers }
  });
}
const clamp = (x:number, a:number, b:number)=>Math.max(a, Math.min(b, x));

/** Jupiter token list cache (edge) */
let JUP_LIST_CACHE: any[] | null = null;
let JUP_LIST_AT = 0;
async function getJupList(): Promise<Record<string, any>> {
  const now = Date.now();
  if (!JUP_LIST_CACHE || (now - JUP_LIST_AT) > 10 * 60_000) {
    const r = await fetch("https://token.jup.ag/all", { cf: { cacheTtl: 600, cacheEverything: true } });
    const arr = await r.json().catch(()=>[]);
    JUP_LIST_CACHE = Array.isArray(arr) ? arr : [];
    JUP_LIST_AT = now;
  }
  const map: Record<string, any> = {};
  for (const t of JUP_LIST_CACHE) if (t?.address) map[t.address] = t;
  return map;
}

/** Dexscreener ingest + logo enrichment */
async function fetchUniverse(): Promise<TokenSignal[]> {
  const urls = [
    "https://api.dexscreener.com/latest/dex/tokens/solana",
    "https://api.dexscreener.com/latest/dex/search?q=solana"
  ];
  const [jupMap, resps] = await Promise.all([
    getJupList(),
    Promise.allSettled(urls.map(u => fetch(u, { cf: { cacheTtl: 10, cacheEverything: true } })))
  ]);

  const out: TokenSignal[] = [];
  for (const r of resps) {
    if (r.status !== "fulfilled") continue;
    const data = await r.value.json().catch(()=>null);
    const pairs = data?.pairs || [];
    for (const p of pairs.slice(0, 200)) {
      const mint = p?.baseToken?.address; if (!mint) continue;

      const dxLogo = p?.info?.imageUrl || p?.baseToken?.imageUrl || null;
      const j = jupMap[mint];
      const jLogo = j?.logoURI || null;

      out.push({
        address: mint,
        symbol: p.baseToken.symbol || mint.slice(0,4),
        price: Number(p.priceUsd)||0,
        r1m: Number(p.priceChange?.m1)||0,
        r5m: Number(p.priceChange?.m5)||0,
        r1h: Number(p.priceChange?.h1)||0,
        vol5m: Number(p.volume?.m5)||0,
        vol1h: Number(p.volume?.h1)||0,
        vol24h: Number(p.volume?.h24)||0,
        liqUsd: Number(p.liquidity?.usd)||0,
        trades24h: Number(p.txns?.h24?.buys||0)+Number(p.txns?.h24?.sells||0),
        boosted: Boolean(p.boosts?.status),
        profileUpdatedAt: p.info?.updatedAt? Number(new Date(p.info.updatedAt).getTime()): undefined,
        firstSeenAt: p.info?.createdAt? Number(new Date(p.info.createdAt).getTime()): undefined,
        routeHealth: 1,
        logo: dxLogo || jLogo || null
      });
    }
  }
  const dedup = new Map<string, TokenSignal>();
  for (const t of out) if (!dedup.has(t.address)) dedup.set(t.address, t);
  return Array.from(dedup.values());
}

/** Scoring & composition (fresh/updated bias) */
function scoreToken(t:TokenSignal, now=Date.now()) {
  const ageHrs = t.firstSeenAt ? (now - t.firstSeenAt)/3600000 : 999;
  const updHrs = t.profileUpdatedAt ? (now - t.profileUpdatedAt)/3600000 : 999;
  const newness = ageHrs <= 24 ? 1 : Math.max(0, 1 - (ageHrs-24)/72);
  const updated = updHrs <= 6 ? 1 : 0;
  const attention = 0.6*newness + 0.4*(updated || (t.boosted?1:0));
  const flow = Math.log10(1 + t.vol1h) + 0.5*Math.log10(1 + t.vol24h);
  const liq = Math.log10(1 + t.liqUsd);
  const momo = 0.55*t.r5m + 0.25*t.r1h + 0.2*t.r1m;
  const safetyPenalty = (t.liqUsd<8000 ? 0.8:0) + (t.routeHealth<0.7?0.5:0);
  const w_r=0.40, w_f=0.25, w_l=0.10, w_a=0.20, w_s=0.15;
  return w_r*momo + w_f*flow + w_l*liq + w_a*attention - w_s*safetyPenalty;
}

function composeBundles(universe:TokenSignal[]) {
  const now = Date.now();
  const scored = universe
    .filter(t => t.price>0 && t.symbol && t.address)
    .map(t => ({...t, _score:scoreToken(t, now)}))
    .sort((a,b)=>b._score-a._score);

  const fresh = scored.filter(t => (t.firstSeenAt && (now - t.firstSeenAt)<=24*3600_000) || (t.profileUpdatedAt && (now - t.profileUpdatedAt)<=6*3600_000));
  const majors = scored.filter(t => ["SOL","USDC","USDT","WIF","BONK","JUP","PYTH"].includes((t.symbol||"").toUpperCase()));
  const rest = scored.filter(t=>!fresh.includes(t) && !majors.includes(t));

  function mk(name:string, kind:string, items:TokenSignal[], n:number) {
    const toks = items.slice(0, n);
    return {
      id: `${kind}-${name}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`,
      name, kind,
      tokens: toks,
      createdAt: now,
      metrics: { w1h: toks.reduce((s,t)=> s + (t.r1h||0), 0)/Math.max(1,toks.length) },
      badge: kind==="fresh"?"NEW":(kind==="updated"?"UPDATED":undefined)
    };
  }

  const bundles:any[] = [];
  bundles.push(mk("Fresh Momentum A","fresh", fresh, 8));
  bundles.push(mk("Fresh Momentum B","fresh", fresh.slice(8), 8));
  bundles.push(mk("Updated & Boosted","updated", fresh.filter(t=>t.boosted), 6));
  bundles.push(mk("Majors & Memes","majors", majors, Math.min(6, majors.length||3)));
  bundles.push(mk("Index Mix","index", [
    {address: MINT_SOL, symbol:"SOL", price:0, r1m:0,r5m:0,r1h:0,vol5m:0,vol1h:0,vol24h:0,liqUsd:0,trades24h:0,routeHealth:1, logo: "https://cryptologos.cc/logos/solana-sol-logo.png"},
    {address: BURRITO_MINT, symbol:"BURRITO", price:0,r1m:0,r5m:0,r1h:0,vol5m:0,vol1h:0,vol24h:0,liqUsd:0,trades24h:0,routeHealth:1, logo: null},
    ...rest.slice(0,4)
  ] as any[], 6));
  bundles.push(mk("Community Boosted","boosted", scored.filter(t=>t.boosted), 7));
  while (bundles.length < 8) bundles.push(mk(`Fresh x${bundles.length}`,"fresh", fresh.slice(bundles.length*5), 6));
  return bundles.slice(0, 20);
}

/** Allocation (1% BURRITO, softmax on short-term mojo) */
function allocate(amountSol:number, tokens:TokenSignal[]) {
  const burritoSol = amountSol * 0.01;
  const distributable = amountSol - burritoSol;
  const alpha = 2.2, wMin = 0.04, wMax = 0.28;

  const z = tokens.map(t => 0.45*t.r5m + 0.25*t.r1h + 0.20*Math.log10(1+t.vol1h) + 0.10*(t.boosted?1:0));
  const exp = z.map(v => Math.exp(alpha*v));
  let sum = exp.reduce((a,b)=>a+b,0);
  let weights = exp.map(v=>v/sum);

  weights = weights.map(w=>clamp(w, wMin, wMax));
  const s2 = weights.reduce((a,b)=>a+b,0);
  weights = weights.map(w=>w/s2);

  const perToken = tokens.map((t, i) => ({
    mint: t.address,
    weight: weights[i],
    sol: weights[i]*distributable
  }));
  return { burritoSol, perToken };
}

/** Jupiter quote helper */
async function jupQuote(inputMint:string, outputMint:string, amount:number, slippageBps=100) {
  const url = `${JUP_BASE}/quote?inputMint=${encodeURIComponent(inputMint)}&outputMint=${encodeURIComponent(outputMint)}&amount=${amount}&slippageBps=${slippageBps}`;
  const r = await fetch(url, { cf:{ cacheTtl: 5, cacheEverything: false }});
  if (!r.ok) return null;
  return r.json();
}

/** Router handlers */
export async function GET(req:NextRequest) {
  const { searchParams } = new URL(req.url);
  const op = searchParams.get("op");

  if (op === "getBundles") {
    const universe = await fetchUniverse();
    const bundles = composeBundles(universe);
    return json({ bundles }, { headers: { "Cache-Control":"s-maxage=15, stale-while-revalidate=30" } });
  }
  return json({ ok: true, msg: "Burrito GW online" });
}

export async function POST(req:NextRequest) {
  const { searchParams } = new URL(req.url);
  const op = searchParams.get("op");
  const body = await req.json().catch(()=> ({}));

  if (op === "allocate") {
    const { amountSol, tokens } = body as { amountSol:number; tokens:TokenSignal[] };
    const out = allocate(Number(amountSol||0), tokens||[]);
    return json(out);
  }

  if (op === "quote") {
    const { amountSol, alloc } = body as any;
    const lamports = Math.round((amountSol * 0.99) * 1e9);
    const routes:any[] = [];
    for (const leg of alloc?.perToken ?? []) {
      const amt = Math.max(10000, Math.round(lamports * leg.weight));
      const q = await jupQuote(MINT_SOL, leg.mint, amt);
      routes.push({ mint: leg.mint, amountLamports: amt, route: q });
    }
    const burritoLamports = Math.round((amountSol*0.01)*1e9);
    const burritoQuote = await jupQuote(MINT_SOL, BURRITO_MINT, burritoLamports);
    return json({ routes, burrito: burritoQuote });
  }

  return json({ error: "Unsupported op" });
}
