// figures.mjs — (re)generate the inline SVG figures in chapters/01-introduction.md.
//
// The figures ship baked into the chapter as `data:image/svg+xml` URLs (md chapters
// render them through the reader's renderMd). This script is their *source*: edit a
// figure function or a caption in META below, then run
//
//     node tools/arcr-figures.mjs            # regenerate + re-embed in place
//     node tools/arcr-figures.mjs --svg      # also dump previews to tools/.preview/
//
// It's idempotent and re-runnable: each figure is matched by its (stable) alt text and
// swapped in place — first run can instead use a `<!--FIG:<key>-->` marker. Figure 4 is
// REAL gewgaw output: the exact mulberry32 + makeSprite algorithm from cradle's arcr.html.
//
// Preview note: to eyeball a tweak, --svg writes .svg files you can open, or rasterize
// headless, e.g. msedge --headless=new --window-size=W,H --screenshot=out.png fig.svg
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const CHAPTER = path.join(here, '..', 'books', 'arcr', 'chapters', '01-introduction.md');
const PREVIEW = process.argv.includes('--svg');

const C = {
  bg: '#0b0b10', panel: '#15151e', panel2: '#1c1c28', stroke: '#2b2b3b',
  text: '#e8e8ef', muted: '#9a9ab0', faint: '#6a6a80',
  cyan: '#5ad0e6', gold: '#e6b84f', green: '#6ad29a', pink: '#e87da8', violet: '#a98be6',
};
const SANS = "font-family='system-ui,-apple-system,Segoe UI,sans-serif'";
const MONO = "font-family='ui-monospace,SF Mono,Menlo,Consolas,monospace'";
const wrap = (w, h, body) =>
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}' width='${w}' height='${h}'>` +
  `<rect width='${w}' height='${h}' rx='10' fill='${C.bg}'/>${body}</svg>`;
const dataUrl = (svg) => 'data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64');

// ---- exact engine algorithm (cradle/arcr.html) ----
function mulberry32(a){ return function(){ a|=0; a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a);
  t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }
function spriteGrid(seed){ // 7x7 of null|'body'|'eye'
  const rnd=mulberry32(seed>>>0), cols=7, rows=7, half=4;
  const g=Array.from({length:rows},()=>Array(cols).fill(null));
  for(let y=0;y<rows;y++) for(let x=0;x<half;x++){ const edge=(y===0||y===rows-1);
    if(rnd()<(edge?0.3:0.62)){ g[y][x]='body'; g[y][cols-1-x]='body'; } }
  const eyeRow=2+Math.floor(rnd()*2); g[eyeRow][1]='eye'; g[eyeRow][cols-2]='eye';
  return g; }

