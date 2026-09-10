// 生成案例行业缩略图 PNG：把 tileSVG 几何图形渲染为位图，落到 public/images/cases/
// 用法：node scripts/generate-case-pngs.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const OUT = path.join(__dirname, '..', 'public', 'images', 'cases');
const SIZE = 108; // 列表 54px / 详情侧栏 32px，按 2x 生成

// 与 routes/frontendRoutes2026.js 中 tileSVG 保持一致的调色板
const PAL = [
  { bg: '#dbcdff', fg: '#5e35b1' }, { bg: '#d6e893', fg: '#50630c' }, { bg: '#fdcaae', fg: '#9c3904' },
  { bg: '#2e2056', fg: '#bda5ff' }, { bg: '#ffecc1', fg: '#8d6300' }, { bg: '#d8d6dd', fg: '#655c7a' },
];

function tileSVG(m, pal, S) {
  const f = pal.fg, b = pal.bg;
  const svgs = [
    () => { let d = ''; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) d += `<circle cx="${10 + i * (S - 20) / 3}" cy="${10 + j * (S - 20) / 3}" r="2.4" fill="${f}"/>`; return d },
    () => `<path d="M ${S * .15} ${S * .85} A ${S * .7} ${S * .7} 0 0 1 ${S * .85} ${S * .15}" stroke="${f}" stroke-width="2.5" fill="none"/>
         <path d="M ${S * .15} ${S * .6} A ${S * .45} ${S * .45} 0 0 1 ${S * .6} ${S * .15}" stroke="${f}" stroke-width="2.5" fill="none"/>
         <circle cx="${S * .22}" cy="${S * .22}" r="3.2" fill="${f}"/>`,
    () => { let d = ''; const h = [.35, .6, .45, .8]; for (let i = 0; i < 4; i++) d += `<rect x="${S * .14 + i * S * .19}" y="${S * (1 - h[i]) - S * .1}" width="${S * .11}" height="${S * h[i]}" fill="${f}"/>`; return d },
    () => { let d = ''; for (let k = 0; k < 3; k++) { d += `<path d="M 4 ${S * .3 + k * S * .22} q ${S * .25} ${-S * .14} ${S * .5} 0 t ${S * .5} 0" stroke="${f}" stroke-width="2" fill="none"/>` } return d },
    () => `<circle cx="${S * .5}" cy="${S * .5}" r="4.5" fill="${f}"/>
         <circle cx="${S * .2}" cy="${S * .25}" r="3" fill="${f}"/><circle cx="${S * .8}" cy="${S * .22}" r="3" fill="${f}"/>
         <circle cx="${S * .22}" cy="${S * .78}" r="3" fill="${f}"/><circle cx="${S * .78}" cy="${S * .8}" r="3" fill="${f}"/>
         <g stroke="${f}" stroke-width="1.2" opacity=".7">
         <line x1="${S * .5}" y1="${S * .5}" x2="${S * .2}" y2="${S * .25}"/><line x1="${S * .5}" y1="${S * .5}" x2="${S * .8}" y2="${S * .22}"/>
         <line x1="${S * .5}" y1="${S * .5}" x2="${S * .22}" y2="${S * .78}"/><line x1="${S * .5}" y1="${S * .5}" x2="${S * .78}" y2="${S * .8}"/></g>`,
    () => `<path d="M 0 ${S} A ${S * .5} ${S * .5} 0 0 1 ${S} ${S} Z" transform="translate(0,${-S * .18})" fill="${f}" opacity=".9"/>
         <rect x="0" y="${S * .86}" width="${S}" height="${S * .14}" fill="${f}"/>`,
    () => `<path d="M ${S * .1} ${S * .8} L ${S * .38} ${S * .55} L ${S * .55} ${S * .66} L ${S * .88} ${S * .22}" stroke="${f}" stroke-width="2.6" fill="none"/>
         <path d="M ${S * .72} ${S * .22} L ${S * .88} ${S * .22} L ${S * .88} ${S * .4}" stroke="${f}" stroke-width="2.6" fill="none"/>`,
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"><rect width="${S}" height="${S}" fill="${b}"/>${svgs[m]()}</svg>`;
}

// 行业 slug → [图形索引 m, 调色板索引 p]
const INDUSTRIES = {
  manufacturing: [4, 0],
  education: [0, 1],
  retail: [2, 2],
  game: [6, 3],
  finance: [2, 5],
  trade: [3, 4],
  property: [5, 0],
  other: [1, 1],
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [slug, [m, p]] of Object.entries(INDUSTRIES)) {
    const svg = tileSVG(m, PAL[p], SIZE);
    const file = path.join(OUT, `${slug}.png`);
    await sharp(Buffer.from(svg)).png().toFile(file);
    console.log('生成', file);
  }
  console.log('完成，共', Object.keys(INDUSTRIES).length, '张');
})().catch(err => { console.error(err); process.exit(1); });
