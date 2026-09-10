/* ==========================================================================
   eco / overseas 产品页交互脚本
   - 产品页 CTA 顾问提问逐字轮换（data-qs）
   - HR 出海页人瑞全球布局动态点阵地图（#rhgMap）
   源：new/rh-site/assets/js/core.js、overseas.js
   ========================================================================== */
'use strict';

/* ===== 产品页 CTA：顾问会先问的问题，逐字敲入、轮换 ===== */
(function(){
  const els=[...document.querySelectorAll('.cta-ask .q[data-qs]')]; if(!els.length)return;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){els.forEach(el=>{el.textContent=JSON.parse(el.dataset.qs)[0];el.nextElementSibling&&el.nextElementSibling.remove()});return}
  els.forEach(el=>{
    const qs=JSON.parse(el.dataset.qs); let i=0,running=false;
    function cycle(){
      const pg=el.closest('.page'); if(!pg||!pg.classList.contains('on')||document.hidden){running=false;return}
      running=true; const q=qs[i%qs.length]; let k=0;
      (function type(){k++;el.textContent=q.slice(0,k);if(k<q.length)setTimeout(type,48);else setTimeout(()=>{(function del(){k-=3;if(k>0){el.textContent=q.slice(0,k);setTimeout(del,16)}else{el.textContent='';i++;setTimeout(cycle,300)}})()},2600);})();
    }
    const io=new IntersectionObserver(es=>{if(es[0].isIntersecting&&!running)cycle()},{threshold:.3});
    io.observe(el.closest('.cta-grad'));
  });
})();