// ============================================================ FIG — the stack
function figStack(){
  const W=910,H=232, by=46, bh=118; const stageX=[20,200,380,560,740], sw=150;
  const arrow=(x)=>`<path d='M${x} ${by+bh/2} h22' stroke='${C.faint}' stroke-width='2' fill='none'/>`+
    `<path d='M${x+22} ${by+bh/2} l-7 -5 v10 z' fill='${C.faint}'/>`;
  const box=(x,fill,inner)=>`<rect x='${x}' y='${by}' width='${sw}' height='${bh}' rx='9' fill='${fill}' stroke='${C.stroke}'/>${inner}`;
  const label=(x,t)=>`<text x='${x+sw/2}' y='${by+bh+24}' ${SANS} font-size='12' fill='${C.muted}' text-anchor='middle'>${t}</text>`;
  const codeLines=['@title STARGAZING','obj you : 🧺 ⬇','every 0.9 : ⭐','when score≥12'];
  const s1=box(stageX[0],C.panel,
    codeLines.map((l,i)=>`<text x='${stageX[0]+12}' y='${by+24+i*22}' ${MONO} font-size='11' fill='${i===0?C.gold:C.text}'>${l}</text>`).join(''));
  let qr=''; const qg=mulberry32(20250531), qn=9, qc=8, qx=stageX[1]+18, qy=by+22;
  for(let y=0;y<qn;y++)for(let x=0;x<qn;x++){ const edge=x===0||y===0||x===qn-1||y===qn-1; if(edge||qg()<0.5) qr+=`<rect x='${qx+x*qc}' y='${qy+y*qc}' width='${qc}' height='${qc}' fill='${C.text}'/>`; }
  const s2=box(stageX[1],C.panel2,qr+
    `<text x='${stageX[1]+98}' y='${by+50}' ${MONO} font-size='11' fill='${C.cyan}'>q:d.</text>`+
    `<text x='${stageX[1]+98}' y='${by+66}' ${MONO} font-size='11' fill='${C.cyan}'>arcr_</text>`+
    `<text x='${stageX[1]+98}' y='${by+82}' ${MONO} font-size='11' fill='${C.faint}'>…</text>`);
  const s3=box(stageX[2],C.panel,
    `<text x='${stageX[2]+sw/2}' y='${by+44}' ${SANS} font-size='17' font-weight='700' fill='${C.text}' text-anchor='middle'>cradle</text>`+
    `<rect x='${stageX[2]+24}' y='${by+62}' width='${sw-48}' height='30' rx='6' fill='${C.bg}' stroke='${C.stroke}'/>`+
    `<text x='${stageX[2]+sw/2}' y='${by+82}' ${MONO} font-size='12' fill='${C.green}' text-anchor='middle'>!arcr1+</text>`);
  const gx=stageX[3]+sw/2, gy=by+50; let gear=`<circle cx='${gx}' cy='${gy}' r='17' fill='none' stroke='${C.violet}' stroke-width='5'/><circle cx='${gx}' cy='${gy}' r='5' fill='${C.violet}'/>`;
  for(let i=0;i<8;i++){gear+=`<rect x='${gx-3}' y='${gy-26}' width='6' height='8' fill='${C.violet}' transform='rotate(${i*45} ${gx} ${gy})'/>`;}
  const s4=box(stageX[3],C.panel,gear+
    `<text x='${gx}' y='${by+100}' ${SANS} font-size='15' font-weight='700' fill='${C.text}' text-anchor='middle'>gewgaw</text>`);
  const px=stageX[4]+sw/2-34, py=by+10, pw=68, ph=98;
  let stars=''; const sg=mulberry32(7); for(let i=0;i<5;i++) stars+=`<text x='${px+8+sg()*(pw-22)}' y='${py+22+sg()*40}' font-size='11'>⭐</text>`;
  const s5=box(stageX[4],C.panel2,
    `<rect x='${px}' y='${py}' width='${pw}' height='${ph}' rx='9' fill='#070709' stroke='${C.stroke}'/>`+stars+
    `<text x='${px+pw/2}' y='${py+ph-14}' font-size='17' text-anchor='middle'>🧺</text>`+
    `<text x='${px+10}' y='${py+15}' ${MONO} font-size='9' fill='${C.gold}'>12</text>`);
  const body =
    `<text x='${W/2}' y='26' ${SANS} font-size='14' font-weight='700' fill='${C.text}' text-anchor='middle'>how a game travels</text>`+
    s1+arrow(170)+s2+arrow(350)+s3+arrow(530)+s4+arrow(710)+s5+
    label(stageX[0],'arcr text · ~0.4 KB')+label(stageX[1],'capsule · ≈130 B · QR')+
    label(stageX[2],'static bootloader')+label(stageX[3],'curated renderer')+label(stageX[4],'your game · offline');
  return wrap(W,H,body);
}

