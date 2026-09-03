/* 本文件由 scripts/build-rh2026-engine.js 自动生成，请勿手改。源：public/js/rh2026.js */
/* ================= 首页数据：五个买家问题（chips） ================= */
const HERO_QS=[
  {who:'CEO', q:'AI 转型该从哪切入？'},
  {who:'CHO', q:'混合员工怎么管？'},
  {who:'CIO', q:'Agent 怎么接进系统？'},
  {who:'一线', q:'试点怎么变量产？'},
  {who:'案例', q:'哪些场景已经跑通了？'},
];
/* 图块 6 色板（色彩规范 §5）：P200/P900/S200/A200/W100/N300 + 同色相深档前景 */
const PAL = [
  {bg:'#dbcdff',fg:'#5e35b1'},{bg:'#d6e893',fg:'#50630c'},{bg:'#fdcaae',fg:'#9c3904'},
  {bg:'#2e2056',fg:'#bda5ff'},{bg:'#ffecc1',fg:'#8d6300'},{bg:'#d8d6dd',fg:'#655c7a'},
];

/* ================= 图块 SVG 工厂 ================= */
function tileSVG(m,pal,s){
  const f=pal.fg,b=pal.bg,S=s;
  const svgs=[
    ()=>{let d='';for(let i=0;i<4;i++)for(let j=0;j<4;j++)d+=`<circle cx="${10+i*(S-20)/3}" cy="${10+j*(S-20)/3}" r="2.4" fill="${f}"/>`;return d},
    ()=>`<path d="M ${S*.15} ${S*.85} A ${S*.7} ${S*.7} 0 0 1 ${S*.85} ${S*.15}" stroke="${f}" stroke-width="2.5" fill="none"/>
         <path d="M ${S*.15} ${S*.6} A ${S*.45} ${S*.45} 0 0 1 ${S*.6} ${S*.15}" stroke="${f}" stroke-width="2.5" fill="none"/>
         <circle cx="${S*.22}" cy="${S*.22}" r="3.2" fill="${f}"/>`,
    ()=>{let d='';const h=[.35,.6,.45,.8];for(let i=0;i<4;i++)d+=`<rect x="${S*.14+i*S*.19}" y="${S*(1-h[i])-S*.1}" width="${S*.11}" height="${S*h[i]}" fill="${f}"/>`;return d},
    ()=>{let d='';for(let k=0;k<3;k++){d+=`<path d="M 4 ${S*.3+k*S*.22} q ${S*.25} ${-S*.14} ${S*.5} 0 t ${S*.5} 0" stroke="${f}" stroke-width="2" fill="none"/>`}return d},
    ()=>`<circle cx="${S*.5}" cy="${S*.5}" r="4.5" fill="${f}"/>
         <circle cx="${S*.2}" cy="${S*.25}" r="3" fill="${f}"/><circle cx="${S*.8}" cy="${S*.22}" r="3" fill="${f}"/>
         <circle cx="${S*.22}" cy="${S*.78}" r="3" fill="${f}"/><circle cx="${S*.78}" cy="${S*.8}" r="3" fill="${f}"/>
         <g stroke="${f}" stroke-width="1.2" opacity=".7">
         <line x1="${S*.5}" y1="${S*.5}" x2="${S*.2}" y2="${S*.25}"/><line x1="${S*.5}" y1="${S*.5}" x2="${S*.8}" y2="${S*.22}"/>
         <line x1="${S*.5}" y1="${S*.5}" x2="${S*.22}" y2="${S*.78}"/><line x1="${S*.5}" y1="${S*.5}" x2="${S*.78}" y2="${S*.8}"/></g>`,
    ()=>`<path d="M 0 ${S} A ${S*.5} ${S*.5} 0 0 1 ${S} ${S} Z" transform="translate(0,${-S*.18})" fill="${f}" opacity=".9"/>
         <rect x="0" y="${S*.86}" width="${S}" height="${S*.14}" fill="${f}"/>`,
    ()=>`<path d="M ${S*.1} ${S*.8} L ${S*.38} ${S*.55} L ${S*.55} ${S*.66} L ${S*.88} ${S*.22}" stroke="${f}" stroke-width="2.6" fill="none"/>
         <path d="M ${S*.72} ${S*.22} L ${S*.88} ${S*.22} L ${S*.88} ${S*.4}" stroke="${f}" stroke-width="2.6" fill="none"/>`,
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"><rect width="${S}" height="${S}" fill="${b}"/>${svgs[m]()}</svg>`;
}
/* 线性图标版图块（隧道 hero 专用）：深色卡面 + 细描边图形，不用色块填充 */
function tileLineSVG(m,pal,s){
  const L=pal.bg==='#2e2056'?pal.fg:pal.bg;  /* 深色卡面上取亮色做线 */
  const S=s,sw=2.2;
  const svgs=[
    ()=>{let d='';for(let i=0;i<4;i++)for(let j=0;j<4;j++)d+=`<circle cx="${10+i*(S-20)/3}" cy="${10+j*(S-20)/3}" r="2.6" fill="none" stroke="${L}" stroke-width="1.4"/>`;return d},
    ()=>`<path d="M ${S*.15} ${S*.85} A ${S*.7} ${S*.7} 0 0 1 ${S*.85} ${S*.15}" stroke="${L}" stroke-width="${sw}" fill="none"/>
         <path d="M ${S*.15} ${S*.6} A ${S*.45} ${S*.45} 0 0 1 ${S*.6} ${S*.15}" stroke="${L}" stroke-width="${sw}" fill="none"/>
         <circle cx="${S*.22}" cy="${S*.22}" r="3.4" fill="none" stroke="${L}" stroke-width="1.6"/>`,
    ()=>{let d='';const h=[.35,.6,.45,.8];for(let i=0;i<4;i++)d+=`<rect x="${S*.14+i*S*.19}" y="${S*(1-h[i])-S*.1}" width="${S*.11}" height="${S*h[i]}" rx="2" fill="none" stroke="${L}" stroke-width="1.6"/>`;return d},
    ()=>{let d='';for(let k=0;k<3;k++){d+=`<path d="M 4 ${S*.3+k*S*.22} q ${S*.25} ${-S*.14} ${S*.5} 0 t ${S*.5} 0" stroke="${L}" stroke-width="1.8" fill="none"/>`}return d},
    ()=>`<circle cx="${S*.5}" cy="${S*.5}" r="5" fill="none" stroke="${L}" stroke-width="1.6"/>
         <circle cx="${S*.2}" cy="${S*.25}" r="3.2" fill="none" stroke="${L}" stroke-width="1.4"/><circle cx="${S*.8}" cy="${S*.22}" r="3.2" fill="none" stroke="${L}" stroke-width="1.4"/>
         <circle cx="${S*.22}" cy="${S*.78}" r="3.2" fill="none" stroke="${L}" stroke-width="1.4"/><circle cx="${S*.78}" cy="${S*.8}" r="3.2" fill="none" stroke="${L}" stroke-width="1.4"/>
         <g stroke="${L}" stroke-width="1.1" opacity=".7">
         <line x1="${S*.45}" y1="${S*.47}" x2="${S*.23}" y2="${S*.28}"/><line x1="${S*.55}" y1="${S*.47}" x2="${S*.77}" y2="${S*.25}"/>
         <line x1="${S*.46}" y1="${S*.54}" x2="${S*.25}" y2="${S*.75}"/><line x1="${S*.54}" y1="${S*.54}" x2="${S*.75}" y2="${S*.77}"/></g>`,
    ()=>`<path d="M ${S*.06} ${S*.82} A ${S*.44} ${S*.44} 0 0 1 ${S*.94} ${S*.82}" stroke="${L}" stroke-width="${sw}" fill="none"/>
         <line x1="${S*.06}" y1="${S*.9}" x2="${S*.94}" y2="${S*.9}" stroke="${L}" stroke-width="${sw}"/>`,
    ()=>`<path d="M ${S*.1} ${S*.8} L ${S*.38} ${S*.55} L ${S*.55} ${S*.66} L ${S*.88} ${S*.22}" stroke="${L}" stroke-width="${sw}" fill="none"/>
         <path d="M ${S*.72} ${S*.22} L ${S*.88} ${S*.22} L ${S*.88} ${S*.4}" stroke="${L}" stroke-width="${sw}" fill="none"/>`,
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">`+
    `<rect x="1" y="1" width="${S-2}" height="${S-2}" rx="10" fill="#26222f" stroke="${L}" stroke-opacity=".45" stroke-width="1.4"/>`+
    svgs[m]()+`</svg>`;
}
/* 字符卡片（隧道 hero 专用）：深色卡面 + 品牌色字符，克制、留白 */
function tileWordSVG(word,pal,W,H){
  const L=pal.bg==='#2e2056'?pal.fg:pal.bg;
  const isLatin=!/[一-鿿]/.test(word);
  const unit=t=>{let u=0;for(const ch of t)u+=/[一-鿿]/.test(ch)?1:.62;return u};
  const wEscape=t=>t.replace(/&/g,'&amp;').replace(/</g,'&lt;');
  /* 长拉丁词组按空格折行（如 RUIHUA CONSULTING），宽字距小字号更显品牌感 */
  const lines=(isLatin&&word.includes(' ')&&unit(word)>8)?word.split(' '):[word];
  const maxU=Math.max(...lines.map(unit));
  const multi=lines.length>1;
  const ls=multi?'.3em':(isLatin?'.06em':'.14em');
  const lsAdd=multi?.3*(maxU/ .62)*.62:0; /* 宽字距占掉的宽度粗略补偿 */
  const fs=Math.min(multi?24:(isLatin?40:42),(W*.74)/Math.max(maxU*(multi?1.28:1),.62));
  const ff=isLatin
    ? "'JetBrains Mono','SF Mono',ui-monospace,Consolas,monospace"
    : "'PingFang SC','Microsoft YaHei',system-ui,sans-serif";
  const lh=fs*1.5;
  const y0=H/2-(lines.length-1)*lh/2;
  const texts=lines.map((ln,i)=>
    `<text x="${W/2}" y="${(y0+i*lh).toFixed(1)}" dy=".34em" text-anchor="middle" fill="${L}" `+
    `font-family="${ff}" font-size="${fs.toFixed(1)}" font-weight="600" letter-spacing="${ls}">${wEscape(ln)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`+
    `<rect x="1" y="1" width="${W-2}" height="${H-2}" rx="14" fill="#26222f" stroke="${L}" stroke-opacity=".42" stroke-width="1.4"/>`+
    `<circle cx="20" cy="20" r="2.4" fill="${L}" fill-opacity=".85"/>`+texts+
    `<line x1="${W/2-16}" y1="${H*.8}" x2="${W/2+16}" y2="${H*.8}" stroke="${L}" stroke-opacity=".5" stroke-width="2"/>`+
    `</svg>`;
}
/* 面性图标卡片（隧道 hero 专用）：深色卡面 + 品牌色实心图形 */
function tileSolidSVG(m,pal,s){
  const L=pal.bg==='#2e2056'?pal.fg:pal.bg;
  const S=s;
  const svgs=[
    ()=>{let d='';for(let i=0;i<4;i++)for(let j=0;j<4;j++)d+=`<circle cx="${S*.2+i*S*.2}" cy="${S*.2+j*S*.2}" r="4" fill="${L}" fill-opacity="${(i+j)%2?'.45':'.95'}"/>`;return d},
    ()=>`<path d="M ${S*.16} ${S*.84} A ${S*.68} ${S*.68} 0 0 1 ${S*.84} ${S*.16} L ${S*.84} ${S*.34} A ${S*.5} ${S*.5} 0 0 0 ${S*.34} ${S*.84} Z" fill="${L}" fill-opacity=".9"/>
        <circle cx="${S*.24}" cy="${S*.24}" r="5" fill="${L}"/>`,
    ()=>{let d='';const h=[.35,.6,.45,.8];for(let i=0;i<4;i++)d+=`<rect x="${S*.14+i*S*.19}" y="${S*(1-h[i])-S*.1}" width="${S*.12}" height="${S*h[i]}" rx="3" fill="${L}" fill-opacity="${i===3?'1':'.7'}"/>`;return d},
    ()=>`<path d="M 0 ${S*.55} Q ${S*.25} ${S*.38} ${S*.5} ${S*.55} T ${S} ${S*.55} L ${S} ${S} L 0 ${S} Z" fill="${L}" fill-opacity=".4"/>
        <path d="M 0 ${S*.68} Q ${S*.25} ${S*.52} ${S*.5} ${S*.68} T ${S} ${S*.68} L ${S} ${S} L 0 ${S} Z" fill="${L}" fill-opacity=".85"/>`,
    ()=>`<g stroke="${L}" stroke-width="2" stroke-opacity=".55">
        <line x1="${S*.5}" y1="${S*.5}" x2="${S*.2}" y2="${S*.25}"/><line x1="${S*.5}" y1="${S*.5}" x2="${S*.8}" y2="${S*.22}"/>
        <line x1="${S*.5}" y1="${S*.5}" x2="${S*.22}" y2="${S*.78}"/><line x1="${S*.5}" y1="${S*.5}" x2="${S*.78}" y2="${S*.8}"/></g>
        <circle cx="${S*.5}" cy="${S*.5}" r="7" fill="${L}"/>
        <circle cx="${S*.2}" cy="${S*.25}" r="4.5" fill="${L}" fill-opacity=".85"/><circle cx="${S*.8}" cy="${S*.22}" r="4.5" fill="${L}" fill-opacity=".85"/>
        <circle cx="${S*.22}" cy="${S*.78}" r="4.5" fill="${L}" fill-opacity=".85"/><circle cx="${S*.78}" cy="${S*.8}" r="4.5" fill="${L}" fill-opacity=".85"/>`,
    ()=>`<path d="M ${S*.08} ${S*.82} A ${S*.42} ${S*.42} 0 0 1 ${S*.92} ${S*.82} Z" fill="${L}" fill-opacity=".9"/>
        <rect x="${S*.08}" y="${S*.87}" width="${S*.84}" height="${S*.05}" rx="2" fill="${L}"/>`,
    ()=>`<path d="M ${S*.1} ${S*.82} L ${S*.38} ${S*.55} L ${S*.55} ${S*.66} L ${S*.88} ${S*.24} L ${S*.88} ${S*.9} L ${S*.1} ${S*.9} Z" fill="${L}" fill-opacity=".35"/>
        <path d="M ${S*.1} ${S*.82} L ${S*.38} ${S*.55} L ${S*.55} ${S*.66} L ${S*.88} ${S*.24}" stroke="${L}" stroke-width="3" fill="none"/>
        <circle cx="${S*.88}" cy="${S*.24}" r="4.5" fill="${L}"/>`,
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">`+
    `<rect x="1" y="1" width="${S-2}" height="${S-2}" rx="12" fill="#26222f" stroke="${L}" stroke-opacity=".42" stroke-width="1.4"/>`+
    svgs[m]()+`</svg>`;
}

/* ================= 首页：透视缩略图流（Canvas 逐帧） =================
   逼近参考站预渲染视频的质感：真透视投影 + 连续缩放 + 运动模糊 + 深度排序遮挡 */
(function(){
  const cv=document.getElementById('tlStream');
  if(!cv||!cv.getContext)return;
  const ctx=cv.getContext('2d');
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const r=_rng(1337);

  /* —— 1. 预渲染图块位图（离屏，避免每帧解析 SVG） —— */
  const SPRITES=[];
  const POPS=[['#7c4dff','#c957ff'],['#9db83a','#d6e893'],['#c85a1e','#fdcaae'],['#5e35b1','#bda5ff']];
  const SPR_W=224,SPR_H=126;
  function makeSprite(i){
    const W=SPR_W,H=SPR_H,c=document.createElement('canvas');
    c.width=W*2;c.height=H*2;const x=c.getContext('2d');x.scale(2,2);
    if(i%6===0){                                   /* 彩色渐变块（点缀） */
      const p=POPS[i%POPS.length],g=x.createLinearGradient(0,0,W,H);
      g.addColorStop(0,p[0]);g.addColorStop(1,p[1]);
      x.fillStyle=g;x.fillRect(0,0,W,H);
      return c;
    }
    const pal=PAL[i%PAL.length];
    x.fillStyle=pal.bg;x.fillRect(0,0,W,H);
    x.strokeStyle=pal.fg;x.fillStyle=pal.fg;
    x.lineWidth=5;x.lineCap='round';x.lineJoin='round';
    const k=i%6;
    if(k===0){                                     /* 折线增长 */
      x.beginPath();x.moveTo(24,96);x.lineTo(78,58);x.lineTo(112,74);x.lineTo(196,26);x.stroke();
      x.beginPath();x.moveTo(160,26);x.lineTo(196,26);x.lineTo(196,58);x.stroke();
    }else if(k===1){                               /* 柱状 */
      [42,66,50,88].forEach((hh,j)=>x.fillRect(38+j*38,104-hh,24,hh));
    }else if(k===2){                               /* 网点 */
      for(let a2=0;a2<5;a2++)for(let b2=0;b2<3;b2++){
        x.beginPath();x.arc(48+a2*32,36+b2*28,5,0,6.2832);x.fill();}
    }else if(k===3){                               /* 波纹 */
      for(let n=0;n<3;n++){x.beginPath();
        for(let px=14;px<=210;px+=6){
          const py=40+n*24+Math.sin((px/34)+n)*9;
          px===14?x.moveTo(px,py):x.lineTo(px,py);}
        x.stroke();}
    }else if(k===4){                               /* 节点网络 */
      const pts=[[112,63],[52,34],[176,30],[58,96],[172,98]];
      x.globalAlpha=.65;
      pts.slice(1).forEach(p=>{x.beginPath();x.moveTo(112,63);x.lineTo(p[0],p[1]);x.stroke()});
      x.globalAlpha=1;
      pts.forEach((p,j)=>{x.beginPath();x.arc(p[0],p[1],j?6:10,0,6.2832);x.fill()});
    }else{                                         /* 半圆 */
      x.beginPath();x.arc(112,104,62,Math.PI,0);x.fill();
    }
    return c;
  }
  for(let i=0;i<18;i++)SPRITES.push(makeSprite(i));

  /* —— 2. 场景：多条缎带，每条由若干图块沿深度轴排列 —— */
  const BANDS=[];
  const NB=6;                       /* 缎带数 */
  for(let b=0;b<NB;b++){
    const tiles=[];
    const N=19;
    for(let i=0;i<N;i++){
      tiles.push({
        u:(i/N)+r()*0.006,          /* 0→1 沿缎带的位置（0 远 1 近） */
        sp:SPRITES[Math.floor(r()*SPRITES.length)],
        jit:(r()-0.5)*0.016,        /* 纵向抖动（很小，保持链条感） */
        rot:(r()-0.5)*0.035
      });
    }
    BANDS.push({
      tiles,
      y0:-0.10+b*0.175,             /* 起点高度（比例） */
      slope:0.34+r()*0.05,          /* 下行斜率 */
      speed:(0.0135+b*0.0034),      /* 越近越快 */
      arc:0.05+r()*0.025            /* 弧度 */
    });
  }

  let W=0,H=0,dpr=1,last=0,t0=0;
  function resize(){
    dpr=Math.min(devicePixelRatio||1,2);
    W=cv.clientWidth;H=cv.clientHeight;
    cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resize();
  addEventListener('resize',resize);

  /* —— 3. 逐帧渲染 —— */
  function frame(now){
    if(!t0)t0=now;
    const dt=Math.min((now-last)||16,50);last=now;
    const el=(now-t0)/1000;
    ctx.clearRect(0,0,W,H);

    /* 收集全部图块，按深度排序后绘制（近的压住远的） */
    const draw=[];
    BANDS.forEach(bd=>{
      bd.tiles.forEach(tl=>{
        let u=tl.u+(reduce?0:el*bd.speed);
        u=u%1.18;                                   /* 略超 1 以便驶出画面 */
        if(u<0)u+=1.18;
        const t=u;                                  /* 0 远 → 1 近 */
        /* 透视：z 从远到近，投影缩放 */
        const z=1-t;
        const scale=0.055+Math.pow(t,2.35)*1.0;     /* 连续缩放（关键） */
        const x=(-0.16+t*1.42)*W;                   /* 左上 → 右下 */
        const y=(bd.y0+t*bd.slope+Math.sin(t*Math.PI)*bd.arc+tl.jit)*H;
        const w=SPR_W*scale;
        const hgt=SPR_H*scale;
        if(x+w<-40||x-w>W+40||y+hgt<-40||y-hgt>H+40)return;
        draw.push({t,z,x,y,w,h:hgt,sp:tl.sp,rot:tl.rot,
                   alpha:Math.min(1,0.06+Math.pow(t,0.72)*1.05),
                   blur:Math.pow(1-t,2.6)*9});
      });
    });
    draw.sort((a,b)=>a.t-b.t);                      /* 远的先画 */

    draw.forEach(d=>{
      ctx.save();
      ctx.globalAlpha=d.alpha;
      if(d.blur>0.35)ctx.filter='blur('+d.blur.toFixed(1)+'px)';
      ctx.translate(d.x,d.y);
      ctx.rotate(d.rot);
      /* 圆角裁切 */
      const rr=Math.max(2,d.w*0.045);
      ctx.beginPath();
      if(ctx.roundRect)ctx.roundRect(-d.w/2,-d.h/2,d.w,d.h,rr);
      else ctx.rect(-d.w/2,-d.h/2,d.w,d.h);
      ctx.clip();
      ctx.drawImage(d.sp,-d.w/2,-d.h/2,d.w,d.h);
      ctx.restore();
    });

    if(!reduce)requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  setTimeout(()=>cv.classList.add('ready'),200);
})();

/* ================= 首页：问题 chips + AI 顾问演示窗打字机 ================= */
(function(){
  const box=document.getElementById('tlChips');
  if(!box)return;
  const preset=box.querySelectorAll('button[data-q]');
  if(preset.length){
    /* SSR 已预渲染：仅绑定事件，保证源码可见（GEO 友好） */
    preset.forEach(b=>b.onclick=()=>askFromMap(b.dataset.q));
  }else{
    /* 兜底：容器为空时动态生成 */
    HERO_QS.forEach(x=>{
      const b=document.createElement('button');
      b.innerHTML=`<b>${x.who}</b>${x.q}`;
      b.onclick=()=>askFromMap(x.q);
      box.appendChild(b);
    });
  }
})();
(function(){
  const el=document.getElementById('dmType');
  if(!el)return;
  /* 优先使用 SSR 预渲染文案，回退到内置常量 */
  const TXT=(el.textContent||'').trim()||'不要从最复杂的核心业务开始。优先选高频、高人力、流程标准化的场景，通常 2–4 周就能验证价值。';
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){
    el.textContent=TXT;
    document.getElementById('dmCaret').style.display='none';
    document.getElementById('dmSrcs').style.opacity='1';
    return;
  }
  let i=0;
  setTimeout(function tick(){
    if(i<=TXT.length){
      el.textContent=TXT.slice(0,i); i+=2;
      setTimeout(tick,34);
    }else{
      document.getElementById('dmCaret').style.display='none';
      document.getElementById('dmSrcs').style.opacity='1';
    }
  },1900);
})();

/* ================= 滚动：导航阴影 + 区块入场 + 文章阅读进度 ================= */
addEventListener('scroll',()=>{
  document.getElementById('nav').classList.toggle('scrolled',scrollY>10);
  updateProgress();
  updateCaseProgress();
},{passive:true});
const io=new IntersectionObserver(es=>{
  es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}});
},{threshold:.12,rootMargin:'0px 0px -8% 0px'});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

/* ================= AI 顾问 ================= */
const KB=[
 {k:['切入','从哪','开始','入手','场景选'],a:`<strong>不要从最复杂的核心业务开始。</strong>优先选高频、高人力、流程相对标准化的场景——客服工单、招聘筛选、费用报销这类。数据积累充分、容错空间大，通常 <strong>2–4 周就能验证价值</strong>，建立信心后再扩展到核心环节。我们的「场景诊断」就是帮你把投入产出比最高的切入点筛出来。`,
  rag:['已检索 常见问题','已检索 交付方法'],src:[['预约「AI 场景诊断」','服务入口','/contact'],['三位一体交付模式','首页','/','home-svc']]},
 {k:['混合员工','怎么管','绩效','考核','分工','人力','CHO'],a:`这正是我们咨询板块「<strong>组织管理机制优化（碳硅共智）</strong>」解决的问题：人机分工怎么划、混合工作流怎么设计、<strong>碳硅双轨绩效与激励体系</strong>怎么建。母公司人瑞人才 15 年人力资本经营的方法论，是我们和纯技术公司最大的差别。`,
  rag:['已检索 AI转型咨询','已检索 HCVM 体系'],src:[['AI 转型咨询 · 组织管理机制优化','产品与服务','/solutions/consulting'],['人力资本价值经营 HCVM','产品与服务','/hcvm']]}, 
 {k:['多久','见效','周期','多长时间'],a:`分两段：<strong>原型验证 2–4 周</strong>，用真实业务数据跑通核心链路；<strong>完整部署并产生可量化结果一般 4–8 周</strong>，取决于场景复杂度和系统对接情况。我们边部署边调优，缩短从「能看到效果」到「稳定运行」的周期。`,
  rag:['已检索 常见问题'],src:[['常见问题 · 部署周期','首页 FAQ','/','home-faq']]},
 {k:['接进','系统','部署','私有化','数据安全','对接','CIO'],a:`两种部署形态按数据安全要求选：<strong>WorkBuddy 企业版</strong>（腾讯云成熟架构，即开即用，适合快速验证）或<strong>基于自研开源架构的私有化部署</strong>——Agent 运行在你自己的环境里，数据不出域。系统打通是 FDE 交付「选→育→用→优」里「育」的核心环节。`,
  rag:['已检索 AI落地陪跑','已检索 部署形态'],src:[['AI 落地陪跑 · 两种部署形态','产品与服务','/solutions/fde'],['七步交付闭环','AI 落地陪跑','/solutions/fde']]},
 {k:['试点','量产','用不起来','推广','规模','一线'],a:`70% 的 Agent 项目死在「<strong>演示很美，业务用不起来</strong>」。我们的 FDE 服务就是把 Agent 从演示拽进业务流：驻场部署、和你的团队一起跑、持续调优，直到<strong>团队自己会跑</strong>——服务的终点是让你不再需要我们。`,
  rag:['已检索 FDE 服务','已检索 常见问题'],src:[['FDE 全生命周期：选→育→用→优','AI 落地陪跑','/solutions/fde'],['真实跑进业务流的案例','行业案例','/cases']]},
 {k:['跑通','案例','哪些场景','行业','别人'],a:`目前 <strong>27 个行业案例</strong>覆盖制造、零售、金融、物业等 8 个行业。几个真实数字：物业工单响应 <strong>3 秒</strong>、招聘周期 <strong>3周→1周</strong>、酒店高频问询 <strong>70%+ 自动处理</strong>、海尔智家员工自建智能体 <strong>262 个</strong>。高频成熟的是五大战队：营销获客、HR、财务、服务、研发。`,
  rag:['已检索 行业案例 ×27','已检索 五大场景'],src:[['行业案例库（8 个行业）','行业案例','/cases'],['五大 Agent 战队','首页','/','home-evidence']]},
 {k:['多少钱','价格','收费','费用','投入','报价','预算'],lead:true,
  a:`投入分平台工具费、实施服务费和内部人力三块，<strong>具体金额因企业规模和场景差异很大</strong>，在这里报一个数字对你没有意义也不负责任。比较好的方式是先做一次轻量的「AI 场景诊断」，明确范围后给精准预算——相比从零自建，通常能省 60% 以上试错成本。`,
  rag:['已检索 常见问题'],src:[['预约「AI 场景诊断」','服务入口','/contact']]},
 {k:['文章','洞察','研究','智库','读','观点'],a:`研究中心分两块：<strong>行业洞察</strong>来自三大智库（CIO 数智化转型 / CEO 经营增长 / CHO 人效提升），<strong>经营智库</strong>沉淀 R=B×O 的方法论与管理实践框架。每篇文章都标了内容状态——全文入站可直接读，章节导读的原文在旧站，即将发布的可以订阅提醒。`,
  rag:['已检索 研究中心','已检索 文章库状态'],src:[['行业洞察 · 三大智库','研究中心','/insights/industry'],['经营智库 · R=B×O','研究中心','/insights/thinktank']]},
];
const FALLBACK={a:`没有在官网内容中检索到相关信息。你可以换个说法再问，试试下面的常见问题，或者留下联系方式，<strong>顾问会在 24 小时内</strong>给你答复。`,rag:['全站检索 · 未命中'],src:[]};

/* ===== 全站内容索引与检索：文章 / 27 案例 / 课程 / 全部页面板块 ===== */
let SITE_IX=null;
function _stripHTML(h){const d=document.createElement('div');d.innerHTML=h;return d.textContent.replace(/\s+/g,' ').trim()}
function buildSiteIndex(){
  if(SITE_IX)return SITE_IX;
  const ix=[];
  ART_DB.forEach(a=>ix.push({t:a.title,s:(a.abstract||'')+' '+_stripHTML(a.body||''),h:a.slug?'/insights/'+encodeURIComponent(a.slug):'/insights',w:'研究中心 · '+a.cat}));
  CASE_DB.forEach(c=>ix.push({t:c.title,
    s:[c.bg,...(c.prob||[]),...(c.goal||[]),...(c.sol||[]),...(c.stats||[]).map(x=>x.join(' '))].join(' '),
    h:'/cases',w:'行业案例 · '+c.ind}));
  const txt=el=>el?el.textContent.replace(/\s+/g,' ').trim():'';
  const PAGES=[['/','首页','homeMain',null],['/solutions','产品与服务 · 总览',null,'solutions'],
    ['/solutions/training','AI 赋能培训',null,'p-training'],['/solutions/consulting','AI 转型咨询',null,'p-consulting'],
    ['/solutions/fde','AI 落地陪跑',null,'p-fde'],['/hcvm','人力资本价值经营',null,'hcvm'],
    ['/about','关于我们',null,'about'],['/contact','预约诊断',null,'contact'],
    ['/insights/industry','研究中心 · 行业洞察',null,'i-industry'],['/insights/thinktank','研究中心 · 经营智库',null,'i-thinktank']];
  PAGES.forEach(([h,w,id,pg])=>{
    const root=id?document.getElementById(id):document.querySelector('.page[data-page="'+pg+'"]');
    if(!root)return;
    root.querySelectorAll('.mini,.course,.faq-item,.stage,.pv-card,.tl-card,.zrow,.race .rc,.step7,.expert,.track').forEach(b=>{
      const s=txt(b);
      if(s.length<12)return;
      const t=txt(b.querySelector('.t,summary,h4,h3,.tname,.nm'))||s.slice(0,24);
      ix.push({t:t.slice(0,42),s,h,w});
    });
    ix.push({t:w,s:txt(root).slice(0,4000),h,w:'页面'});
  });
  SITE_IX=ix;return ix;
}
function siteSearch(q){
  const ix=buildSiteIndex(), ql=q.toLowerCase();
  const terms=[];
  (ql.match(/[a-z0-9]+/g)||[]).forEach(t=>{if(t.length>1)terms.push(t)});
  const cjk=ql.replace(/[^一-鿿]/g,'');
  for(let i=0;i<cjk.length-1;i++)terms.push(cjk.slice(i,i+2));
  if(!terms.length&&cjk)terms.push(cjk);
  if(!terms.length){const w=ql.trim();if(w.length>1)terms.push(w)}  /* 纯符号/单字母查询：整串匹配 */
  if(!terms.length)return[];
  const seen=new Set(),scored=[];
  ix.forEach(e=>{
    const tl=e.t.toLowerCase(),sl=e.s.toLowerCase();
    let sc=0,fp=-1;
    terms.forEach(t=>{
      if(tl.includes(t))sc+=3;
      const p=sl.indexOf(t);
      if(p>=0){sc+=1;if(fp<0)fp=p}
    });
    if(sc>=(terms.length>1?2:1)){
      const key=e.t+'|'+e.h;
      if(seen.has(key))return;
      seen.add(key);
      scored.push({e,sc,fp:Math.max(fp,0)});
    }
  });
  scored.sort((a,b)=>b.sc-a.sc);
  return scored.slice(0,3).map(({e,fp})=>{
    const st=Math.max(0,fp-16);
    let snip=e.s.slice(st,st+76);
    if(st>0)snip='…'+snip;
    if(st+76<e.s.length)snip+='…';
    return {t:e.t,snip,h:e.h,w:e.w};
  });
}
const CHIPQ=['AI 转型该从哪切入？','部署要多久见效？','混合员工怎么管？','哪些场景已经跑通了？','大概要投入多少？'];

const drawer=document.getElementById('drawer');
const body=document.getElementById('dwBody');
const chipsBox=document.getElementById('dwChips');
let opened=false, answers=0, leadShown=false, dwOpenedAt=0;
CHIPQ.forEach(q=>{
  const b=document.createElement('button');b.textContent=q;b.onclick=()=>{ask(q)};chipsBox.appendChild(b);
});
function openDrawer(){
  dwOpenedAt=Date.now();
  drawer.classList.add('open');
  if(!opened){opened=true;
    aiMsg(`你好，我是瑞华的 AI 顾问，已接入官网<strong>全站内容检索</strong>——产品与服务、27 个行业案例、12 门课程、研究中心文章都能搜到，来源可一键跳转。<strong>可以问我怎么切入、怎么部署、怎么管混合员工</strong>，也可以直接搜任何站内内容。<span class="demo-tag">演示态 · 检索来自站内真实索引，回答未接入大模型</span>`);
  }
  setTimeout(()=>document.getElementById('dwInput').focus(),350);
}
function closeDrawer(){drawer.classList.remove('open')}
/* 来源卡跳转：关抽屉 → 切路由 → 定位到具体板块 */
function goSrc(h,el){
  if(!h)return;
  closeDrawer();
  const scrollToEl=()=>{if(el){const t=document.getElementById(el);if(t)t.scrollIntoView({behavior:'smooth',block:'start'})}};
  if(location.hash===h){ if(el)scrollToEl(); else route(); }
  else{ location.hash=h; if(el)setTimeout(scrollToEl,380); }
}
/* 点击抽屉外任意位置收起；Esc 同样收起 */
document.addEventListener('click',e=>{
  const trigger=e.target.closest('[data-action="open-drawer"]');
  if(trigger){openDrawer();return}
  if(!drawer.classList.contains('open'))return;
  if(Date.now()-dwOpenedAt<400)return;                 /* 忽略触发打开的那一次点击 */
  if(!document.documentElement.contains(e.target))return; /* 元素被移除（如卡片替换）不算外部 */
  if(drawer.contains(e.target))return;
  closeDrawer();
});
addEventListener('keydown',e=>{if(e.key==='Escape'&&drawer.classList.contains('open'))closeDrawer()});
function askFromMap(q){openDrawer();setTimeout(()=>ask(q),opened?150:600)}
function esc(s){return s.replace(/</g,'&lt;')}
function meMsg(t){
  body.insertAdjacentHTML('beforeend',`<div class="msg me"><span class="who">我</span><div class="bubble">${esc(t)}</div></div>`);
  body.scrollTop=body.scrollHeight;
}
function aiMsg(html,extra=''){
  body.insertAdjacentHTML('beforeend',`<div class="msg ai"><span class="who">AI</span><div class="bubble">${html}${extra}</div></div>`);
  body.scrollTop=body.scrollHeight;
}
function ask(q){
  meMsg(q);
  RH_TALK.push({r:'me',t:q,rag:[],src:[]});
  saveTalk();
  const tid='t'+Date.now();
  body.insertAdjacentHTML('beforeend',`<div class="msg ai" id="${tid}"><span class="who">AI</span><div class="bubble"><span class="typing"><i></i><i></i><i></i></span></div></div>`);
  body.scrollTop=body.scrollHeight;
  let hit=KB.find(e=>e.k.some(k=>q.includes(k)));
  if(!hit){
    /* 无预置命中 → 全站内容检索 */
    const rs=siteSearch(q);
    if(rs.length){
      hit={
        a:`在官网内容中检索到 <strong>${rs.length} 处</strong>相关内容，点击来源可直接跳转：`+
          rs.map(r=>`<div style="margin-top:9px;font-size:12.5px;line-height:1.8;color:inherit;opacity:.85">「${esc(r.snip)}」</div>`).join(''),
        rag:['全站检索 · 命中 '+rs.length+' 处'],
        src:rs.map(r=>[r.t,r.w,r.h])
      };
    } else hit=FALLBACK;
  }
  setTimeout(()=>{
    document.getElementById(tid).remove();
    let extra='';
    if(hit.rag&&hit.rag.length)extra+=`<div class="rag">${hit.rag.map(r=>`<span>● ${r}</span>`).join('')}</div>`;
    if(hit.src&&hit.src.length)extra+=`<div class="srcs">${hit.src.map(s=>`<a href="#${s[2]||''}" class="src" onclick="goSrc('${s[2]||''}','${s[3]||''}'); return false;" title="点击前往">${esc(s[0])}<em>${esc(s[1])} →</em></a>`).join('')}</div>`;
    aiMsg(hit.a,extra);
    RH_TALK.push({r:'ai',t:_stripHTML(hit.a),rag:hit.rag||[],src:hit.src||[]});
    saveTalk();
    answers++;
    if((hit.lead||answers>=2)&&!leadShown){leadShown=true;setTimeout(showLead,900)}
  },900+Math.random()*500);
}
function showLead(){
  body.insertAdjacentHTML('beforeend',`
  <div class="lead-card" id="leadCard">
    <div class="t">要不要把你的情况发给顾问？</div>
    <div class="s">留下联系方式，顾问会带着刚才聊到的内容，24 小时内给你初步建议。</div>
    <input id="ldName" placeholder="怎么称呼您">
    <input id="ldTel" type="tel" inputmode="tel" maxlength="20" placeholder="手机号">
    <button onclick="submitLead()">发给顾问</button>
    <div class="pp">提交即代表同意《隐私政策》· 仅用于本次咨询联络</div>
  </div>`);
  body.scrollTop=body.scrollHeight;
}
async function submitLead(){
  const nEl=document.getElementById('ldName'), tEl=document.getElementById('ldTel');
  const n=nEl.value.trim(), t=tEl.value.trim();
  clearErr(nEl); clearErr(tEl);
  if(!n){fieldErr(nEl,'请填写称呼');return}
  if(!t){fieldErr(tEl,'请填写手机号');return}
  if(!isCNPhone(t)){fieldErr(tEl,'请输入正确的手机号（1 开头的 11 位数字）');return}
  
  const btn = document.querySelector('#leadCard button');
  if(btn) { btn.disabled = true; btn.textContent = '提交中...'; }
  
  const params=new URLSearchParams(location.search),payload={
    name:n,phone:normPhone(t),
    source:location.pathname,
    leadPage:location.pathname,
    trigger:'AI 顾问内浮窗',
    device:detectDevice(),
    trail:RH_TRAIL.map(x=>({h:x.h,t:x.t,d:x.d,hit:!!x.hit})),
    talk:RH_TALK,
    landing_page:location.pathname+location.search,referrer:document.referrer
  };
  ['utm_source','utm_medium','utm_campaign','utm_term','utm_content'].forEach(k=>payload[k]=params.get(k)||'');
  
  try{
    const response=await fetch('/api/appointments/website',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(!response.ok)throw new Error('submit failed');
    document.getElementById('leadCard').innerHTML=`<div class="ok">✓ 已收到，顾问会在 24 小时内联系你</div>`;
    try{sessionStorage.removeItem('rh_talk');RH_TALK.length=0;}catch(e){}
  }catch(error){
    if(btn) { btn.disabled = false; btn.textContent = '发给顾问'; }
    fieldErr(tEl,'提交失败，请稍后重试');
  }
}
function send(){
  const i=document.getElementById('dwInput');
  const v=i.value.trim(); if(!v)return; i.value=''; ask(v);
}

/* ================= 产品 hero 生成图（品牌色 · 数据标注风，可整体替换为真实图片） ================= */
function _rng(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}}
let _artN=0;
const __noAnim=matchMedia('(prefers-reduced-motion: reduce)').matches;
function heroArt(kind,W,H){
  W=W||1600;H=H||900;
  const gid='g-'+kind+'-'+(++_artN);
  const AC={training:'#d6e893',consulting:'#bda5ff',fde:'#fdcaae',hcvm:'#ffecc1'}[kind]||'#bda5ff';
  const r=_rng({training:7,consulting:23,fde:41,hcvm:61}[kind]||7);
  const AN=!__noAnim;
  let s='';
  /* 底：径向紫光 + 高光渐晕 + 细网格 */
  s+=`<defs>
    <radialGradient id="${gid}" cx="72%" cy="40%" r="78%">
      <stop offset="0%" stop-color="#3b2a63"/><stop offset="52%" stop-color="#2a2338"/><stop offset="100%" stop-color="#211e28"/>
    </radialGradient>
    <radialGradient id="${gid}-v" cx="30%" cy="85%" r="70%">
      <stop offset="0%" stop-color="#5e35b1" stop-opacity=".2"/><stop offset="100%" stop-color="#5e35b1" stop-opacity="0"/>
    </radialGradient>
  </defs>`;
  s+=`<rect width="${W}" height="${H}" fill="url(#${gid})"/>`;
  s+=`<rect width="${W}" height="${H}" fill="url(#${gid}-v)"/>`;
  for(let x=0;x<=W;x+=64)s+=`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#4a4359" stroke-opacity=".18" stroke-width="1"/>`;
  for(let y=0;y<=H;y+=64)s+=`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#4a4359" stroke-opacity=".18" stroke-width="1"/>`;
  /* 标注框：带呼吸动效 */
  const tick=(x,y,w,hh,c,op)=>{
    const t=Math.min(w,hh)*.3;
    let o=`<g opacity="${op}">`;
    if(AN)o+=`<animate attributeName="opacity" values="${op};${(op*.35).toFixed(2)};${op}" dur="${(3.5+r()*4).toFixed(1)}s" begin="${(r()*4).toFixed(1)}s" repeatCount="indefinite"/>`;
    o+=`<rect x="${x}" y="${y}" width="${w}" height="${hh}" fill="${c}" fill-opacity=".13" stroke="${c}" stroke-width="2"/>`;
    [[x,y,1],[x+w,y,-1],[x,y+hh,1],[x+w,y+hh,-1]].forEach(([cx,cy,dx])=>{
      o+=`<line x1="${cx}" y1="${cy}" x2="${cx+dx*t}" y2="${cy}" stroke="${c}" stroke-width="3.5"/>`;
      o+=`<line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy+(cy>y?-1:1)*t}" stroke="${c}" stroke-width="3.5"/>`;});
    return o+'</g>'};
  for(let i=0;i<14;i++){
    const w=50+r()*160,hh=44+r()*120;
    s+=tick(W*.28+r()*W*.68,r()*H*.88,w,hh,r()>.6?AC:'#7c4dff',.24+r()*.32);
  }
  const dashFlow=AN?`<animate attributeName="stroke-dashoffset" from="0" to="-160" dur="6s" repeatCount="indefinite"/>`:'';
  if(kind==='training'){
    for(let i=0;i<5;i++){const bw=W*.10,bh=H*(.16+i*.13),x=W*.34+i*bw*1.22,y=H*.92-bh;
      s+=`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" fill="#7c4dff" fill-opacity="${.14+i*.05}" stroke="#bda5ff" stroke-opacity=".5" stroke-width="2"/>`;
      s+=`<circle cx="${x+bw/2}" cy="${y-26}" r="9" fill="${AC}">${AN?`<animate attributeName="r" values="9;12;9" dur="${2.4+i*.35}s" repeatCount="indefinite"/>`:''}</circle>`;
      if(i<4)s+=`<line x1="${x+bw/2}" y1="${y-26}" x2="${x+bw*1.22+bw/2}" y2="${y-H*.13-26}" stroke="${AC}" stroke-opacity=".7" stroke-width="2.5" stroke-dasharray="7 9">${dashFlow}</line>`;}
  }else if(kind==='consulting'){
    let pts=[];for(let i=0;i<=8;i++){pts.push([W*.30+i*W*.085,H*.78-Math.pow(i,1.6)*H*.028-r()*20])}
    const pstr=pts.map(p=>p.join(',')).join(' ');
    s+=`<polyline points="${pstr}" fill="none" stroke="#bda5ff" stroke-width="4" stroke-opacity=".85"/>`;
    s+=`<polyline points="${pstr}" fill="none" stroke="#ffffff" stroke-width="4" stroke-opacity=".55" stroke-dasharray="14 150">${AN?`<animate attributeName="stroke-dashoffset" from="0" to="-328" dur="4.5s" repeatCount="indefinite"/>`:''}</polyline>`;
    pts.forEach((p,i)=>{s+=`<circle cx="${p[0]}" cy="${p[1]}" r="${i%3===0?11:6}" fill="${i%3===0?AC:'#7c4dff'}" fill-opacity=".95">${AN&&i%3===0?`<animate attributeName="r" values="11;14;11" dur="${3+i*.2}s" repeatCount="indefinite"/>`:''}</circle>`;
      if(i%3===0)s+=`<circle cx="${p[0]}" cy="${p[1]}" r="20" fill="none" stroke="${AC}" stroke-opacity=".45" stroke-width="2">${AN?`<animate attributeName="r" values="20;30" dur="2.6s" repeatCount="indefinite"/><animate attributeName="stroke-opacity" values=".45;0" dur="2.6s" repeatCount="indefinite"/>`:''}</circle>`;});
  }else if(kind==='fde'){
    for(let i=0;i<6;i++){const x=W*.30+i*W*.095,y=H*.52;
      s+=`<rect x="${x}" y="${y}" width="54" height="54" rx="8" fill="#7c4dff" fill-opacity="${.2+i*.11}" stroke="${AC}" stroke-opacity=".7" stroke-width="2">${AN?`<animate attributeName="fill-opacity" values="${.2+i*.11};${.5+i*.08};${.2+i*.11}" dur="3s" begin="${i*.45}s" repeatCount="indefinite"/>`:''}</rect>`;
      if(i<5)s+=`<path d="M ${x+66} ${y+27} l 20 0 m -7 -7 l 7 7 l -7 7" stroke="${AC}" stroke-opacity=".8" stroke-width="3" fill="none" stroke-dasharray="5 6">${dashFlow}</path>`;}
    for(let gx=0;gx<3;gx++)for(let gy=0;gy<3;gy++){
      const cellOp=.25+r()*.4;
      s+=`<rect x="${W*.85+gx*46}" y="${H*.40+gy*46}" width="38" height="38" rx="6" fill="${AC}" fill-opacity="${cellOp}">${AN?`<animate attributeName="fill-opacity" values="${cellOp};${Math.min(.9,cellOp+.4)};${cellOp}" dur="${2+r()*3}s" begin="${r()*2}s" repeatCount="indefinite"/>`:''}</rect>`;}
    s+=tick(W*.845,H*.385,150,150,'#bda5ff',.75);
  }else{
    const cx1=W*.52,cy=H*.52,R1=H*.26,cx2=cx1+R1*1.62;
    [[cx1,R1,'#bda5ff',46,1],[cx2,R1*.8,AC,34,-1]].forEach(([cx,R,c,dur,dir])=>{
      s+=`<g>${AN?`<animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="${360*dir} ${cx} ${cy}" dur="${dur}s" repeatCount="indefinite"/>`:''}`;
      s+=`<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${c}" stroke-width="3" stroke-opacity=".8"/>`;
      s+=`<circle cx="${cx}" cy="${cy}" r="${R*.62}" fill="none" stroke="${c}" stroke-width="1.5" stroke-opacity=".45" stroke-dasharray="4 8"/>`;
      for(let a=0;a<12;a++){const th=a/12*6.2832;
        s+=`<line x1="${cx+Math.cos(th)*R}" y1="${cy+Math.sin(th)*R}" x2="${cx+Math.cos(th)*(R+14)}" y2="${cy+Math.sin(th)*(R+14)}" stroke="${c}" stroke-width="3" stroke-opacity=".8"/>`}
      s+='</g>';});
    s+=`<circle cx="${cx1}" cy="${cy}" r="10" fill="#bda5ff"/><circle cx="${cx2}" cy="${cy}" r="10" fill="${AC}"/>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
}
document.querySelectorAll('[data-art]').forEach(el=>{el.innerHTML+=heroArt(el.dataset.art)});

/* ================= Hero 元素下沉：字符卡/面性图标复用到四卡、Mega、产品 hero ================= */
const DECOR=(()=>{
  const map={training:['AI',1,[2,1]],consulting:['碳硅',3,[6,3]],fde:['Agent',2,[4,2]],hcvm:['人效',4,[5,4]]};
  const enc=s=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s);
  const out={};
  for(const k in map){
    const [w,p,ic]=map[k];
    out[k]={word:enc(tileWordSVG(w,PAL[p],264,165)),icon:enc(tileSolidSVG(ic[0],PAL[ic[1]],220))};
  }
  return out;
})();
function decoHTML(k,cls){
  const d=DECOR[k];if(!d)return'';
  return `<div class="${cls}"><span class="pd pd1"><img src="${d.word}" alt=""></span><span class="pd pd2"><img src="${d.icon}" alt=""></span></div>`;
}
document.querySelectorAll('.pv-card .art[data-art]').forEach(a=>{
  a.closest('.pv-card').insertAdjacentHTML('beforeend',decoHTML(a.dataset.art,'pv-deco'));
});
document.querySelectorAll('.p-hero .art[data-art]').forEach(a=>{
  const pg=a.closest('.page');
  if(!pg||!['p-training','p-consulting','p-fde','hcvm'].includes(pg.dataset.page))return;
  a.closest('.p-hero').insertAdjacentHTML('beforeend',decoHTML(a.dataset.art,'ph-deco'));
});
/* mega 菜单：每个 pane 的条目 hover 切换右侧预览图（淡入缩放动效） */
document.querySelectorAll('.mega-pane').forEach(pane=>{
  const prev=pane.querySelector('.m-prev'); if(!prev)return;
  const cache={};let cur='';
  function show(k,cap){
    if(!k||k===cur)return;cur=k;
    if(!cache[k])cache[k]=heroArt(k,860,520);
    const deco=(typeof DECOR!=='undefined'&&DECOR[k])?`<img class="mp-deco" src="${DECOR[k].word}" alt="">`:'';
    prev.innerHTML=`<div class="m-swap">${cache[k]}${deco}</div><span class="cap">${cap}</span>`;
  }
  const items=[...pane.querySelectorAll('.m-item[data-prev]')];
  items.forEach(it=>it.addEventListener('mouseenter',()=>show(it.dataset.prev,it.dataset.cap||'')));
  if(items[0])show(items[0].dataset.prev,items[0].dataset.cap||'');
});
/* ================= Mega 幕布：高度真实展开 / 跨项变形（Scale 式） ================= */
(function(){
  const sheet=document.getElementById('megaSheet');
  const dim=document.getElementById('megaDim');
  const nav=document.getElementById('nav');
  if(!sheet)return;
  const panes={};
  sheet.querySelectorAll('.mega-pane').forEach(p=>panes[p.dataset.pane]=p);
  const triggers=[...document.querySelectorAll('.nav-mt')];
  let openKey=null,closeTimer=null;
  function measure(p){const prev=p.style.position;return p.offsetHeight}
  function openMenu(key){
    clearTimeout(closeTimer);
    const pane=panes[key];if(!pane)return;
    if(openKey===key)return;
    Object.entries(panes).forEach(([k,p])=>p.classList.toggle('on',k===key));
    sheet.style.height=pane.offsetHeight+'px';
    sheet.classList.add('open');
    sheet.setAttribute('aria-hidden','false');
    dim.classList.add('on');
    triggers.forEach(t=>t.classList.toggle('act',t.dataset.menu===key));
    openKey=key;
  }
  function closeNow(){
    clearTimeout(closeTimer);
    sheet.style.height='0px';
    sheet.classList.remove('open');
    sheet.setAttribute('aria-hidden','true');
    dim.classList.remove('on');
    Object.values(panes).forEach(p=>p.classList.remove('on'));
    triggers.forEach(t=>t.classList.remove('act'));
    openKey=null;
  }
  function scheduleClose(){clearTimeout(closeTimer);closeTimer=setTimeout(closeNow,140)}
  triggers.forEach(t=>{
    t.addEventListener('mouseenter',()=>openMenu(t.dataset.menu));
    t.addEventListener('focus',()=>openMenu(t.dataset.menu));
  });
  /* 非触发项的导航链接：悬停即收 */
  document.querySelectorAll('#navLinks > a:not(.nav-mt)').forEach(a=>{
    a.addEventListener('mouseenter',scheduleClose);
  });
  nav.addEventListener('mouseleave',scheduleClose);
  sheet.addEventListener('mouseenter',()=>clearTimeout(closeTimer));
  sheet.querySelectorAll('.m-item').forEach(it=>it.addEventListener('click',closeNow));
  addEventListener('resize',()=>{if(openKey)sheet.style.height=panes[openKey].offsetHeight+'px'});
  addEventListener('keydown',e=>{if(e.key==='Escape'&&openKey)closeNow()});
  addEventListener('hashchange',closeNow);
})();

/* ================= 动态 logo 墙（SSR 预渲染 + JS 渐进增强） =================
   客户名单已在各页面 HTML 中预渲染（源码可见，GEO 友好），此处常量仅作兜底。
   若 track 已有 .lw-chip，则复用其内容生成无缝滚动副本；否则用常量生成。 */
const LW_NAMES=['华为','中国移动','国家电网','阿里巴巴','字节跳动','百度','菜鸟','海信集团','金蝶','新奥集团','国药控股','中国网通','京能集团','白沙集团','江苏核电','纳铁福','中航无线电电子研究所','人瑞人才','新兴铸管','新疆中泰集团','安徽建工集团','江西出版集团','东莞交投集团','盐城国投集团','淮安开控','洛阳文保集团','西安高新'];
const LW_HOME=['海尔智家','伊利集团','TCL 实业','中国银行','招商银行','万物云','华住集团','中兴通讯','找钢网','游族网络','创梦天地','茶颜悦色','鸣鸣很忙','慧算账','联想开天','鑫方盛集团'];
const LW_TEAM=['李宁','长安汽车','平安银行','金域医学','TCL','新华三'];
const _lwChip=n=>`<span class="lw-chip"><span class="dot"></span>${n}</span>`;
/* 渐进增强：优先复用 SSR 已渲染的 chip，否则用兜底名单生成；末尾补一份动画副本 */
function hydrateLW(el,fallbackList){
  if(!el)return;
  let one;
  if(el.querySelector('.lw-chip')){
    one=el.innerHTML;                          /* SSR 已预渲染，复用现有内容 */
  }else{
    one=fallbackList.map(_lwChip).join('');    /* 兜底动态生成 */
    el.innerHTML=one;
  }
  el.insertAdjacentHTML('beforeend',`<span class="lw-dup" style="display:contents">${one}</span>`);
}
(function initHomeLW(){ hydrateLW(document.getElementById('lwHome'),LW_HOME); })();
/* 关于页名单较短：兜底时单组重复 3 次保证循环无缝 */
(function initTeamLW(){ hydrateLW(document.getElementById('lwTeam'),[...LW_TEAM,...LW_TEAM,...LW_TEAM]); })();
(function initLW(){
  const top=document.getElementById('lwTop'),bot=document.getElementById('lwBot');
  if(!top)return;
  const half=Math.ceil(LW_NAMES.length/2);
  hydrateLW(top,LW_NAMES.slice(0,half));
  hydrateLW(bot,LW_NAMES.slice(half));
})();

/* ================= 子页路由 ================= */
const ROUTES=['solutions','cases','about','contact','article','hcvm','p-training','p-consulting','p-fde','i-industry','i-thinktank'];
function route(){
  // [engine patch] 非首页（无 #heroWrap）不执行 SPA 路由逻辑
  if(!document.getElementById('heroWrap')) return;
  const raw=(location.hash||'#/').replace('#/','');
  let [h,sub]=raw.split('/');
  if(h==='solutions'&&sub){ h = sub==='hcvm' ? 'hcvm' : 'p-'+sub; sub=''; }
  if(h==='insights'){ h = sub==='thinktank' ? 'i-thinktank' : 'i-industry'; sub=''; }
  const CASE_SLUG={manufacturing:'制造业',retail:'零售快消',finance:'金融财税',education:'教育',game:'游戏文娱',trade:'贸易物流',property:'物业地产',other:'其他'};
  const page=ROUTES.includes(h)?h:'home';
  document.getElementById('heroWrap').style.display = page==='home'?'':'none';
  document.getElementById('homeMain').style.display = page==='home'?'':'none';
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('on',p.dataset.page===page));
  const navKey = page.startsWith('p-')||page==='hcvm' ? 'solutions' : (page.startsWith('i-') ? 'insights' : page);
  document.querySelectorAll('#navLinks a').forEach(a=>{
    const href=a.getAttribute('href');
    a.classList.toggle('act', href==='#/'+navKey || (page==='home' && href==='#/'));
  });
  window.scrollTo(0,0);
  document.body.classList.toggle('home-on',page==='home');
  const showScope = page==='home' ? document.getElementById('homeMain')
    : document.querySelector('.page[data-page="'+page+'"]');
  if(typeof animReset==='function')animReset(showScope);
  document.getElementById('aProg').style.width='0';
  if(page==='article'){renderArticle(sub||'')}
  else{
    tocLinks=[];tocHeads=[];
    if(page==='cases')setCaseIndustry(sub&&CASE_SLUG[sub]?CASE_SLUG[sub]:'全部');
    if(sub==='team'&&page==='about'){
      const el=document.getElementById('about-team');
      if(el)setTimeout(()=>el.scrollIntoView({behavior:'smooth',block:'start'}),60);
    }
    /* 产品 tabs 高亮 */
    document.querySelectorAll('.p-tabs a').forEach(t=>{
      t.classList.toggle('on', t.dataset.pt===page || (!t.dataset.pt&&page==='solutions'));
    });
  }
}
addEventListener('hashchange',route);

/* ===== 移动端菜单 ===== */
function toggleMnav(force){
  const on = force!==undefined && force!==null && typeof force==='boolean'
    ? force : !document.body.classList.contains('mnav-on');
  document.body.classList.toggle('mnav-on',on);
  const bg=document.getElementById('burger');
  if(bg)bg.setAttribute('aria-label',on?'关闭菜单':'打开菜单');
}
addEventListener('hashchange',()=>toggleMnav(false));
(function(){
  const m=document.getElementById('mnav');
  if(m)m.addEventListener('click',e=>{if(e.target.closest('a'))toggleMnav(false)});
})();

/* ================= 行业案例库（接收版 cases.html 全量 27 例，原文未改） ================= */
const INDS=['全部','制造业','教育','零售快消','游戏文娱','金融财税','贸易物流','物业地产','其他'];
const CASE_DB=[{"ind": "制造业", "title": "海尔智家 · 用 Agent OS 把 AI 能力交到每一位员工手上", "tags": ["1000+ 人", "研发 · 运营·供应链 · 数据分析 · 文书"], "bg": "一家横跨海尔/卡萨帝/Leader多品牌、全球200+国家和地区运营、员工约13.5万人的大型家电制造集团。AI能力停留在少数部门试点，一线员工卡在不会开发的门槛上。", "prob": ["① 工艺员把数小时耗在工艺编制上，老师傅经验传不下去", "② 经营数据靠人拉报表，出了问题层层追问才能定位原因", "③ 采购靠经验拍板，缺乏量化支撑", "④ 老图纸躺在档案室，调不出来、用不上"], "goal": ["① 工艺员从执行者变审核者，编制时长从数小时压到分钟级", "② 经营分析自动推送、自动追因，管理层看得见实时全局", "③ 采购决策有数据支撑、可量化、可复盘"], "sol": ["基于WorkBuddy/腾讯云全栈AI+ClawPro+自研智小能平台，落地企业级Agent OS", "智能工艺规划Agent：工艺员转审核者，编制分钟级", "经营分析Agent：每日自动推送经营报告+自动追因", "采购决策Agent：量化采购经验、结合历史行情辅助理性判断", "图纸识别Agent：老图纸AI识别→数字化系统", "全民开发者机制：员工自然语言描述需求，系统自动生成AI应用"], "resBody": [], "stats": [["262", "员工自建智能体"], ["5100", "轻应用"], ["↑20.7%", "研发型号效率"], ["↓10%", "采购成本"]]}, {"ind": "制造业", "title": "鑫方盛集团 · 用 ADP 把工业品供应链从头跑在 Agent 上", "tags": ["1000+ 人", "销售 · 财务 · 运营·供应链 · 数据分析"], "bg": "服务千万级SKU的工业品MRO一站式采购平台，业务覆盖全国90余家分支、年营收超百亿元。商品类目庞杂，票据审核与仓储配送高度依赖人工。", "prob": ["① 千万级SKU靠人工归类，类目错配频发", "② 询报价依赖人工比对清单与库存，报价慢、口径不一", "③ 票据审核海量且重复，财务人力被吞没", "④ 仓储配送路径靠经验排，履约时长压不下来"], "goal": ["① 商品标准化自动归类，四级类目准确率拉满", "② 询报价自动化，从人比清单变成系统秒出单", "③ 票据审核自动化，把财务从重复劳动里解放", "④ 仓配路径智能优化，履约时长与成本双降"], "sol": ["基于腾讯云CDC专有云+ADP智能体开发平台+自研方盛AI+底座，搭建供应链Agent体系", "商品标准化Agent：千万级SKU自动归类至四级类目，准确率97%", "智能询报价Agent：自动分析采购清单、匹配库存、生成报价单，效率↑180%", "票据审核Agent：RPA+Agent自动化，识别准确率98%、效率提升3倍", "仓配优化Agent：算法优化配送路径，订单履约时长缩短35%", "数据清洗管线：月消耗Token千亿级，支撑垂直大模型训练"], "resBody": [], "stats": [["200+", "智能体"], ["100+", "RPA流程"], ["↑60%+", "整体运营效率"], ["↓30%", "IT成本"]]}, {"ind": "制造业", "title": "TCL 实业 · 用 CodeBuddy 让研发团队从改不动老代码里解放出来", "tags": ["1000+ 人"], "bg": "全球智能终端头部企业，产品横跨电视、手机、IoT多端，机型与系统版本庞杂、历史代码沉重。5年以上的代码无人维护，Android与iOS双端重复劳动。", "prob": ["① 5年以上无人维护的历史代码，谁都不敢改", "② Android到iOS跨平台迁移靠人工重写，适配周期以周计", "③ 整机API Bug定位修复慢，缺陷藏在深层调用里"], "goal": ["① 历史代码敢改、能改，改造工时大幅压缩", "② 跨端适配从周级压到天级", "③ 缺陷定位修复效率翻倍"], "sol": ["引入腾讯云CodeBuddy（Agentic模式），AI解读历史代码+功能改造+测试生成", "跨平台代码迁移Agent：Android到iOS自动适配，周期从2周压到2天", "整机API Bug修复Agent：自动定位深层调用、生成修复（播放卡顿8h→1.5h）", "配套研发效能培训+陪跑，把Agent用法沉淀进团队"], "resBody": [], "stats": [["90%+", "研发渗透度"], ["100%", "核心团队覆盖"], ["↑70%+", "编码效率"], ["↓80%+", "问题排查成本"]]}, {"ind": "制造业", "title": "某电力设计院 · 用知识库把合规审查从周级压到小时级", "tags": ["1000+ 人", "文书 · 法务·合规"], "bg": "大型国有电力设计机构，每年产出海量设计文档，背后是国标、行标、安全法规的硬性合规约束。设计审核靠人工逐条对照规范，标准一变全员返工。", "prob": ["① 设计文档vs国标/行标/安全法规，三方交叉审核靠人眼，漏审风险高", "② 标准规范一变更，历史文档要人工逐份同步，严重滞后", "③ 图纸与数学公式等非文本知识难结构化，经验传不下去"], "goal": ["① 合规审查从周级变小时级，且证据链完整", "② 标准变更自动同步到知识库", "③ 老文档、老图纸变成可检索、可复用的知识资产"], "sol": ["WorkBuddy+腾讯乐享知识库+定制Skills，搭建文档合规审查Agent", "知识图谱构建：文档转Markdown，深度处理图纸与数学公式", "动态知识治理：标准变更自动同步，知识库持续更新", "配套合规/知识管理培训+陪跑"], "resBody": ["全覆盖", "证据链", "主动预警", "风险"], "stats": [["周→小时", "审查周期"]]}, {"ind": "教育", "title": "西安经开第十小学 · 用 WorkBuddy 把备课时间压掉 80%+", "tags": ["200–1000 人", "内容·创意 · 数据分析"], "bg": "陕西省人工智能教育示范校，全学科教师每天被备课、出卷、成绩分析淹没。优质课件靠老师手工做，学情报告靠Excel拉——重复劳动吞掉了真正用于教的时间。", "prob": ["① 备课耗时，交互式课件手工制作成本高", "② 出卷、成绩分析靠人工，重复且慢", "③ 班级管理与家校沟通事务繁杂"], "goal": ["① 备课时间大幅压缩，课件效率数量级提升", "② 教学资源包（教案+逐字稿+课件+题库）自动生成", "③ 成绩自动分析、学情报告自动出"], "sol": ["WorkBuddy智能平台+OpenMAIC开源项目", "智能备课：自然语言10分钟生成交互式课件", "3D交互教学：批量开发可拖拽/旋转/演示的教学网页", "智能出卷+成绩分析+班级管理自动化", "配套教师培训+陪跑"], "resBody": [], "stats": [["46项", "教学任务落地"], ["10类", "全覆盖"], ["↓80%+", "备课时间"], ["↑10倍", "课件效率"]]}, {"ind": "教育", "title": "江西工程学院 · 用 WorkBuddy 把学生 Bug 修复效率提 30%", "tags": ["1000+ 人", "研发"], "bg": "高等教育院校，软件工程教学是新工科重点。学生编程实践中的Bug靠老师逐个看，项目交付进度难把控。", "prob": ["① 学生实验Bug修复效率低，老师逐个答疑成本高", "② 项目交付按时率低，进度难管理"], "goal": ["① Bug修复效率显著提升", "② 项目按时交付率提高"], "sol": ["WorkBuddy引入课堂，辅助学生编程实践", "Bug修复Agent+项目交付辅助", "配套师资培训+陪跑"], "resBody": [], "stats": [["↑30%", "Bug修复效率"], ["↑25%", "项目按时交付率"]]}, {"ind": "教育", "title": "斯恩升学 · 用 ima+WorkBuddy 把方案制作从 6 小时压到分钟级", "tags": ["50–200 人", "销售 · 内容·创意"], "bg": "广东惠州的升学培训机构，老板兼策划、5个项目线同时跑。翻资料做方案动辄几小时，PPT和短视频脚本全靠人工拼——小团队被内容生产拖住，招生动作反而没精力做。", "prob": ["① 定制升学方案翻资料6小时起步，交付慢", "② 培训PPT、短视频脚本靠人工组装，产能低", "③ 多项目线并行，老板被内容生产绑死"], "goal": ["① 方案制作从小时级变分钟级", "② 多项目线内容生产自动化"], "sol": ["WorkBuddy+ima知识库（ima做知识大脑+WorkBuddy做执行之手）", "定制方案输出Agent：一句话出方案", "培训PPT生成+短视频脚本生成", "配套招生/内容团队培训+陪跑"], "resBody": [], "stats": [["6h→分钟级", "方案制作"], ["5条", "项目线并行"]]}, {"ind": "教育", "title": "联想开天 × 腾讯 WorkBuddy · 国产信创 AI PC 跑通中小学教务", "tags": ["教育 · IT"], "bg": "联想开天（信创AI PC）与腾讯WorkBuddy推出无界兼容方案。中小学教务中成绩整理、学情分析、家长通知书生成等大量机械操作占去教师精力，且学校对数据不出校网、信创合规有强要求。", "prob": ["① 成绩台账散落本地国产终端，学情分析靠人工统计，慢且易错", "② 家长通知书需批量、标准化又个性化，手工撰写负担重", "③ 学校数据须在内网隔离环境运行，通用云方案不合规"], "goal": ["① 在信创AI PC上本地跑通教务分析，数据不出校网", "② 把教师从机械操作中释放，提升教务标准化与智能化"], "sol": ["AI PC直接读取本地国产终端成绩台账→大模型自动完成班级/年级学情分析→批量生成标准化、个性化家长通知书", "天禧AI Pro管控运行权限，数据不出校网，形成信创合规闭环（等保/内网隔离）"], "resBody": ["信创合规", "闭环落地", "替代人工", "机械操作", "数据不出", "校网"], "stats": []}, {"ind": "零售快消", "title": "伊利集团 · 用 ADP 让 4 万一线人员用上对话级 Agent", "tags": ["1000+ 人", "销售 · 内容·创意 · 数据分析"], "bg": "中国规模最大的乳制品企业，渠道与终端SKU海量、营销触点极多。4万一线人员每天要面对质检报告、供应链数据、营销素材的信息洪流——导购话术靠经验、达人营销靠人力堆、质检靠肉眼。", "prob": ["① 导购面对海量产品信息，个性化话术靠背，转化不稳定", "② 达人营销从筛选到执行全靠人力，效率瓶颈明显", "③ 包材质检依赖人工，漏检与一致性是老大难"], "goal": ["① 4万一线人员用上对话级Agent，话术/素材随手可取", "② 达人营销效率量级提升", "③ 质检接近零漏检"], "sol": ["腾讯云ADP+微信生态+导购智能体+达人营销智能体", "导购智能体：打通质检报告、供应链、营销素材全链路，辅助个性化话术", "达人营销智能体：AI驱动达人筛选与内容生产，效率提升200倍", "AI质检：替代传统人工检测，包材合格率接近100%", "配套营销/运营培训+陪跑"], "resBody": [], "stats": [["4万人", "对话级Agent"], ["2000+", "任务级Agent"], ["↑26%", "导购订单"], ["↑39%", "下单转化率"]]}, {"ind": "零售快消", "title": "茶颜悦色 · 用 AI 面试与小诸葛把门店从凭感觉变靠数据", "tags": ["1000+ 人", "人力 · 运营·供应链"], "bg": "湖南头部茶饮品牌，门店快速扩张，HR与门店运营同时被人卡住——招聘高峰期面试官不够用、评判参差；几千家门店的经营数据躺在系统里，店长凭经验拍板。", "prob": ["① 招聘旺季面试官稀缺，流程长、评判标准不一", "② 门店经营数据分散，店长凭感觉决策，问题发现滞后", "③ 标杆门店的好经验，靠开会口口相传，复制慢"], "goal": ["① 招聘流程从天压到分钟，且标准统一", "② 门店从经验驱动变数据驱动，问题主动暴露", "③ 优秀运营经验自动沉淀、一键复制到全门店"], "sol": ["WorkBuddy+自研AI系统", "AI面试系统：标准化题库+自动评分+全流程留痕，2天→30分钟", "茶颜小诸葛AI店长助手：打通全维度经营数据，自动分层诊断、横向对标、问题排查、主动推送优化方案", "配套HR/店长培训+陪跑"], "resBody": ["消除偏差", "人为评判", "全门店", "经验复制"], "stats": [["2天→30分钟", "招聘流程"]]}, {"ind": "零售快消", "title": "鸣鸣很忙 · 用 AI 巡检把万店巡店从人力黑洞里捞出来", "tags": ["1000+ 人", "运营·供应链"], "bg": "国内首个破20000家店的休食零售品牌，门店密度极高。传统人工巡店在万店规模下彻底失灵——人货场全靠督导跑，覆盖不到、标准走样、问题发现晚。", "prob": ["① 2万+门店靠人工巡店，督导跑断腿也覆盖不全", "② 门店设备、卫生、陈列等问题发现滞后，标准难统一", "③ 巡店人力成本随门店数线性上涨"], "goal": ["① 巡店自动化，覆盖人货场全场景", "② 单次巡店效率与人力成本双优"], "sol": ["腾讯智慧零售+AI巡检系统", "AI门店巡检Agent：覆盖设备、卫生、陈列全场景", "自动巡店：替代人工，持续提升效率、节约人力", "配套运营培训+陪跑"], "resBody": [], "stats": [["↑20.49%", "单次巡店效率"], ["8分钟", "每次节省"], ["25.9人次", "月度节省人力"]]}, {"ind": "游戏文娱", "title": "创梦天地 · 用 CodeBuddy 让 70%+ 工程师用上 AI 辅助编码", "tags": ["1000+ 人", "研发"], "bg": "高品质游戏研发商，Unity/UE双引擎开发，测试与编码压力大。工程师被重复编码和白盒测试拖慢。", "prob": ["① 游戏编码重复劳动多，提效难", "② 白盒测试靠人工全面体检，效率低"], "goal": ["① 70%+工程师用上AI辅助编码", "② 开发效率与AI辅助生成率双提升"], "sol": ["腾讯云CodeBuddy（SaaS）", "Unity/UE游戏开发辅助Agent", "白盒测试AI辅助全面体检，提升测试效率", "配套研发培训+陪跑"], "resBody": [], "stats": [["70%+", "工程师使用"], ["↑12%+", "开发效率"], ["30%", "AI辅助生成率"]]}, {"ind": "游戏文娱", "title": "游族网络 · 用全员 Agent 工作流打通模型壁垒、放大各岗位产能", "tags": ["1000+ 人", "研发 · 内容·创意"], "bg": "A股上市游戏公司，研发、发行、美术、策划、运营多岗位并行。模型壁垒、算力分配、跨岗位协作是规模化AI的拦路虎。", "prob": ["① 各岗位被不同模型工具割裂，算力与协作不通", "② 研发、发行产能难以倍数级放大"], "goal": ["① 全员用上Agent工作流，打通模型壁垒", "② 各岗位产能倍数级放大"], "sol": ["WorkBuddy+CodeBuddy+TokenHub", "全员AI Agent工作流：打通模型壁垒，研发、发行各岗位产能倍数级放大", "YOOZOO.AI平台：接入40+大模型，覆盖业务全场景", "无限量AI算力：向全员开放免费工具与Token", "配套全岗位培训+陪跑"], "resBody": ["全员", "Agent使用", "无上限", "Token"], "stats": [["40+", "大模型接入"]]}, {"ind": "游戏文娱", "title": "淘米网络 · 用 CodeBuddy 接手重复活、美术 IP 衍生效率涨近 80%", "tags": ["200–1000 人", "研发 · 内容·创意"], "bg": "运营《摩尔庄园》《赛尔号》近20年的游戏企业，研发、策划、美术、市场全链条。重复编码吞掉研发精力，美术IP衍生内容生产慢。", "prob": ["① UI适配、接口联调、配置表解析、数据埋点等重复活占满研发", "② 策划、美术、市场等非技术环节AI赋能不足", "③ 美术素材与IP衍生内容生产效率低"], "goal": ["① CodeBuddy接手重复编码活", "② WorkBuddy深入非技术环节提效", "③ 美术素材生产效率大幅提升"], "sol": ["WorkBuddy+CodeBuddy", "CodeBuddy接手：UI适配、接口联调、配置表解析、数据埋点", "WorkBuddy赋能：策划、美术、市场环节AI赋能", "美术素材与IP衍生内容生产Agent", "配套研发/美术培训+陪跑"], "resBody": ["↑近80%", "美术IP衍生效率"], "stats": []}, {"ind": "金融财税", "title": "中国银行 · 用智能体把 4000+ AI 模型规模化落到全行业务", "tags": ["1000+ 人", "研发 · 数据分析"], "bg": "四大国有商业银行之一，业务线极广、数据量极大。AI模型要在全行各业务线规模化落地，但数据处理长期靠人工，成本高、响应慢。", "prob": ["① AI模型难以规模化、标准化地在各业务线部署", "② 数据处理依赖人工，成本高、时效性差"], "goal": ["① 数千个AI模型稳定落地全行业务", "② 数据处理自动化，成本大幅下降"], "sol": ["腾讯云智能体能力", "AI模型规模化落地平台：4000+模型在行内部署", "数据处理自动化管线：大幅降低人工数据处理成本", "配套科技条线培训+陪跑"], "resBody": [], "stats": [["4000+", "AI模型落地"], ["↓60%", "数据处理成本"]]}, {"ind": "金融财税", "title": "招商银行 · 用 CodeBuddy 私有化沉淀 AISE 建设能力", "tags": ["1000+ 人", "研发"], "bg": "首家完全由企业法人持股的股份制商业银行，科技开发团队庞大。想用好CodeBuddy，但私有化部署、插件融入行内场景、模型持续训练——缺一不可。", "prob": ["① CodeBuddy私有化部署后要真正融入行内研发流程", "② 行内数据与场景要能和模型/插件打通", "③ 模型需要持续训练与运营迭代"], "goal": ["① 沉淀AISE建设能力（模型选好+插件用好+运营迭代好）", "② 插件深度融合招行内部场景"], "sol": ["腾讯云CodeBuddy（私有化部署）", "AISE三层建设：模型选型+插件融合+运营迭代", "行内数据扩展联创项目：融合行内场景", "配套科技开发培训+陪跑"], "resBody": ["AISE", "建设能力沉淀", "持续训练", "模型优化", "融合", "插件入场景"], "stats": []}, {"ind": "金融财税", "title": "慧算账 · 用 ClawPro 让一个会计带 N 个数字员工", "tags": ["200–1000 人", "财务"], "bg": "代理记账行业头部品牌，财税交付高度标准化又高度非标——最难的标准化场景靠人堆，一个会计带多个客户，交付质量与效率难兼得。", "prob": ["① 30%最难标准化的财税业务场景靠人工硬扛", "② 人做判断、AI缺位，会计被重复执行拖住", "③ 企业微信工作流未与AI打通"], "goal": ["① AI Agent承接最难标准化场景", "② 人做判断，AI做执行，一个会计带N个数字员工"], "sol": ["腾讯云ClawPro+企业微信工作流", "AI Agent重写财税交付逻辑：承接30%最难标准化场景", "人做判断，AI做执行：一个会计带N个数字员工", "企业微信深度集成：ClawPro接入企微工作流", "配套财税交付培训+陪跑"], "resBody": [], "stats": [["30%", "最难场景承接"], ["100%", "Agent含量"]]}, {"ind": "金融财税", "title": "中港星 / 司盟企服 · 用 WorkBuddy 给 21 年专业服务提提速", "tags": ["200–1000 人", "销售 · 运营·供应链"], "bg": "21年专业服务沉淀的企业服务集团，服务跨境电商全球拓展。专业服务交付靠经验，提效与全球化拓展双重压力。", "prob": ["① 企服业务靠经验驱动，提质增效难", "② 跨境电商服务全球化，交付跟不上", "③ 专业服务加速难，更快更省做不到"], "goal": ["① AI驱动企服业务提质增效", "② 服务跨境电商企业全球拓展"], "sol": ["WorkBuddy AI技能+21年专业服务沉淀", "企服业务AI驱动Agent", "跨境电商服务Agent：服务全球拓展", "配套企服团队培训+陪跑"], "resBody": ["全球", "跨境电商服务"], "stats": [["21年", "专业沉淀"]]}, {"ind": "贸易物流", "title": "找钢网 · 用 ADP 把沟通即交易从头跑通钢铁 B2B", "tags": ["1000+ 人", "销售 · 运营·供应链 · 财务"], "bg": "国内最大第三方钢铁交易平台，2025年交易额1515亿元。询价采购、仓储物流、财务结算横跨交易全链路，沟通即交易——但传统人工询报价与库存匹配效率见顶。", "prob": ["① 询价采购靠人工对话与报价，效率低、易错", "② 仓储物流库存预警与订单匹配靠经验", "③ 垂直Skill难以对外输出复用"], "goal": ["① 询价到订单全流程自动化，沟通即交易", "② 智能库存预警与订单自动匹配", "③ 垂直Skill接入云生态复用"], "sol": ["腾讯云ADP 4.0+自研找钢Claw", "询价采购Agent：自动对话+询报价，延伸至订单全流程自动化", "仓储物流Agent：智能库存预警+订单自动匹配", "行业Skill输出：垂直Skill/MCP接入腾讯云ADP资源中心", "配套交易/运营培训+陪跑"], "resBody": [], "stats": [["1515亿", "2025交易额"], ["4559万吨", "交易吨量"], ["3.35亿", "AI业务收入"]]}, {"ind": "贸易物流", "title": "某 200 人外贸企业 · 用开发信流水线+IP内容矩阵把获客全链路跑通", "tags": ["200–300 人", "营销获客 · 内容创作 · 销售"], "bg": "某200人外贸企业，主营跨境B2B出口，市场覆盖多个国家和地区。获客长期靠业务人肉跑——写开发信、跟客户、做多语言沟通；内容团队还要持续产出社媒内容养线索。", "prob": ["① 开发信慢且怕错：单封英文开发信磨20分钟，西/阿语还要找翻译", "② 跟进乱易漏：客户名单多、节奏靠记忆，常漏跟进", "③ 获客手段单一：依赖业务人肉开发，想做内容获客无从下手"], "goal": ["① 把开发信→跟进→逼单做成标准化流水线，业务从写邮件里解放", "② 用IP内容矩阵做线索供给，社媒稳定产出、持续引流", "③ 多语言与高频任务自动化，全球市场洞察随取随用"], "sol": ["WorkBuddy搭建外贸获客双引擎，把开发信流水线与IP内容矩阵串成企业获客全链路", "开发信+跟进Agent：批量生成多语言开发信、按客户分层自动排7天跟进节奏", "IP内容获客Agent：沉淀企业与个人知识库，自动生成朋友圈、公众号、视频号脚本", "配套22个分国别专家智能体做市场洞察+业务/内容团队培训陪跑"], "resBody": ["数周→几分钟", "市场调研"], "stats": [["2h→30min", "每日邮件"], ["20min→分钟级", "单封开发信"], ["30条+", "单视频获客"]]}, {"ind": "贸易物流", "title": "某港口集团 · 用 WorkBuddy 把集团财务、票据与经营分析全链路跑通", "tags": ["10000+ 人", "财务 · 票据 · 经营报表"], "bg": "港口重流程、重合规，集团既想要AI生产力，又怕敏感经营数据出企业门。下属上百家企业的财务与经营数据散落各报表系统，传统靠人逐一核对、跨系统扒数。", "prob": ["① 上百家下属企业经营数据散落报表，财务逐一核对异常科目熬好几天", "② 月度经营分析跨系统扒数、对齐口径、成文数天", "③ 大量合同扫描、报销、发票验真伪等消耗人力工作"], "goal": ["① 集团财务与经营分析全链路提速", "② 费用报销、预算、信用、应收实现自动化与事前管控", "③ 提升财务与经营分析人效"], "sol": ["财务与经营分析侧：WorkBuddy秒级扫全库、定位亏损企业、归因异常科目、生成排查清单；月度经营分析报告10分钟一键生成；合同风险条款逐条标红", "票据与费用共享侧：企业微信内上传发票→AI做OCR验真、价税分离→一键生成报销单→事件会计自动生成凭证；集团预算事前管控；统一信用管控；到期应收前7天自动提醒"], "resBody": ["数天→10分钟", "经营分析"], "stats": [["3天→秒级", "亏损排查"], ["↑3倍+", "合同审核效率"], ["↑80%+", "费用月核对效率"]]}, {"ind": "物业地产", "title": "某物业集团 · 上千项目管家被填表困住、服务响应效率低", "tags": ["1000+ 人", "客服 · 服务 · 审批"], "bg": "国内领先综合物业服务集团，全国超千个项目，前台管家与收费运营是每天的高频战场。管家报修要填一堆表、收费提醒靠人工催——一线被事务性工作淹没，业主体验却上不去。", "prob": ["① 前台管家报修流程繁琐，填表多、响应慢", "② 物业费账单提醒靠人工，催收效率低、体验差", "③ 多年业务流程与标准散落，新人上手难"], "goal": ["① 报修从填表变聊几句，秒级响应", "② 收费提醒自动化", "③ 业务标准封装为自然语言调用，一线即拿即用"], "sol": ["WorkBuddy+专属skill技能包", "极速工单：前台管家自然语言完成报修响应", "收费提醒Agent：自动发送物业费账单提醒", "一线赋能：业务流程与管理标准封装为自然语言调用能力", "配套物业运营培训+陪跑"], "resBody": ["↓约30%", "人力成本"], "stats": [["120秒→3秒", "工单处理"], ["↑80%+", "效率"]]}, {"ind": "物业地产", "title": "万科-万物云 · 用 CodeBuddy 公有云版把周编码时间砍半", "tags": ["1000+ 人", "研发"], "bg": "万科旗下物业科技品牌，研发团队要快速用上AI编程，但公有云开箱即用与深度评测、宣贯激励要配套——否则工具推不下去。", "prob": ["① AI编程工具要快速推广，降低上手门槛", "② 需要深度评测输出Goodcase/Badcase", "③ 推广要靠宣贯与激励驱动使用"], "goal": ["① 授权覆盖研发、日活高占比", "② AI代码生成占比与采纳率提升"], "sol": ["腾讯云CodeBuddy（SaaS公有云版）", "AI编程辅助：开箱即用，10分钟体感快速推广", "深度评测：旗舰版2周深度使用，输出Goodcase/Badcase", "宣贯与激励：参考腾讯内部实践开展", "配套研发培训+陪跑"], "resBody": [], "stats": [["300+", "授权"], ["80%", "日活占比"], ["↓50%", "周编码时间"]]}, {"ind": "其他", "title": "某医药零售集团 · 用 WorkBuddy+CodeBuddy 把研发与数据链路提效约 50%", "tags": ["1000+ 人", "研发·IT · 数据分析"], "bg": "港股上市的医药零售与在线医疗企业，产品、研发、测试、运维、BI多条线并行。需求文档靠人写、测试靠人堆、BI靠人拉——研发与数据链路长，C端服务还要承接语音/图像找药的多模态交互。", "prob": ["① PRD撰写耗时长，需求调研周期拉满", "② 测试用例与BI分析靠人工，效率天花板明显", "③ C端找药场景多模态，传统交互承接不住"], "goal": ["① 研发与数据全链路提效", "② 沉淀自己的知识库，提升AI代码采纳率", "③ 提升C端智能服务的响应速度"], "sol": ["WorkBuddy+CodeBuddy+混元大模型", "需求提炼与PRD生成Agent：PRD撰写从3人日压到1.5人日内", "测试用例自动生成+BI数据深度分析：测试与BI效能各提升约50%", "C端智能服务：混元驱动多模态交互（语音/图像/图片找药）", "配套研发/数据培训+陪跑"], "resBody": [], "stats": [["~50%", "整体提效"], ["80%+", "AI代码采纳率"], ["90%+", "员工覆盖率"], ["100%", "知识沉淀"]]}, {"ind": "其他", "title": "某全国性人力资源服务集团 · 用 HR 超级工作站把招聘全链路与人事合规一次跑通", "tags": ["人力外包", "1000+ 人", "招聘 · 审批 · HR"], "bg": "某全国性人力资源服务集团，5000+人、30+城市分支，每天为各行各业的企业交付招聘与用工服务。自身也是多层级大型组织——年招聘交付数以万计，顾问陷在写JD、筛简历、核用章的重复劳动里。", "prob": ["① 招聘链路长、强重复：单岗6~7个手工环节，顾问约80%时间耗在执行", "② 渠道初筛靠人力：BOSS等平台逐一打招呼、读简历，回复率随模板化走低", "③ 多层级工商/用章合规繁琐：逐家逐层人工核对费时易错"], "goal": ["① 招聘全链路+人事合规拆成标准化流水线，顾问从跑流程转做决策", "② 招聘执行约80%由AI代劳，单顾问可服务岗位与客单量显著提升", "③ 合规核对转接口直连+抽查，数据不出本地"], "sol": ["WorkBuddy串联主流招聘平台与工商数据接口，搭建集团级HR超级工作站", "招聘全链路Agent：覆盖JD与岗位画像生成、简历解析入库、人岗智能匹配、平台自动触达与初筛、面试评分卡、入职材料生成", "人事合规核对Agent：对话式核对企业工商信息与用章主体，直读本地台账，抽查代替全查", "配套HR/招聘团队培训+陪跑"], "resBody": ["约3倍", "渠道回复率", "约80%", "AI代劳执行"], "stats": [["3周→1周", "招聘总耗时"], ["6h→30min", "合规核对"]]}, {"ind": "其他", "title": "华住集团 · 用 ADP 华小 AI 自动处理 70%+ 高频住客问询", "tags": ["酒店", "1000+ 人", "客服 · 运营·供应链"], "bg": "中国最大酒店集团之一，10000+门店，住中服务是高频战场。70%以上的高频住客问询靠人工应答，响应慢、标准不一。", "prob": ["① 高频住客问询量大，人工应答响应慢", "② 多意图交互难无缝回溯", "③ 住客需求响应时长难压到秒级"], "goal": ["① 自动处理70%+高频问询", "② 响应时长压到5秒内，准确率95%+"], "sol": ["腾讯云ADP+自研华小AI", "AI住中服务：自动处理高频住客问询", "多意图识别：支持无缝回溯交互", "住客需求响应Agent：响应缩短至5秒内", "配套门店服务培训+陪跑"], "resBody": [], "stats": [["10000+", "门店覆盖"], ["180万+", "累计任务"], ["95%+", "准确率"], ["5秒内", "响应"]]}, {"ind": "其他", "title": "中兴通讯 · 用原生 WorkBuddy AI 云电脑内置 100+ 领域专家", "tags": ["1000+ 人", "文书 · 研发 · 运营·供应链"], "bg": "通讯设备/云终端厂商，云终端市场连续两年第一、市占率近50%。面向学生、职场人士、OPC、小微团队的AI云电脑，要内置100+领域专家与全场景智能体。", "prob": ["① AI云电脑要开机即用、原生搭载智能体", "② 多端远程操控（微信/企微/QQ/飞书/钉钉）要打通", "③ 缺乏100+领域专家开箱即用"], "goal": ["① 原生WorkBuddy AI云电脑，开机即用", "② 全场景智能体+多端远程操控", "③ 100+领域智能专家内置"], "sol": ["原生WorkBuddy AI云电脑（深度战略合作）", "全场景智能体：Excel自动化/PDF处理/PPT生成/OCR/浏览器自动化/定时任务", "多端远程操控：微信/企微/QQ/飞书/钉钉，手机发指令电脑执行", "100+领域智能专家：财务/法务/营销/数据分析等", "配套交付与培训+陪跑"], "resBody": [], "stats": [["200万+", "云电脑销量"], ["1000+", "政企客户"], ["7×24", "在线"]]}];
function renderCases(ind){
  const grid=document.getElementById('caseGrid');
  if(!grid)return;
  grid.querySelectorAll('.case-card').forEach(card=>{
    card.hidden=ind!=='全部'&&card.dataset.industry!==ind;
  });
}
function setCaseIndustry(name){
  const tabs=document.getElementById('indTabs');
  if(!tabs)return;
  const btn=[...tabs.querySelectorAll('button')].find(b=>b.dataset.industry===name);
  if(btn&&!btn.classList.contains('act'))btn.click();
}
(function initCases(){
  const tabs=document.getElementById('indTabs');
  if(!tabs)return;
  const buttons=[...tabs.querySelectorAll('button[data-industry]')];
  buttons.forEach(b=>b.addEventListener('click',()=>{
    buttons.forEach(x=>x.classList.remove('act'));
    b.classList.add('act');
    renderCases(b.dataset.industry);
  }));
  const active=tabs.querySelector('button.act')||buttons[0];
  if(active)renderCases(active.dataset.industry);
})();
function openCase(i){
  const c=CASE_DB[i];
  const m=document.getElementById('cmodal');
  const li=a=>a.map(x=>`<li>${x}</li>`).join('');
  m.querySelector('.panel').innerHTML=`
    <div class="cm-head">
      <span class="ind">${c.ind}</span><span class="tags">${(c.tags||[]).join(' · ')}</span>
      <h3>${c.title}</h3>
      <button class="close" onclick="closeCase()" aria-label="关闭">✕</button>
    </div>
    <div class="cm-body">
    ${c.bg?`<h5>项目背景</h5><p>${c.bg}</p>`:''}
    ${c.prob&&c.prob.length?`<h5>遇到的问题</h5><ul>${li(c.prob)}</ul>`:''}
    ${c.goal&&c.goal.length?`<h5>希望实现的目标</h5><ul>${li(c.goal)}</ul>`:''}
    ${c.sol&&c.sol.length?`<h5>解决方案</h5><ul>${li(c.sol)}</ul>`:''}
    ${(c.stats.length||c.resBody.length)?`<h5>带来的结果</h5>${c.resBody.map(x=>`<p>${x}</p>`).join('')}
      ${c.stats.length?`<div class="stat-grid">${c.stats.map(x=>`<div class="stat"><b>${x[0]}</b><i>${x[1]}</i></div>`).join('')}</div>`:''}`:''}
    <div class="cm-cta">
      <div class="t">想在你的企业复制这个场景？<span>先做一次轻量的 AI 场景诊断，顾问 1 个工作日内联系你。</span></div>
      <a class="btn" style="background:var(--purple-hi);color:#fff" href="/contact" onclick="closeCase()">预约「AI 场景诊断」<span class="arr">→</span></a>
      <button class="btn" style="border-color:var(--hair);color:var(--ink)" onclick="closeCase();openDrawer()">问 AI 顾问</button>
    </div>
    </div>
  `;
  m.classList.add('on');
  document.body.style.overflow='hidden';
}
function closeCase(){
  document.getElementById('cmodal').classList.remove('on');
  document.body.style.overflow='';
}

/* ================= 研究中心：文章库（从后端 API 动态加载） ================= */
/* state: full=全文入站 ｜ guide=章节导读 ｜ soon=已排期未发布
   数据来源：GET /api/articles?zone=industry，后台 CMS 发布/修改后前台自动同步。 */
var ART_DB=[];
var ART_LOADED=false;
var ART_LOAD_PROMISE=null;
function _fmtDate(d){
  if(!d)return '';
  const dt=new Date(d);
  if(isNaN(dt))return String(d).slice(0,10);
  return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
}
function _mapArticle(a){
  const stateMap={full:'full',toc:'guide',soon:'soon'};
  const authorName=(a.author&&a.author.name)||'瑞华智策';
  return {
    _id:a._id,
    cat:a.category||'行业洞察',
    zone:a.zone||'industry',
    state:stateMap[a.contentStatus]||'full',
    title:a.title||'',
    pub:_fmtDate(a.publishDate),
    upd:_fmtDate(a.updatedAt||a.publishDate),
    author:authorName,
    views:String(a.views||0),
    abstract:a.summary||'',
    body:a.content||'',
    aimg:(a.author&&a.author.avatar)||'',
    aname:authorName,
    atitle:(a.author&&a.author.desc)||'',
    abio:(a.author&&a.author.detail)||(a.author&&a.author.desc)||'',
    src:a.sourceUrl||'',
    slug:a.slug||''
  };
}
function loadArticles(zone){
  if(ART_LOADED)return Promise.resolve(ART_DB);
  if(ART_LOAD_PROMISE)return ART_LOAD_PROMISE;
  const z=zone||'industry';
  ART_LOAD_PROMISE=fetch('/api/articles?zone='+encodeURIComponent(z))
    .then(r=>r.ok?r.json():Promise.reject('HTTP '+r.status))
    .then(data=>{
      const arr=Array.isArray(data)?data:(data&&Array.isArray(data.data)?data.data:[]);
      const seen=new Set();
      ART_DB=arr.map(_mapArticle).filter(a=>{
        const key=a.slug||a._id;
        if(seen.has(key))return false;
        seen.add(key);return true;
      });
      ART_LOADED=true;
      SITE_IX=null;
      return ART_DB;
    })
    .catch(err=>{
      console.warn('[insights] 加载文章失败:',err);
      ART_DB=[];
      ART_LOADED=true;
      return ART_DB;
    });
  return ART_LOAD_PROMISE;
}
var TT_DB=[
 {cat:'方法论',state:'soon',title:'R=B×O：为什么大多数企业的 AI 转型「有工具无结果」',desc:'企业买了 AI 工具却看不到业务结果，根源在于只建了「底座」（B），却没有建设「运营」（O）。本文拆解 R=B×O 框架的诊断逻辑与改善路径。',date:'2026-05-20'},
 {cat:'组织设计',state:'soon',title:'碳硅共智：AI 时代的组织结构重构指南',desc:'当 Agent 成为「硅基员工」，组织架构、岗位设计、绩效体系都需要重构。本文提供碳硅分工矩阵与人机协作流程设计模板。',date:'2026-04-28'},
 {cat:'人效经营',state:'soon',title:'从人均产出到碳硅协同产出：人效指标的 AI 时代升级',desc:'传统人效指标无法衡量 AI 介入后的真实生产力。本文提出「碳硅协同产出」指标体系，附带可落地的人效仪表盘设计方案。',date:'2026-04-15'}
];
const ST_LABEL={full:['st-full','全文入站'],guide:['st-guide','章节导读'],soon:['st-soon','即将发布']};
function stTag(s){const x=ST_LABEL[s]||ST_LABEL.soon;return `<span class="st-tag ${x[0]}">${x[1]}</span>`}
const INS_TABS=['全部','CIO 数智化转型智库','CEO 经营增长智库','CHO 人效提升智库'];
function renderIns(cat){
  const box=document.getElementById('insList');
  if(!box)return;
  if(!ART_LOADED){box.innerHTML='<p style="font-size:13px;color:var(--ink-3)">加载中…</p>';return}
  const list=ART_DB.filter(a=>cat==='全部'||a.cat===cat);
  box.innerHTML=list.length?list.map(a=>`
    <a class="art" href="/insights/${a.slug?encodeURIComponent(a.slug):a._id}">
      <div class="art-head"><span class="tk">${a.cat}</span>${stTag(a.state)}<span class="go2">${a.state==='full'?'阅读全文':'查看导读'} →</span></div>
      <span class="t">${a.title}</span>
      <span class="d">${a.abstract}</span>
      <span class="m">${a.pub} · ${a.author} · 阅读 ${a.views}</span>
    </a>`).join(''):'<p style="font-size:13px;color:var(--ink-3)">该智库暂无已发布文章。</p>';
  if(typeof animPrep==='function')animPrep(box);
}
function renderTT(){
  const box=document.getElementById('ttList');
  if(!box)return;
  /* SSR 已预渲染即将发布列表：跳过重渲染，仅做入场动画准备（GEO 友好） */
  if(!box.querySelector('.art')){
    box.innerHTML=TT_DB.map(a=>`
    <div class="art">
      <div class="art-head"><span class="tk">${a.cat}</span>${stTag(a.state)}</div>
      <span class="t">${a.title}</span>
      <span class="d">${a.desc}</span>
      <span class="m">预计 ${a.date}</span>
    </div>`).join('');
  }
  if(typeof animPrep==='function')animPrep(box);
}
(function initIns(){
  const tabs=document.getElementById('insTabs');
  if(!tabs)return;
  tabs.innerHTML='';
  INS_TABS.forEach((c,i)=>{
    const b=document.createElement('button');
    b.textContent=c; if(i===0)b.classList.add('act');
    b.onclick=()=>{tabs.querySelectorAll('button').forEach(x=>x.classList.remove('act'));b.classList.add('act');renderIns(c)};
    tabs.appendChild(b);
  });
  renderTT();
  loadArticles('industry').then(()=>renderIns('全部'));
})();
function subscribe(){
  const v=document.getElementById('subInput').value.trim();
  if(!v){document.getElementById('subInput').focus();return}
  document.getElementById('subForm').innerHTML='<span class="ok">✓ 已订阅，文章上线当天推送给你</span><span style="font-size:11px;color:var(--d-weak);align-self:center">演示态：未真实提交</span>';
}

/* ================= 文章详情：目录 / 进度 / 相关 ================= */
var tocLinks=[], tocHeads=[];
function updateProgress(){
  const bar=document.getElementById('aProg');
  const b=document.querySelector('.page[data-page="article"].on .a-body');
  if(!b){if(bar)bar.style.width='0';return}
  const r=b.getBoundingClientRect();
  const total=Math.max(r.height-innerHeight+240,1);
  const done=Math.min(Math.max(-r.top+120,0),total);
  bar.style.width=(done/total*100).toFixed(1)+'%';
  /* 目录滚动高亮 */
  if(!tocHeads.length)return;
  let cur=0;
  tocHeads.forEach((h,i)=>{if(h.getBoundingClientRect().top<140)cur=i});
  tocLinks.forEach((l,i)=>l.classList.toggle('on',i===cur));
}
function updateCaseProgress(){
  const index=document.querySelector('.page[data-page="case-detail"].on .case-report-index');
  if(!index)return;
  const links=[...index.querySelectorAll('.case-report-index a[href^="#"]')];
  const sections=links.map(link=>document.querySelector(link.getAttribute('href'))).filter(Boolean);
  if(!sections.length)return;
  let current=0;
  sections.forEach((section,i)=>{if(section.getBoundingClientRect().top<=160)current=i});
  links.forEach((link,i)=>{
    const active=i===current;
    link.classList.toggle('on',active);
    if(active)link.setAttribute('aria-current','location');
    else link.removeAttribute('aria-current');
  });
  const content=document.querySelector('.case-report-content');
  if(content){
    const rect=content.getBoundingClientRect();
    const total=Math.max(rect.height-innerHeight+160,1);
    const done=Math.min(Math.max(160-rect.top,0),total);
    index.style.setProperty('--case-progress',Math.round(done/total*100)+'%');
  }
}
requestAnimationFrame(updateCaseProgress);
function relatedHTML(idx){
  const others=ART_DB.filter(a=>a._id!==idx);
  return others.map(a=>`<a class="r" href="/insights/${a.slug?encodeURIComponent(a.slug):a._id}">${a.title}<em>${a.cat}</em></a>`).join('')
    +`<a class="r" href="/nqoc" target="_blank" rel="noopener">中国新质组织研究项目<em>迷你站 ↗</em></a>`
    +['AI时代，人力资本价值经营的十大主题（上篇）：文化、战略与组织','发展新质生产力背景下，人力资源服务业价值升级的底层逻辑','2026新质生产力下的企业AI化变革与组织重构战略指南']
      .map(t=>`<span class="r off">${t}<em>旧站内容 · 待迁移</em></span>`).join('');
}
function renderArticle(id){
  const artRoot=document.getElementById('artRoot');
  if(!artRoot)return;
  const renderFromData=(a)=>{
  if(!a){artRoot.innerHTML='<div style="padding:80px 24px;text-align:center;color:var(--ink-3)"><h3>文章未找到</h3><p>该文章可能已下线或不存在。</p><a class="btn" href="/insights/industry" style="display:inline-block;margin-top:16px">返回研究中心</a></div>';return}
  const idx=a._id;
  const isGuide=a.state==='guide';
  const bodyHTML = isGuide
    ? `<div class="a-note">本文为<b>章节导读版</b>，完整正文即将上线。${a.src?`要读当前版本，请<a href="${a.src}" target="_blank" rel="noopener">前往原文阅读 ↗</a>`:''}</div>
       ${a.body?`<div class="a-body-inner">${a.body}</div>`:`<p style="color:var(--ink-3)">完整正文正在整理中，敬请期待。</p>`}`
    : `<div class="a-body-inner">${a.body}</div>`;
  document.getElementById('artRoot').innerHTML=`
  <div class="a-hero"><div class="wrap">
    <div class="a-bc"><a href="/">首页</a> › <a href="/insights/industry">行业洞察</a> › <a href="/insights/industry">${a.cat}</a> › ${a.title}</div>
    <h1>${a.title}</h1>
    <div class="a-meta"><span>发布时间：<b>${a.pub}</b></span><span>作者：<b>${a.author}</b></span><span>阅读量：<b>${a.views}</b></span><span>更新时间：<b>${a.upd}</b></span>${stTag(a.state)}</div>
  </div></div>
  <div class="a-main">
    <div>
      <div class="a-abs"><div class="h">⚡ 核心摘要</div><p>${a.abstract}</p></div>
      <div class="a-body">${bodyHTML}</div>
      <div class="a-rel"><div class="h">相关文章</div>${relatedHTML(idx)}</div>
    </div>
    <div class="a-side">
      <div class="a-toc" id="aToc" style="display:none"><div class="h">本文目录</div><div id="tocBox"></div></div>
      <div class="a-author"><div class="h">作者</div>
        <div class="row">
          ${a.aimg?`<img src="${a.aimg}" alt="${a.aname}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="fb">${(a.aname||'?')[0]}</span>`:`<span class="fb" style="display:flex">${(a.aname||'?')[0]}</span>`}
          <div><div class="nm">${a.aname}</div><div class="ti">${a.atitle}</div></div>
        </div>
        <p>${a.abio}</p>
      </div>
      <div class="a-promo">
        <span class="chip chip-a">⚡ 限时免费评估</span>
        <div class="t">组织人效智能体检Agent</div>
        <p>通过科学的诊断模型，为您精准定位组织效能痛点，量化人力资本投资回报。</p>
        <a href="/contact">预约体验 →</a>
      </div>
    </div>
  </div>`;
  buildTOC();
  };
  const cached=ART_DB.find(a=>a._id===id);
  if(cached){renderFromData(cached);return}
  if(!id||id.length<12){artRoot.innerHTML='<div style="padding:80px 24px;text-align:center;color:var(--ink-3)"><h3>文章未找到</h3><a class="btn" href="/insights/industry" style="display:inline-block;margin-top:16px">返回研究中心</a></div>';return}
  artRoot.innerHTML='<div style="padding:80px 24px;text-align:center;color:var(--ink-3)">加载中…</div>';
  fetch('/api/articles/'+encodeURIComponent(id))
    .then(r=>r.ok?r.json():Promise.reject('HTTP '+r.status))
    .then(data=>{
      const mapped=_mapArticle(data);
      const existingIdx=ART_DB.findIndex(a=>a._id===mapped._id);
      if(existingIdx>=0)ART_DB[existingIdx]=mapped; else ART_DB.push(mapped);
      SITE_IX=null;
      renderFromData(mapped);
    })
    .catch(()=>{
      artRoot.innerHTML='<div style="padding:80px 24px;text-align:center;color:var(--ink-3)"><h3>文章加载失败</h3><a class="btn" href="/insights/industry" style="display:inline-block;margin-top:16px">返回研究中心</a></div>';
    });
}
function buildTOC(){
  const box=document.getElementById('tocBox');
  const wrap=document.getElementById('aToc');
  tocHeads=[...document.querySelectorAll('.page[data-page="article"] .a-body h3')];
  tocLinks=[];
  if(!box||tocHeads.length<2){if(wrap)wrap.style.display='none';return}
  wrap.style.display='';
  box.innerHTML='';
  tocHeads.forEach((h,i)=>{
    h.id='sec-'+i;
    const a=document.createElement('a');
    a.href='#sec-'+i;
    a.textContent=h.textContent;
    a.onclick=e=>{e.preventDefault();h.scrollIntoView({behavior:'smooth',block:'start'})};
    box.appendChild(a);
    tocLinks.push(a);
  });
  updateProgress();
}

/* ===== 表单校验工具：中国大陆手机号 ===== */
/* 容忍 +86 / 86 前缀与空格、短横线，核心为 1[3-9] 开头的 11 位 */
function normPhone(v){return String(v||'').replace(/[\s\-()（）]/g,'').replace(/^\+?86/,'')}
function isCNPhone(v){return /^1[3-9]\d{9}$/.test(normPhone(v))}
function fieldErr(el,msg){
  if(!el)return;
  clearErr(el);
  el.classList.add('fld-err');
  const tip=document.createElement('span');
  tip.className='err-tip'; tip.textContent=msg; tip.dataset.errFor=el.id;
  el.insertAdjacentElement('afterend',tip);
  el.focus();
  el.addEventListener('input',()=>clearErr(el),{once:true});
}
function clearErr(el){
  if(!el)return;
  el.classList.remove('fld-err');
  const nx=el.nextElementSibling;
  if(nx&&nx.classList&&nx.classList.contains('err-tip'))nx.remove();
}

/* ===== 访问轨迹 & 触发方式埋点（跨页面 sessionStorage 持久化） ===== */
function pageTitleOf(path){
  const m={'/':'首页','/solutions':'解决方案','/cases':'行业案例','/about':'关于我们','/contact':'预约诊断','/hcvm':'HCVM 模型','/insights':'行业洞察'};
  if(m[path])return m[path];
  if(path.startsWith('/solutions/'))return '解决方案';
  if(path.startsWith('/cases/'))return '行业案例';
  if(path.startsWith('/article'))return '研究中心';
  if(path.startsWith('/insights/'))return '研究中心';
  return path;
}
function isHit(path){ return /^\/article(\/|\.|$)/.test(path); }
function fmtDuration(ms){if(ms<1000)return'0秒';const s=Math.round(ms/1000);return s<60?s+'秒':Math.floor(s/60)+'分'+(s%60)+'秒';}
function detectDevice(){const ua=navigator.userAgent;if(/iPad|Tablet|Android(?!.*Mobile)/i.test(ua))return'平板';if(/Mobile|iPhone|Android/i.test(ua))return'手机';return'桌面';}
function loadTrail(){
  const path=location.pathname,key='rh_trail',tsKey='rh_trail_ts';
  let trail=[];try{trail=JSON.parse(sessionStorage.getItem(key))||[]}catch(e){}
  const now=Date.now();
  if(trail.length){const lastTs=Number(sessionStorage.getItem(tsKey))||now;trail[trail.length-1].d=fmtDuration(now-lastTs);}
  const last=trail[trail.length-1];
  if(!last||last.h!==path){trail.push({h:path,t:pageTitleOf(path),d:'',hit:isHit(path)});if(trail.length>30)trail.shift();}
  try{sessionStorage.setItem(key,JSON.stringify(trail));sessionStorage.setItem(tsKey,String(now));}catch(e){}
  if(path!=='/contact'){try{sessionStorage.setItem('rh_trigger',pageTitleOf(path));}catch(e){}}
  return trail;
}
const RH_TRAIL=loadTrail();
function loadTalk(){
  let talk=[];try{talk=JSON.parse(sessionStorage.getItem('rh_talk'))||[]}catch(e){}
  return talk;
}
const RH_TALK=loadTalk();
function saveTalk(){
  try{sessionStorage.setItem('rh_talk',JSON.stringify(RH_TALK))}catch(e){}
}
/* 预约表单 */
async function submitForm(e){
  e.preventDefault();
  const form=document.getElementById('cForm');
  const cEl=document.getElementById('fCompany'),nEl=document.getElementById('fName'),pEl=document.getElementById('fPhone');
  const c=cEl.value.trim(), n=nEl.value.trim(), p=pEl.value.trim();
  [cEl,nEl,pEl].forEach(clearErr);
  if(!c){fieldErr(cEl,'请填写企业名称');return false}
  if(!n){fieldErr(nEl,'请填写姓名');return false}
  if(!p){fieldErr(pEl,'请填写手机号');return false}
  if(!isCNPhone(p)){fieldErr(pEl,'请输入正确的手机号（1 开头的 11 位数字）');return false}
  const eEl=document.getElementById('fEmail'), em=eEl.value.trim();
  if(em&&!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)){fieldErr(eEl,'邮箱格式不正确');return false}
  const intents=[...form.querySelectorAll('.cbs input[type=checkbox]:checked')].map(cb=>(cb.parentElement.textContent||'').trim()).filter(Boolean);
  const params=new URLSearchParams(location.search),payload={
    company:c,name:n,phone:normPhone(p),
    department:(document.getElementById('fDept')||{}).value||'',
    title:document.getElementById('fTitle').value.trim(),
    problem:document.getElementById('fMsg').value.trim(),source:location.pathname,
    email:em,intents,
    leadPage:location.pathname,
    trigger:sessionStorage.getItem('rh_trigger')?('站内 · '+sessionStorage.getItem('rh_trigger')):(document.referrer?'外部进入':'直接进入'),
    device:detectDevice(),
    trail:RH_TRAIL.map(x=>({h:x.h,t:x.t,d:x.d,hit:!!x.hit})),
    talk:RH_TALK,
    landing_page:location.pathname+location.search,referrer:document.referrer
  };
  ['utm_source','utm_medium','utm_campaign','utm_term','utm_content'].forEach(k=>payload[k]=params.get(k)||'');
  const button=form.querySelector('button[type="submit"]');
  button.disabled=true; button.textContent='提交中…';
  try{
    const response=await fetch('/api/appointments/website',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(!response.ok)throw new Error('submit failed');
    form.innerHTML='<div class="ok-msg">✓ 提交成功，顾问将在 1 个工作日内联系你</div>';
    try{sessionStorage.removeItem('rh_talk');RH_TALK.length=0;}catch(e){}
  }catch(error){
    button.disabled=false; button.textContent='提交预约 →';
    fieldErr(pEl,'提交失败，请稍后重试或拨打 400-175-0886');
  }
  return false;
}
route();

/* 抽屉拖拽调宽 */
(function(){
  const handle=document.getElementById('dwResize');
  let startX=0,startW=0;
  handle.addEventListener('pointerdown',e=>{
    startX=e.clientX; startW=drawer.getBoundingClientRect().width;
    handle.classList.add('active'); drawer.classList.add('resizing');
    handle.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  handle.addEventListener('pointermove',e=>{
    if(!handle.classList.contains('active'))return;
    const w=Math.min(Math.max(startW+(startX-e.clientX),380),Math.min(820,innerWidth*.92));
    drawer.style.width=w+'px';
  });
  const end=()=>{handle.classList.remove('active');drawer.classList.remove('resizing')};
  handle.addEventListener('pointerup',end);
  handle.addEventListener('pointercancel',end);
})();

/* ================= 全站滚动进场 v3：逐卡观察 · 播完摘类还原 hover · 切页重放 ================= */
const ANIM_SEL='.mini,.pcard,.tl-card,.case-card,.pv-card,.expert,.course,.stage,.faq-item,.art,.race .rc,.raaid .st,.step7,.tl-stat,.zrow,.zcore,.ol-card,.mod,.track-head,.stat-big';
var animIO=null;
function animPrep(root){
  if(!animIO)return;
  (root||document).querySelectorAll(ANIM_SEL).forEach(el=>{
    if(el.dataset.anim)return;
    el.dataset.anim='1';
    let i=0,n=el;
    while((n=n.previousElementSibling))if(n.dataset&&n.dataset.anim)i++;
    el.dataset.ad=Math.min(i*65,420);
    el.classList.add('aitem');
    el.style.transitionDelay=el.dataset.ad+'ms';
    animIO.observe(el);
  });
}
(function(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  animIO=new IntersectionObserver(es=>{
    es.forEach(e=>{
      const el=e.target;
      if(!e.isIntersecting||!el.classList.contains('aitem')||el.classList.contains('in'))return;
      el.classList.add('in');
      const d=parseInt(el.dataset.ad)||0;
      /* 入场播完后摘除动画类：卡片自身的 hover 位移与过渡完全恢复 */
      setTimeout(()=>{el.classList.remove('aitem','in');el.style.transitionDelay=''},700+d);
    });
  },{threshold:.06,rootMargin:'0px 0px -4% 0px'});
  animPrep(document);
})();
function animReset(scope){
  if(!animIO||!scope)return;
  scope.querySelectorAll('[data-anim]').forEach(el=>{
    el.classList.remove('in');
    el.classList.add('aitem');
    el.style.transitionDelay=(el.dataset.ad||0)+'ms';
    animIO.observe(el);
  });
}

/* ================= 3D 隧道 HERO 逻辑（镜头推进版） ================= */
(function () {
  const root = document.getElementById('hero');
  const room = document.getElementById('j3dRoom');
  if (!root || !room || !root.classList.contains('j3d')) return;

  /* 图片源：字符卡片（21 个业务词） + 面性图标卡片，全部品牌色、无外链 */
  const WORDS=['AI','Agent','FDE','data','token','Agentic','数据','大模型','智能体','碳硅','碳基','硅基','AI 战队','人效','陪跑','转型','部署','知识库','智库','RUIHUA CONSULTING','瑞华智策'];
  const IMGS = [];
  WORDS.forEach((w,i)=>IMGS.push('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(tileWordSVG(w,PAL[i%PAL.length],264,165))));
  /* 面性图标：亮色底 + 品牌色实心图形（原版六色板） */
  [[1,0],[3,3],[6,1],[4,5],[2,2],[0,4],[5,0],[3,1],[6,5],[2,4]]
    .forEach(([m,c])=>IMGS.push('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(tileSVG(m,PAL[c],220))));

  const CFG = {
    images: IMGS,
    stageW: 2100, stageH: 1280,
    hw: 1000, hh: 600,
    far: -2100, near: 300,
    cell: 200,
    duration: 26,
    tileW: 176, tileH: 110,
    wallFill: 0.34, volFill: 0.20,
    parallax: 4.5,               /* 视差加大一档 */
    shiftX: 30, shiftY: 20,      /* 鼠标横移 / 纵移的最大位移（px） */
    ds: 2,
    autoQuality: true,
    camZ: 460, zoomAdd: 0.14, wheelBoost: 130, ease: 0.085,
    camHold: 0.85,               /* 镜头在此进度前完成全部行程，之后保持不动（到达感） */
    arriveFrom: 0.7,             /* 从此进度起进入「到达段」：雾淡出、图块散开 */
    seed: 20260826
  };

  const DEPTH = CFG.near - CFG.far;
  const SLOTS = Math.round(DEPTH / CFG.cell);
  const clamp = (v,a,b) => v < a ? a : v > b ? b : v;

  let s = CFG.seed;
  const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const centers = half => {
    const out = [], n = Math.floor(half / CFG.cell);
    for (let i = -n; i < n; i++) out.push(i * CFG.cell + CFG.cell / 2);
    return out;
  };

  const frag = document.createDocumentFragment();
  const over = 2 * CFG.cell;
  const midZ = (CFG.far + CFG.near) / 2;
  const fadeMask = dir => `linear-gradient(${dir},transparent 0%,#000 14%,#000 58%,transparent 100%)`;

  const walls = [
    { w: DEPTH + over, h: CFG.hh * 2, t:`translate3d(${-CFG.hw}px,0,${midZ}px) rotateY(90deg)`,  kf:'j3d-gx-neg', mask:fadeMask('to right')  },
    { w: DEPTH + over, h: CFG.hh * 2, t:`translate3d(${ CFG.hw}px,0,${midZ}px) rotateY(-90deg)`, kf:'j3d-gx-pos', mask:fadeMask('to left')  },
    { w: CFG.hw * 2, h: DEPTH + over, t:`translate3d(0,${-CFG.hh}px,${midZ}px) rotateX(-90deg)`, kf:'j3d-gy-neg', mask:fadeMask('to bottom') },
    { w: CFG.hw * 2, h: DEPTH + over, t:`translate3d(0,${ CFG.hh}px,${midZ}px) rotateX(90deg)`,  kf:'j3d-gy-pos', mask:fadeMask('to top') }
  ];
  const DS = CFG.ds;
  walls.forEach(c => {
    const el = document.createElement('div');
    el.className = 'j3d-wall';
    const w = c.w / DS, hh2 = c.h / DS;
    Object.assign(el.style, {
      width:w+'px', height:hh2+'px',
      marginLeft:(-w/2)+'px', marginTop:(-hh2/2)+'px',
      transform:c.t + ` scale(${DS})`
    });
    const g = document.createElement('div');
    g.className = 'j3d-grid';
    g.style.setProperty('--gridkf', c.kf);
    g.style.setProperty('--mask', c.mask);
    el.appendChild(g);
    frag.appendChild(el);
  });
  (function backWall(){
    const el = document.createElement('div');
    el.className = 'j3d-wall';
    const w = CFG.hw * 2 / CFG.ds, hh2 = CFG.hh * 2 / CFG.ds;
    Object.assign(el.style, {
      width:w+'px', height:hh2+'px',
      marginLeft:(-w/2)+'px', marginTop:(-hh2/2)+'px',
      transform:`translate3d(0,0,${CFG.far + 40}px) scale(${CFG.ds})`,
      opacity:.75
    });
    const g = document.createElement('div');
    g.className = 'j3d-grid';
    g.style.setProperty('--mask','radial-gradient(58% 72% at 50% 50%,#000 0%,#000 46%,transparent 88%)');
    g.style.animation = 'none';
    el.appendChild(g);
    frag.appendChild(el);
  })();
  room.appendChild(frag);          /* 墙体先上，图块等预渲染池就绪后再上 */

  /* —— 离屏 canvas 预渲染：模糊+压暗位图一次生成，运行时零 filter 重算 ——
     降采样再放大近似高斯模糊，全内核通用，不依赖 ctx.filter */
  const BLUR_POOL = {};
  function makeBlurURL(im){
    const w = im.naturalWidth || 264, h = im.naturalHeight || 165;
    const t = document.createElement('canvas');
    t.width = Math.max(2, Math.round(w / 6));
    t.height = Math.max(2, Math.round(h / 6));
    t.getContext('2d').drawImage(im, 0, 0, t.width, t.height);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const cc = c.getContext('2d');
    cc.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in cc) cc.imageSmoothingQuality = 'high';
    cc.drawImage(t, 0, 0, w, h);
    cc.fillStyle = 'rgba(23,21,29,.22)';   /* 远景压暗一并烘焙 */
    cc.fillRect(0, 0, w, h);
    return c.toDataURL('image/png');
  }

  const tfrag = document.createDocumentFragment();
  function makeTile(slotTransform, isVol, zSlot, w, hh2) {
    const delay = -(zSlot / SLOTS) * CFG.duration;
    const fly = document.createElement('div');
    fly.className = 'j3d-fly';
    fly.style.animationDelay = delay + 's';
    const slot = document.createElement('div');
    slot.className = 'j3d-slot' + (isVol ? ' is-vol' : '') + (rnd() < .5 ? ' dof' : '');
    Object.assign(slot.style, {
      width:w+'px', height:hh2+'px',
      marginLeft:(-w/2)+'px', marginTop:(-hh2/2)+'px',
      transform:slotTransform,
      animationDelay:delay + 's'
    });
    const img = document.createElement('img');
    const idx = Math.floor(rnd() * CFG.images.length);
    img.src = CFG.images[idx];
    img.alt = ''; img.decoding = 'async';
    img.addEventListener('error', () => { img.removeAttribute('src'); img.classList.add('is-blank'); });
    /* 亮色图标卡做色调/明度扰动削弱重复感；深色字符卡只做轻微明度变化。
       静态 filter 只光栅一次，之后帧间纯合成 */
    const th = idx < WORDS.length ? '' : (rnd()*12-6).toFixed(0)+'deg';
    const ts = idx < WORDS.length ? '' : (0.85+rnd()*0.3).toFixed(2);
    const tb = idx < WORDS.length ? (0.78+rnd()*0.3).toFixed(2) : (0.6+rnd()*0.45).toFixed(2);
    if (th) img.style.setProperty('--th', th);
    if (ts) img.style.setProperty('--ts', ts);
    img.style.setProperty('--tb', tb);
    slot.appendChild(img);
    /* 景深模糊层：预渲染位图 + 仅 opacity 的合成动画 */
    if (slot.classList.contains('dof') && BLUR_POOL[CFG.images[idx]]) {
      const bi = document.createElement('img');
      bi.className = 'dofb';
      bi.src = BLUR_POOL[CFG.images[idx]];
      bi.alt = ''; bi.decoding = 'async';
      if (th) bi.style.setProperty('--th', th);
      if (ts) bi.style.setProperty('--ts', ts);
      bi.style.setProperty('--tb', tb);
      bi.style.animationDelay = delay + 's';   /* 与推进动画同相位 */
      slot.appendChild(bi);
    }
    fly.appendChild(slot);
    tfrag.appendChild(fly);
  }

  const yCells = centers(CFG.hh);
  const xCells = centers(CFG.hw);
  const TW = CFG.tileW, TH = CFG.tileH;
  function buildTiles(){
    for (let z = 0; z < SLOTS; z++) {
      yCells.forEach(y => {
        if (rnd() < CFG.wallFill) makeTile(`translate3d(${-CFG.hw}px,${y}px,0) rotateY(90deg)`,  false, z, TW, TH);
        if (rnd() < CFG.wallFill) makeTile(`translate3d(${ CFG.hw}px,${y}px,0) rotateY(-90deg)`, false, z, TW, TH);
      });
      xCells.forEach(x => {
        if (rnd() < CFG.wallFill * .5) makeTile(`translate3d(${x}px,${-CFG.hh}px,0) rotateX(-90deg)`, false, z, TW, TH);
        if (rnd() < CFG.wallFill * .5) makeTile(`translate3d(${x}px,${ CFG.hh}px,0) rotateX(90deg)`,  false, z, TW, TH);
      });
    }
    for (let z = 0; z < SLOTS; z++) {
      if (z > SLOTS * .52) continue;
      xCells.forEach(x => {
        yCells.forEach(y => {
          if (rnd() > CFG.volFill) return;
          makeTile(`translate3d(${x}px,${y}px,0)`, true, z, TW, TH);
        });
      });
    }
    room.appendChild(tfrag);
  }
  /* 预渲染池就绪后再生成图块（data-URI 解码极快，肉眼无感知延迟）；
     单张失败不阻塞，最长 1.5s 兜底直接建块 */
  let tilesBuilt = false;
  const buildOnce = () => { if (!tilesBuilt) { tilesBuilt = true; buildTiles(); } };
  Promise.all(CFG.images.map(src => new Promise(res => {
    const im = new Image();
    im.onload = () => { try { BLUR_POOL[src] = makeBlurURL(im); } catch(e){} res(); };
    im.onerror = res;
    im.src = src;
  }))).then(buildOnce);
  setTimeout(buildOnce, 1500);

  let camMax = CFG.camZ;
  function fit() {
    const r = root.getBoundingClientRect();
    root.style.setProperty('--j3d-scale',
      Math.max(r.width / CFG.stageW, r.height / CFG.stageH).toFixed(4));
    camMax = innerWidth < 760 ? CFG.camZ * .5 : CFG.camZ;
  }
  fit();
  new ResizeObserver(fit).observe(root);

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scroller = root.closest('.j3d-scroll');
  let tx = 0, ty = 0, cx = 0, cy = 0;
  let tp = 0, cp = 0;
  let boost = 0;
  let raf = null;
  /* 缓入缓出 + 长减速尾：起步柔、中段快、接近内容区前就基本停稳 */
  const smooth = t => t * t * (3 - 2 * t);
  const easeArrive = t => 1 - Math.pow(1 - smooth(t), 2.2);

  function readProgress() {
    if (scroller) {
      const r = scroller.getBoundingClientRect();
      const len = r.height - innerHeight;
      tp = len > 0 ? clamp(-r.top / len, 0, 1) : 0;
    } else {
      const r = root.getBoundingClientRect();
      tp = clamp(-r.top / Math.max(r.height, 1), 0, 1);
    }
    kick();
  }
  function tick() {
    cx += (tx - cx) * .06;
    cy += (ty - cy) * .06;
    cp += (tp - cp) * CFG.ease;
    boost *= .93;

    /* ① 镜头推进：缓入缓出，camHold 之前走完全程，之后保持——内容出现前完成减速 */
    const p = easeArrive(clamp(cp / CFG.camHold, 0, 1));
    /* ③ 到达段（arriveFrom→1）：雾淡出、网格隐去、图块加速掠过并散开 */
    const a = smooth(clamp((cp - CFG.arriveFrom) / (1 - CFG.arriveFrom), 0, 1));
    const st = root.style;
    st.setProperty('--j3d-cam',  (p * camMax + boost).toFixed(1) + 'px');
    st.setProperty('--j3d-zoom', (1 + p * CFG.zoomAdd + a * .3).toFixed(4));
    st.setProperty('--j3d-fog1', ((1 - p * .45) * (1 - a)).toFixed(3));
    st.setProperty('--j3d-fog2', (1 + p * .25 - a * .3).toFixed(3));
    st.setProperty('--j3d-tile-o', (1 - a * .85).toFixed(3));
    st.setProperty('--j3d-grid-o', (1 - a * .55).toFixed(3));
    /* ② 视差：旋转（俯仰加大）+ 反向横移，房间跟着镜头轻轻晃 */
    room.style.setProperty('--j3d-ry', (cx * CFG.parallax).toFixed(3) + 'deg');
    room.style.setProperty('--j3d-rx', (-cy * CFG.parallax * .62).toFixed(3) + 'deg');
    room.style.setProperty('--j3d-px', (-cx * CFG.shiftX).toFixed(1) + 'px');
    room.style.setProperty('--j3d-py', (-cy * CFG.shiftY).toFixed(1) + 'px');

    const busy = Math.abs(tx-cx) > .0015 || Math.abs(ty-cy) > .0015
              || Math.abs(tp-cp) > .0008 || Math.abs(boost) > .5;
    raf = busy ? requestAnimationFrame(tick) : null;
  }
  function kick(){ if (!raf) raf = requestAnimationFrame(tick); }

  addEventListener('scroll', readProgress, { passive:true });
  addEventListener('resize', readProgress);
  readProgress();

  root.addEventListener('wheel', e => {
    if (reduce) return;
    const atEdge = (e.deltaY > 0 && tp >= .999) || (e.deltaY < 0 && tp <= .001);
    if (!atEdge) return;
    boost = clamp(boost + e.deltaY * .35, -CFG.wheelBoost * .4, CFG.wheelBoost);
    kick();
  }, { passive:true });

  if (!reduce && matchMedia('(pointer:fine)').matches) {
    root.addEventListener('pointermove', e => {
      const r = root.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - .5) * 2;
      ty = ((e.clientY - r.top) / r.height - .5) * 2;
      kick();
    });
    root.addEventListener('pointerleave', () => { tx = 0; ty = 0; kick(); });
  }

  if (CFG.autoQuality && !reduce) addEventListener('load', () => setTimeout(function autoQuality(){
    let n = 0, t0 = performance.now(), last = t0;
    (function sample(now){
      n++; last = now;
      if (now - t0 < 1200) return requestAnimationFrame(sample);
      const measured = n / ((last - t0) / 1000);
      if (measured >= 35) return;
      const keep = measured < 25 ? 3 : 2;
      [...room.querySelectorAll('.j3d-fly')].forEach((el, i) => { if (i % keep) el.remove(); });
      /* 低端设备再摘掉景深模糊层，图层数减半 */
      room.querySelectorAll('.dofb').forEach(el => el.remove());
      root.dataset.j3dQuality = 'reduced';
    })(t0);
  }, 1500));

  new IntersectionObserver(([e]) => root.classList.toggle('is-paused', !e.isIntersecting),
    { threshold: 0 }).observe(root);

  /* ---------------- 背景星点粒子（Canvas 2D，随滚动加速流动） ---------------- */
  (function stars(){
    const view = root.querySelector('.j3d-view');
    if (!view) return;
    const cv = document.createElement('canvas');
    cv.className = 'j3d-stars';
    view.insertBefore(cv, view.firstChild);
    const ctx2 = cv.getContext('2d');
    if (!ctx2) return;
    const mobile = innerWidth < 760;
    const N = mobile ? 70 : 140;                    /* 移动端粒子减半 */
    const dpr = Math.min(devicePixelRatio || 1, 2);
    let W = 0, H = 0;
    function sizeCv(){
      const r = view.getBoundingClientRect();
      W = Math.max(r.width, 1); H = Math.max(r.height, 1);
      cv.width = W * dpr; cv.height = H * dpr;
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    sizeCv();
    new ResizeObserver(sizeCv).observe(view);

    let sSeed = 777;
    const srnd = () => (sSeed = (sSeed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const stars = [];
    for (let i = 0; i < N; i++) stars.push({
      a: srnd() * Math.PI * 2,                      /* 从中心向外的角度 */
      d: .06 + srnd() * .94,                        /* 归一化距离 */
      z: .3 + srnd() * .7,                          /* 深度 → 速度与大小 */
      tint: srnd() < .55                            /* 紫 / 白 两色 */
    });

    function draw(){
      ctx2.clearRect(0, 0, W, H);
      const cxp = W / 2, cyp = H / 2;
      const maxR = Math.hypot(cxp, cyp);
      for (const st of stars) {
        const r = st.d * maxR;
        const x = cxp + Math.cos(st.a) * r;
        const y = cyp + Math.sin(st.a) * r * .78;   /* 轻微压扁，贴合隧道透视 */
        const al = Math.min(1, st.d * 1.6) * (.14 + st.z * .3);
        ctx2.globalAlpha = al;
        ctx2.fillStyle = st.tint ? '#bda5ff' : '#f0edf7';
        const sz = (0.6 + st.z * 1.3) * (0.5 + st.d * .8);
        ctx2.beginPath();
        ctx2.arc(x, y, sz, 0, 6.2832);
        ctx2.fill();
      }
      ctx2.globalAlpha = 1;
    }

    if (reduce) { draw(); return; }                 /* 减少动态 → 静止星空 */

    let lastCp = 0, vel = 0, sraf = null;
    function loop(){
      sraf = null;
      const paused = root.classList.contains('is-paused') || document.hidden
        || (scroller && scroller.style.display === 'none');
      if (!paused) {
        /* 基础漂移 + 滚动速度增益（随镜头推进星点加速外流） */
        vel = vel * .9 + Math.abs(cp - lastCp) * 2.2;
        lastCp = cp;
        const sp = .00045 + vel * .12;
        for (const st of stars) {
          st.d += sp * (.4 + st.z);
          if (st.d > 1.02) { st.d = .04 + (st.d - 1.02); st.a = Math.random() * Math.PI * 2; }
        }
        draw();
      }
      sraf = requestAnimationFrame(loop);
    }
    loop();
  })();
})();

/* ===== 四卡 3D 倾斜 + 内层视差 + 光斑跟随 + 入场 stagger ===== */
(function(){
  /* 入场 stagger：01→04 逐张浮起（140ms 递进，明显强于全局 65ms），按每个网格独立计数 */
  document.querySelectorAll('.pv-grid').forEach(grid=>{
    grid.querySelectorAll('.pv-card').forEach((el,i)=>{
      if(el.dataset.anim){el.dataset.ad=i*140;el.style.transitionDelay=(i*140)+'ms'}
    });
  });
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  if(!matchMedia('(pointer:fine)').matches)return;   /* 触屏不做倾斜/光斑 */
  document.querySelectorAll('.pv-grid .pv-card').forEach(card=>{
    let raf=null,px=.5,py=.5;
    const txt=card.querySelector('.txt'), deco=card.querySelector('.pv-deco');
    card.addEventListener('pointermove',e=>{
      const r=card.getBoundingClientRect();
      px=(e.clientX-r.left)/r.width; py=(e.clientY-r.top)/r.height;
      card.style.setProperty('--mx',(px*100).toFixed(1)+'%');
      card.style.setProperty('--my',(py*100).toFixed(1)+'%');
      if(!raf)raf=requestAnimationFrame(()=>{raf=null;
        card.style.setProperty('--pry',((px-.5)*6).toFixed(2)+'deg');
        card.style.setProperty('--prx',((.5-py)*5).toFixed(2)+'deg');
        /* 内层视差：文字反向浅移、装饰元素同向深移 → 层次分离 */
        if(txt)txt.style.transform=`translate3d(${((.5-px)*8).toFixed(1)}px,${((.5-py)*6).toFixed(1)}px,0)`;
        if(deco)deco.style.transform=`translate3d(${((px-.5)*14).toFixed(1)}px,${((py-.5)*10).toFixed(1)}px,0)`;
      });
    });
    card.addEventListener('pointerleave',()=>{
      card.style.setProperty('--prx','0deg');
      card.style.setProperty('--pry','0deg');
      if(txt)txt.style.transform='';
      if(deco)deco.style.transform='';
    });
  });
})();

/* 首页隧道演示窗与 AI 顾问悬浮按钮避让：演示窗在屏则收起 fab */
(function(){
  const dw = document.getElementById('demoWin');
  if(!dw || !('IntersectionObserver' in window)) return;
  new IntersectionObserver(([e]) =>
    document.body.classList.toggle('dw-vis', e.isIntersecting),
    { threshold: .12 }).observe(dw);
})();