/* ===== 人瑞全球布局动态点阵地图组件（rhg-） ===== */
(function(){
  const RHG_SITES = {
    '欧洲': [
      ['英国',-0.1,51.5,'l',-26,-12],['荷兰',4.9,52.4,'l',-43,-34],['法国',2.3,48.9,'l',-34,5],['西班牙',-3.7,40.4,'l',-14,0],
      ['德国',13.4,52.5,'t',0,-18],['瑞典',18.1,59.3,'r',24,-8],['波兰',21,52.2,'r',23,0],['匈牙利',19,47.5,'r',25,13]],
    '中东 · 非洲': [
      ['阿联酋',55.3,25.2,'b',0,40],['沙特',46.7,24.7,'l',-22,14],['埃及',31.2,30,'l',-22,22]],
    '亚太': [
      ['日本',139.7,35.7,'r',22,0],['中国香港',114.2,22.3,'r',62,-22],['越南',105.8,21,'l',-26,-14],['泰国',100.5,13.8,'l',-26,12],
      ['马来西亚',101.7,3.1,'l',-26,6],['新加坡',103.8,1.3,'r',23,18],['印尼',106.8,-6.2,'r',31,20],['印度',77.2,28.6,'b',0,23],
      ['乌兹别克斯坦',69.2,41.3,'r',23,-20]],
    '美洲': [
      ['美国',-118.2,34,'r',23,-12],['墨西哥',-99.1,19.4,'r',22,0],['巴西',-46.6,-23.5,'t',0,-22]]
  };
  const HUB = [104.1,30.6];
  const RHG_DASH = [
    [[109.8,15.6],[110.2,17.2]],
    [[108.3,6.8],[108.7,8.4]],
    [[110.0,4.0],[109.0,4.7]],
    [[112.7,6.5],[111.7,5.7]],
    [[116.0,10.7],[115.2,9.5]],
    [[119.0,18.0],[118.7,16.4]],
    [[121.6,20.8],[122.0,19.5]],
    [[123.0,24.2],[123.3,22.8]]
  ];
  const GRID = {"land":"0:0-2,39-40,53-63,75-77,123-127,131,134-139,150-163;1:0-3,37-38,51-61,63,119-120,150-163;2:1,37,44,49-65,69-70,77,119-122,127-128,130-131,133-134,136-138,140,151-163;3:0-1,36-37,44,46,48,50-70,76-79,119-120,122-127,130-131,135-138,140-141,151-163;4:0-1,23,37,43-44,46-84,104-106,122-128,132-133,136-143,152-162;5:0,21-26,40,43-44,46-84,86,88,90-92,102-111,116-120,123-128,131,133,137-138,140-144,151-163;6:20-29,32,36-38,40-42,44-46,48-94,100-123,127,133-135,137-138,143-145,152-160,162;7:19-30,32,34-44,46-96,102-138,143-146,152-160;8:1-5,18-21,23-27,31-93,95-98,100-134,136-137,143-144,146-147,152-158;9:2-5,17-21,23-27,29-92,103-135,137-138,141-146,152-157;10:16-20,22-93,101-134,144,146,153-156;11:15-19,22-83,85-90,101-133,141-143,146,154-156;12:15-20,23,26-82,86-87,100-108,110-132,141-143,156;13:15,17-19,23-76,85,105,113-133,140-144,146-147;14:9-10,18-19,22-75,84-85,104,115-133,141-147;15:9-10,16-18,22-74,83-85,102-103,115-136,141-148;16:8-9,11,16,18-75,83-84,117-138,140-149;17:8,10-12,14-66,70-77,83,118-138,140-150;18:10-11,13-66,70-75,77,83,119-148,150;19:12-64,71-75,119-144,146,150-151;20:11-50,53-66,73-75,120-146;21:12-17,19-25,27,29-33,36-49,54-64,73-74,120-148;22:12-15,17,19-24,30-33,36-48,56-62,72-73,77,120-143,146;23:8-13,16,18,21-24,31-33,37-48,59-60,71,77,120-143;24:8-11,16,19-22,24-34,36-45,69-70,76,120-142;25:8-11,24-34,37-45,69-70,76,120-141;26:9,13-16,27,29-46,70,74-75,121-141;27:9-16,29-47,72,74,121-140;28:8-18,22,28-47,123-139;29:8-48,123,125-138;30:7-33,36-50,55,124-131,139;31:6-27,29-34,38-56,126-131,139;32:5-27,29-35,37,43-56,125,127-131;33:5-28,30-39,44-56,59-60,128-131,139,142;34:5-28,30-38,45-51,55-60,128-131,135,141;35:5-29,31-37,46-49,55-60,67,129-135,142-143;36:5-29,32-35,46-48,55,57-61,67,132-135;37:5-30,32-33,46-48,57-61,67-68,135-137;38:5-31,35,47-48,54,57,59-61,137,143;39:6-34,47,60,69,138,142,144-147;40:7-34,49,69,139,141-149;41:8-9,11,15-33,56,58,65-66,141-151;42:17-32,57-58,63-65,141-152;43:17-31,57-58,62-65,67-68,70,140-152;44:17-30,58-59,62-64,67-68,72,139-151,153-154;45:17-29,59,64,67,73-77,139-158;46:18-29,73,75-78,80,139-159;47:18-29,62-63,76-77,79,140-159;48:18-29,68,80,141-159;49:18-30,72-74,141-158;50:18-30,34,69-73,77,142-157;51:18-29,33-34,69-74,77-78,143-157;52:18-28,32-34,68-78,144-157;53:18-27,32-33,65-79,87,144-157;54:19-27,32-33,64-80,144-156;55:19-27,32-33,64-81,144-153;56:19-26,64-81,144-153;57:20-26,65-81,144-153;58:20-25,65-81,144-152;59:20-24,65-68,73-80,144-151;60:75-80,143-149;61:76-80,143-149;62:92,143-148;63:92,143-147;64:78-79,90,142-146;65:89,142-145;66:88-89,143-144;67:142-145;68:142-144;69:143-144;70:143-144;71:143-145","cn":"17:67-69;18:67-69;19:65-70;20:51-52,67-72;21:50-53,65-72;22:49-55,63-71;23:49-58,61-70;24:46-66,68;25:46-65;26:47-66;27:48-66;28:48-66;29:49-66;30:51-54,56-67;31:57-66;32:57-65,67;33:57-58,61-63"};

  const W=1180, LON0=-27, k=W/(2*Math.PI);
  const mil=lat=>1.25*Math.log(Math.tan(Math.PI/4+0.4*lat*Math.PI/180));
  const yTop=mil(76);
  const proj=(lon,lat)=>[(((lon-LON0)%360+360)%360)*Math.PI/180*k,(yTop-mil(lat))*k];

  const root=document.getElementById('rhgMap'); if(!root) return;
  const NS='http://www.w3.org/2000/svg';
  const el=(t,a,p)=>{const e=document.createElementNS(NS,t);for(const q in a)e.setAttribute(q,a[q]);if(p)p.appendChild(e);return e};
  const rm=matchMedia('(prefers-reduced-motion:reduce)').matches;

  const STEP=7.2,R=2.15;
  const dots=s=>{let d='';s.split(';').forEach(row=>{const [r,cs]=row.split(':');const y=(+r*STEP+STEP/2).toFixed(1);
    cs.split(',').forEach(seg=>{let [a,b]=seg.split('-').map(Number);if(b===undefined)b=a;
      for(let c=a;c<=b;c++){const x=c*STEP+STEP/2;d+=`M${(x-R).toFixed(1)} ${y}a${R} ${R} 0 1 0 ${2*R} 0a${R} ${R} 0 1 0 ${-2*R} 0`}})});return d};
  document.getElementById('rhgLand').setAttribute('d',dots(GRID.land));
  document.getElementById('rhgCn').setAttribute('d',dots(GRID.cn));
  document.getElementById('rhgDash').setAttribute('d',RHG_DASH.map(([a,b])=>{
    const [x1,y1]=proj(a[0],a[1]),[x2,y2]=proj(b[0],b[1]);const L=Math.hypot(x2-x1,y2-y1),m=Math.max(L,9)/L;
    const cx=(x1+x2)/2,cy=(y1+y2)/2;return `M${(cx+(x1-cx)*m).toFixed(1)} ${(cy+(y1-cy)*m).toFixed(1)}L${(cx+(x2-cx)*m).toFixed(1)} ${(cy+(y2-cy)*m).toFixed(1)}`}).join(''));

  const [hx,hy]=proj(HUB[0],HUB[1]);
  const gh=el('g',{class:'rhg-hub'},document.getElementById('rhgHub'));
  el('circle',{class:'r',cx:hx,cy:hy,r:9},gh); el('circle',{class:'r r2',cx:hx,cy:hy,r:9},gh);
  el('circle',{class:'c',cx:hx,cy:hy,r:5},gh);

  const gA=document.getElementById('rhgArcs'), gS=document.getElementById('rhgSites');
  const all=[]; let n=0;
  Object.entries(RHG_SITES).forEach(([region,list],ri)=>list.forEach(s=>{
    const [name,lon,lat,side,dx,dy]=s; const [x,y]=proj(lon,lat);
    all.push({name,region,ri,x,y,side,dx,dy,dist:Math.hypot(x-hx,y-hy)}); n++;
  }));
  if(n!==23) console.warn('[rhg] 站点数应为 23，当前 '+n);
  all.sort((a,b)=>a.dist-b.dist);
  all.forEach((s,i)=>{
    const d=(0.5+i*0.06).toFixed(2)+'s';
    const mx=(hx+s.x)/2, my=(hy+s.y)/2-Math.min(120,s.dist*0.22);
    const path=el('path',{class:'rhg-arc',d:`M${hx} ${hy}Q${mx} ${my} ${s.x} ${s.y}`,'data-r':s.ri},gA);
    let len=0,px0=hx,py0=hy; for(let t=1;t<=40;t++){const u=t/40,qx=(1-u)*(1-u)*hx+2*(1-u)*u*mx+u*u*s.x,qy=(1-u)*(1-u)*hy+2*(1-u)*u*my+u*u*s.y;len+=Math.hypot(qx-px0,qy-py0);px0=qx;py0=qy}
    path.style.setProperty('--len',(len+2).toFixed(1)); path.style.setProperty('--d',d);
    if(!rm){
      const fx=el('circle',{class:'rhg-fx',r:2.2},gA);
      el('animateMotion',{dur:(3.2+s.dist/260).toFixed(1)+'s',begin:(1.8+i*0.37).toFixed(2)+'s',repeatCount:'indefinite',path:path.getAttribute('d'),calcMode:'spline',keySplines:'.4 0 .6 1',keyTimes:'0;1'},fx);
    }
    const g=el('g',{class:'rhg-site','data-r':s.ri,'data-n':s.name,tabindex:'0'},gS);
    g.style.setProperty('--d',d);
    el('circle',{class:'ring',cx:s.x,cy:s.y,r:6},g);
    el('circle',{class:'dot',cx:s.x,cy:s.y,r:4.5},g);
    const pw=s.name.length*13+18, ph=21;
    const ax=s.x+s.dx, ay=s.y+s.dy; let px,py,pts;
    if(s.side==='l'||s.side==='r'){
      const sg=s.side==='r'?1:-1; const ex=s.x+sg*Math.abs(ay-s.y);
      pts=`${s.x},${s.y} ${ex},${ay} ${ax},${ay}`;
      px=s.side==='r'?ax:ax-pw; py=ay-ph/2;
    }else{
      pts=`${s.x},${s.y} ${ax},${ay}`;
      px=ax-pw/2; py=s.side==='b'?ay:ay-ph;
    }
    const lab=el('g',{class:'rhg-label'},g);
    el('polyline',{class:'rhg-lead',points:pts},lab);
    el('rect',{class:'rhg-pill',x:px,y:py,width:pw,height:ph,rx:6},lab);
    el('text',{class:'rhg-txt',x:px+pw/2,y:py+ph/2+0.5,'text-anchor':'middle','dominant-baseline':'central'},lab).textContent=s.name;
    s.g=g; s.path=path;
    g.addEventListener('mouseenter',()=>focusRegion(s.ri,s.name)); g.addEventListener('mouseleave',()=>focusRegion(null));
    g.addEventListener('focus',()=>focusRegion(s.ri,s.name)); g.addEventListener('blur',()=>focusRegion(null));
  });

  const lg=document.getElementById('rhgLegend');
  Object.entries(RHG_SITES).forEach(([region,list],ri)=>{
    const d=document.createElement('div'); d.dataset.r=ri;
    d.innerHTML=`<b>${region}</b><p>${list.map(s=>`<span data-n="${s[0]}">${s[0]}</span>`).join(' · ')}</p>`;
    d.addEventListener('mouseenter',()=>focusRegion(ri)); d.addEventListener('mouseleave',()=>focusRegion(null));
    d.querySelectorAll('span').forEach(sp=>{sp.addEventListener('mouseenter',e=>{e.stopPropagation();focusRegion(ri,sp.dataset.n)});sp.addEventListener('mouseleave',()=>focusRegion(ri))});
    lg.appendChild(d);
  });
  function focusRegion(ri,name){
    if(ri===null||ri===undefined){root.removeAttribute('data-focus')}else{root.setAttribute('data-focus',ri)}
    root.querySelectorAll('[data-r]').forEach(e=>e.classList.toggle('hi',ri!==null&&ri!==undefined&&+e.dataset.r===ri&&(!name||e.dataset.n===undefined||e.dataset.n===name||e.tagName==='DIV')));
    lg.querySelectorAll('span').forEach(sp=>sp.classList.toggle('hi',!!name&&sp.dataset.n===name));
    if(name){all.forEach(s=>{if(s.name===name)s.path.classList.add('hi');else if(s.ri===ri)s.path.classList.remove('hi')})}
  }

  let timer=null;
  const lit=()=>{const s=all[Math.floor(Math.random()*all.length)];s.g.classList.remove('lit');void root.offsetWidth;s.g.classList.add('lit')};
  const start=()=>{root.classList.add('on');if(!rm&&!timer){setTimeout(()=>{if(!timer){lit();timer=setInterval(lit,1100)}},2200)}};
  const stop=()=>{clearInterval(timer);timer=null};
  if('IntersectionObserver' in window){
    new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)start();else stop()}),{threshold:.25}).observe(root);
  }else start();
  root.querySelector('.rhg-map').addEventListener('mouseenter',()=>{if(!rm){stop();lit();timer=setInterval(lit,480)}});
  root.querySelector('.rhg-map').addEventListener('mouseleave',()=>{stop();if(!rm)timer=setInterval(lit,1100)});
})();