// ============================================================ FIG — anatomy
function figAnatomy(){
  const W=720,H=372; const x=28,y=58,pw=430,lh=30; const tx=x+16;
  const rows=[
    ['@title STARGAZING',C.gold,'setup',C.gold],
    ['@bg stars',C.gold,'',0],
    ['obj you : emoji 🧺 move=tap',C.text,'the player you steer',C.cyan],
    ['every 0.9 : spawn ⭐ tag=star',C.text,'spawns stars over time',C.green],
    ['on hit you #star : score +1',C.text,'catch one → score up',C.pink],
    ['when score >= 12 : win "…"',C.text,'the goal',C.violet],
  ];
  const ph=rows.length*lh+24;
  let panel=`<rect x='${x}' y='${y}' width='${pw}' height='${ph}' rx='9' fill='${C.panel}' stroke='${C.stroke}'/>`;
  let leaders='';
  rows.forEach((r,i)=>{
    const ly=y+24+i*lh;
    panel+=`<text x='${tx}' y='${ly}' ${MONO} font-size='13' fill='${r[1]}'>${r[0]}</text>`;
    if(r[2]){ const cy=ly-4; leaders+=`<path d='M${x+pw} ${cy} h26' stroke='${r[3]}' stroke-width='1.5' fill='none' opacity='.7'/>`+
      `<circle cx='${x+pw}' cy='${cy}' r='2.5' fill='${r[3]}'/>`+
      `<text x='${x+pw+32}' y='${ly}' ${SANS} font-size='12.5' fill='${C.text}'>${r[2]}</text>`; }
  });
  const fy=y+ph+38;
  const foot=`<rect x='${x}' y='${fy-24}' width='${W-2*x}' height='44' rx='8' fill='${C.panel2}' stroke='${C.stroke}'/>`+
    `<text x='${W/2}' y='${fy+3}' ${SANS} font-size='13.5' fill='${C.muted}' text-anchor='middle'>`+
    `every rule is  <tspan fill='${C.cyan}' font-weight='700'>event</tspan>  →  <tspan fill='${C.gold}' font-weight='700'>condition</tspan>  →  <tspan fill='${C.green}' font-weight='700'>action</tspan></text>`;
  const body=`<text x='${x}' y='34' ${SANS} font-size='14' font-weight='700' fill='${C.text}'>anatomy of a game</text>`+
    `<text x='${x+170}' y='34' ${SANS} font-size='12' fill='${C.faint}'>— objects, then rules</text>`+panel+leaders+foot;
  return wrap(W,H,body);
}

// ============================================================ FIG — zones
function figZones(){
  const W=560,H=446; const fx=185,fy=48,fw=190,fh=322; const cx=fx+fw/2,cy=fy+fh/2;
  const frame=`<rect x='${fx}' y='${fy}' width='${fw}' height='${fh}' rx='16' fill='#070709' stroke='${C.stroke}' stroke-width='2'/>`;
  const dot=(x,yy,col)=>`<circle cx='${x}' cy='${yy}' r='6' fill='${col}'/>`;
  // engine zones: top .14H, bottom .85H, left .18W, right .82W, center .5
  const Ytop=fy+fh*0.14, Ybot=fy+fh*0.85, Xleft=fx+fw*0.18, Xright=fx+fw*0.82;
  const marks=dot(cx,Ytop,C.cyan)+dot(cx,Ybot,C.cyan)+dot(Xleft,cy,C.green)+dot(Xright,cy,C.green)+dot(cx,cy,C.gold);
  const edge=(t,x,yy,col,side)=>{ const lx= side==='L'? fx-16 : fx+fw+16; const anc= side==='L'?'end':'start';
    return `<path d='M${x} ${yy} L${lx} ${yy}' stroke='${col}' stroke-width='1' opacity='.5' fill='none'/>`+
      `<text x='${lx + (side==='L'?-4:4)}' y='${yy+4}' ${MONO} font-size='12.5' fill='${C.text}' text-anchor='${anc}'>${t}</text>`; }
  const labels=edge('top',cx,Ytop,C.cyan,'R')+edge('bottom',cx,Ybot,C.cyan,'R')+
    edge('left',Xleft,cy,C.green,'L')+edge('right',Xright,cy,C.green,'R')+
    `<text x='${cx}' y='${cy-14}' ${MONO} font-size='12.5' fill='${C.gold}' text-anchor='middle'>center</text>`;
  const sg=mulberry32(99); let scat=''; for(let i=0;i<11;i++){ const sy=fy+30+sg()*(fh-60);
    if(Math.abs(sy-cy)<26){ sg(); continue; } scat+=`<circle cx='${fx+16+sg()*(fw-32)}' cy='${sy}' r='3.5' fill='${C.pink}' opacity='.8'/>`; }
  const scatLab=`<text x='${W/2}' y='${fy+fh+30}' ${MONO} font-size='12.5' fill='${C.pink}' text-anchor='middle'>scatter — random across the field</text>`;
  const body=`<text x='${W/2}' y='28' ${SANS} font-size='14' font-weight='700' fill='${C.text}' text-anchor='middle'>the play surface · placement zones (at=)</text>`+
    frame+scat+marks+labels+scatLab;
  return wrap(W,H,body);
}

