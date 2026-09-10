/** Migrate the September B design into the existing SSR frontend. No DB writes. */
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const ROOT = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const write = (file, value) => fs.writeFileSync(path.join(ROOT, file), value);
const source = read('new/09-09.html');
const $ = cheerio.load(source);
const MARK = '/* September B generated additions */';
const industries = ['manufacturing','retail','finance','education','game','trade','property','other'];
function links(html) {
  return html.replace(/https:\/\/www\.ruihuaconsulting\.com\/nqoc/g, '/nqoc')
    .replace(/#\/cases\/([a-z]+)/g, (m, slug) => industries.includes(slug) ? '/cases/industry/' + slug : '/cases')
    .replace(/#\/about\/team/g, '/about/team')
    .replace(/#\/solutions\/hcvm/g, '/hcvm')
    .replace(/#\//g, '/');
}

// Distinct IDs preserve existing externalized styles/events on retained legacy pages.
const styles = new Map(), events = new Map();
function transform(html) {
  return links(html).replace(/\son([a-z]+)="([^"]*)"/g, (_, type, expr) => {
    expr = expr.replace(/location\.hash\s*=/g, 'location.href=');
    const key = type + '\n' + expr;
    if (!events.has(key)) events.set(key, { type, expr, id: 'b' + (events.size + 1) });
    return ` data-evt-${type}="${events.get(key).id}"`;
  }).replace(/\sstyle="([^"]*)"/g, (_, value) => {
    if (!styles.has(value)) styles.set(value, 'b' + (styles.size + 1));
    return ` data-sx="${styles.get(value)}"`;
  });
}

// Extract embedded images into dedicated, content-addressed frontend assets.
const crypto = require('crypto');
const imageDir = path.join(ROOT, 'public/images/2026-b');
fs.mkdirSync(imageDir, { recursive: true });
$('img[src^="data:image/"]').each((_, el) => {
  const match = $(el).attr('src').match(/^data:image\/([\w+.-]+);base64,(.+)$/s);
  if (!match) return;
  const data = Buffer.from(match[2], 'base64');
  const extension = data.subarray(0, 4).toString() === 'RIFF' ? 'webp' : match[1].replace('svg+xml', 'svg');
  const name = crypto.createHash('sha256').update(data).digest('hex').slice(0, 16) + '.' + extension;
  fs.writeFileSync(path.join(imageDir, name), data);
  $(el).attr('src', '/images/2026-b/' + name);
});

const navKey = href => href === '/' ? 'home' : href.startsWith('/solutions') ? 'solutions' : href.startsWith('/cases') ? 'cases' : href.startsWith('/insights') ? 'insights' : href.startsWith('/about') ? 'about' : href.startsWith('/contact') ? 'contact' : '';
$('#navLinks>a, #mnav>a').each((_, el) => { const key = navKey(links($(el).attr('href') || '')); if (key) $(el).attr('data-nav-key', key); });
// Preserve dedicated team and privacy routes used by existing inbound links.
$('a').each((_, el) => { if ($(el).text().includes('团队基因')) $(el).attr('href', '/about/team'); });
$('#cForm label').each((_, el) => { const input = $(el).next('input,textarea,select'); if (input.attr('id')) $(el).attr('for', input.attr('id')); });
$('#cForm').attr('novalidate', 'novalidate');
$('#cForm').html($('#cForm').html().replace('《隐私政策》', '<a href="/privacy">隐私政策</a>'));

// Keep global contact settings and QR code managed by the existing CMS.
const oldFooter = cheerio.load(read('views/2026/partials/footer.html'), null, false);
const footerColumns = $('.footer .f-col');
footerColumns.last().replaceWith(oldFooter('.f-col').last().toString());
$('.footer .f-base').html(oldFooter('.f-base').html());
write('views/2026/partials/nav.html', transform($('#nav').toString() + '\n' + $('#megaDim').toString()) + '\n');
write('views/2026/partials/mobile-nav.html', transform($('#mnav').toString()) + '\n');
write('views/2026/partials/footer.html', transform($('.footer').toString()) + '\n');

// Keep the modal container for existing compatibility handlers; use the new drawer shell.
const oldDrawer = cheerio.load(read('views/2026/partials/drawer.html'), null, false);
write('views/2026/partials/drawer.html', oldDrawer('#cmodal').toString() + '\n' + transform($('.fab').toString() + $('#drawer').toString()) + '\n');

// Database-owned sections remain injection points, never the design's demo records.
$('#indTabs').html('<!--CASE_TABS-->');
$('#caseGrid').html('<!--CASE_CARDS-->');
$('#home-faq .faq-item').remove();
$('#home-faq').append('<!--HOME_FAQ-->');
const featured = $('#homeMain .tl-cards3').filter((_, el) => $(el).find('a[href^="#/cases"]').length > 0).first();
if (featured.length) featured.html('<!--HOME_FEATURED-->');
else $('#home-faq').before('<section class="tl-sec reveal"><h2>从业务场景，看见<em>落地结果</em>。</h2><div class="tl-cards3"><!--HOME_FEATURED--></div><p><a href="/cases">查看全部案例 →</a></p></section>');
// Team stays a separate route while the company page also retains the source composition.
const team = '<div class="page" data-page="about-team"><div class="sub-hero"><div class="wrap"><div class="eyeb">OUR TEAM</div><h1>团队基因 · <em>先自己跑通，再服务客户</em></h1></div></div>' + $('#about-team').toString() + '</div>';
write('views/2026/page-blocks/about-team.html', transform(team) + '\n');
write('views/2026/page-blocks/home.html', transform($('#heroWrap').toString() + $('#homeMain').toString()) + '\n');
$('.page[data-page]').each((_, el) => {
  const key = $(el).attr('data-page');
  if (key === 'case' || key === 'article') return; // Details are rendered from actual CMS records.
  write(`views/2026/page-blocks/${key}.html`, transform($(el).toString()) + '\n');
});

write('public/css/rh2026.css', $('style').map((_, el) => $(el).text()).get().join('\n') + '\n' + read('public/css/rh2026-production.css'));
write('public/css/rh2026-ext.css', read('public/css/rh2026-ext.css').split(MARK)[0] + MARK + '\n' + [...styles].map(([value, id]) => `[data-sx="${id}"][data-sx="${id}"]{${value}}`).join('\n') + '\n');
const types = [...new Set([...events.values()].map(event => event.type))];
const handlers = [...events.values()].map(({ id, expr }) => `${id}:function(event){${expr}}`).join(',\n');
const listeners = types.map(type => `document.addEventListener('${type}',function(event){const el=event.target.closest?.('[data-evt-${type}]');if(!el)return;const fn=handlers[el.getAttribute('data-evt-${type}')];if(fn&&fn.call(el,event)===false)event.preventDefault();},${type === 'error'});`).join('\n');
write('public/js/rh2026-ext.js', read('public/js/rh2026-ext.js').split(MARK)[0] + MARK + '\n(function(){const handlers={' + handlers + '};\n' + listeners + '\n})();\n');

// Replace visual engines only. Keep API submissions, attribution, CMS loading and detail behavior.
let js = read('public/js/rh2026.js');
const designJs = $('script:not([src])').last().text();
const scroll = '/* ================= 滚动：';
const art = '/* ================= 产品 hero';
const routes = '/* ================= 子页路由';
const animation = '/* ================= 全站滚动进场';
const faq = js.includes('/* FAQ 手风琴') ? js.slice(js.indexOf('/* FAQ 手风琴')) : '';
js = designJs.slice(0, designJs.indexOf(scroll)) + js.slice(js.indexOf(scroll));
js = js.slice(0, js.indexOf(art)) + links(designJs.slice(designJs.indexOf(art), designJs.indexOf(routes))) + js.slice(js.indexOf(routes));
js = js.slice(0, js.indexOf(animation)) + links(designJs.slice(designJs.indexOf(animation))) + '\n' + faq;
const routeStart = js.indexOf('function route(){');
const routeEnd = js.indexOf('/* ===== 移动端菜单', routeStart);
js = js.slice(0, routeStart) + `function route(){
  // SSR owns routing; fragments are section anchors and must never hide the page.
  const home=!!document.getElementById('heroWrap');
  document.body.classList.toggle('home-on',home);
  const current=document.querySelector('.page[data-page]');
  document.querySelectorAll('.p-tabs a').forEach(a=>a.classList.toggle('on',a.dataset.pt===current?.dataset.page||a.getAttribute('href')===location.pathname));
  const key=home?'home':location.pathname.split('/')[1];
  document.querySelectorAll('[data-nav-key]').forEach(a=>a.classList.toggle('act',a.dataset.navKey===key));
}

` + js.slice(routeEnd);
write('public/js/rh2026.js', js);
// New visual engine already includes the overseas map; avoid double initialization.
let base = read('views/2026/base.html').replace(/^.*rh2026-eco-overseas\.(css|js).*\n/gm, '');
base = base.replace(/(rh2026(?:-engine|-ext)?\.(?:css|js))\?v=[^"']+/g, '$1?v=20260909-b1');
write('views/2026/base.html', base);
console.log('B frontend migrated; CMS models, server, admin and NQOC untouched.');