// ============================================================ FIG — real sprites
function figSprites(){
  const seeds=[1,7,42,128,777,2026]; const cell=7, gap=42, x0=46, y0=64, n=7;
  const cols=[C.cyan,C.gold,C.green,C.pink,C.violet,'#e6794f'];
  const W = x0*2 + seeds.length*(n*cell) + (seeds.length-1)*gap, H=150;
  let body=`<text x='${W/2}' y='28' ${SANS} font-size='14' font-weight='700' fill='${C.text}' text-anchor='middle'>procedural sprites — one algorithm, a seed each</text>`+
    `<text x='${W/2}' y='46' ${SANS} font-size='11.5' fill='${C.faint}' text-anchor='middle'>7×7, mirror-symmetric, deterministic — these are real gewgaw output</text>`;
  seeds.forEach((seed,si)=>{
    const g=spriteGrid(seed), sx=x0+si*(n*cell+gap), body_col=cols[si];
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){ const c=g[y][x]; if(!c) continue;
      body+=`<rect x='${sx+x*cell}' y='${y0+y*cell}' width='${cell}' height='${cell}' fill='${c==='eye'?C.text:body_col}'/>`; }
    body+=`<text x='${sx+n*cell/2}' y='${y0+n*cell+20}' ${MONO} font-size='11' fill='${C.muted}' text-anchor='middle'>seed ${seed}</text>`;
  });
  return wrap(W,H,body);
}

// ============================================================ build + embed
const FIGS = { stack: figStack(), anatomy: figAnatomy(), zones: figZones(), sprites: figSprites() };
// alt text (stable — used to find the figure in the chapter) + caption
const META = {
  anatomy: ['Anatomy of an arcr game: directives, objects, and rules',
    'Anatomy of a game — a few `@directives`, the objects, then the rules; each rule reads *event → condition → action*.'],
  sprites: ['Six procedural gewgaw sprites generated from different seeds',
    'The `sprite` kind: the engine grows a unique, mirror-symmetric pixel creature from a seed — same seed, same creature, every device.'],
  stack: ['The capsule to cradle to gewgaw pipeline',
    'How a game travels — a few lines of arcr text, deflated into a QR-sized capsule, resolved by the static cradle bootloader, and rendered by the gewgaw engine. Offline; no third-party code runs.'],
  zones: ['The portrait play surface and its placement zones',
    'You never position a pixel: objects drop into named zones (`at=top`, `at=center`, …) and the engine lays them out; `at=scatter` sprinkles them at random.'],
};
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let doc = fs.readFileSync(CHAPTER, 'utf8');
for (const [key, svg] of Object.entries(FIGS)) {
  const [alt, cap] = META[key];
  const block = `![${alt}](${dataUrl(svg)})\n\n*${cap}*`;
  const marker = `<!--FIG:${key}-->`;
  // an already-embedded figure: the image line + its optional caption line
  const existing = new RegExp('!\\[' + esc(alt) + '\\]\\([^)]*\\)(\\s*\\n\\s*\\*[^\\n]*\\*)?');
  if (doc.includes(marker)) doc = doc.replace(marker, block);
  else if (existing.test(doc)) doc = doc.replace(existing, block);
  else { console.warn(`  ! FIG:${key} not found (no marker, no existing image) — add <!--FIG:${key}--> where it belongs`); continue; }
  if (PREVIEW) { const dir = path.join(here, '.preview'); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, `fig-${key}.svg`), svg); }
  const b64 = dataUrl(svg).split(',')[1];
  console.log(`  ${key}: ${(svg.length/1024).toFixed(1)} KB svg${/\+\+/.test(b64) ? '  ⚠ base64 has "++" (check renderMd inline-rule handling)' : ''}`);
}
fs.writeFileSync(CHAPTER, doc);
console.log(`embedded ${Object.keys(FIGS).length} figures → ${path.relative(process.cwd(), CHAPTER)}${PREVIEW ? '  (+ .preview/*.svg)' : ''}`);
