'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const { chromium, webkit } = require('playwright');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
for (const asset of new Set(html.match(/images\/[A-Za-z0-9_.\/-]+\.(?:png|webp|jpg|svg)/g))) {
  assert.ok(fs.existsSync(path.join(root, asset)), `Missing artwork: ${asset}`);
}
// Validate the complete learning collection independently of a particular day's card.
const cards = html.match(/const englishStudyCards=(\[[^\n]+\]);/)[1];
const related = script.slice(script.indexOf('const ANNE_RELATED_ENGLISH='), script.indexOf('function softenEnglishCard'));
const learning = vm.runInNewContext(`const englishStudyCards=${cards};${related};({cards:englishStudyCards,config:ANNE_RELATED_ENGLISH,templates:ANNE_APP_TEMPLATES,related:relatedEnglishCard})`);
assert.equal(learning.cards.length, 500);
for (const [i, raw] of learning.cards.entries()) {
  assert.ok(learning.config[raw.sourceEn], `Card ${i + 1} has no matching original`);
  const c = learning.related(raw, i);
  assert.equal(c.words.length, 5);
  assert.ok(c.en && c.ko && c.example && c.exampleKo && c.say && c.challenge && c.connection);
  assert.ok(!/have to (assuming|treating|waiting|filling)|learned that (stay|notice|leave)\b|\.\./.test(c.en + c.example));
}
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); res.end(); return;
  }
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
const tabs = ['home', 'diary', 'garden', 'story', 'english', 'letter', 'book'];
const storageKey = 'annes-happiness-garden-v1';
let browser;
async function inspectLayout(page, label) {
  const issues = await page.evaluate(() => {
    const list = [];
    for (const el of document.querySelectorAll('button,input,textarea,select')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || !el.checkVisibility()) continue;
      if (r.left < -1 || r.right > innerWidth + 1) list.push(`${el.id || el.className}: outside viewport`);
    }
    const buttons = [...document.querySelectorAll('.tabbar .tab-btn')];
    for (let i = 0; i < buttons.length; i++) {
      const a = buttons[i].getBoundingClientRect();
      if (buttons[i].scrollWidth > buttons[i].clientWidth + 1) list.push(`Tab text clipped: ${buttons[i].innerText}`);
      for (let j = i + 1; j < buttons.length; j++) {
        const b = buttons[j].getBoundingClientRect();
        if (Math.min(a.right,b.right)-Math.max(a.left,b.left)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1) list.push('Tabs overlap');
      }
    }
    if (document.documentElement.scrollWidth > innerWidth) list.push('Document overflows');
    return list;
  });
  assert.deepEqual(issues, [], label);
}
async function tab(page, id) {
  await page.locator('.tabbar [data-tab=' + id + ']').click();
  await page.waitForTimeout(30);
  assert.equal(await page.locator('#' + id).evaluate(el => el.classList.contains('active')), true);
}
async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + server.address().port;
  const type = process.env.TEST_BROWSER === 'webkit' ? webkit : chromium;
  const opts = { headless: true };
  if (type === chromium) {
    opts.args = ['--no-sandbox'];
    const executable = process.env.CHROMIUM_PATH || '/usr/bin/chromium';
    if (fs.existsSync(executable)) opts.executablePath = executable;
  }
  browser = await type.launch(opts);
  let layouts = 0;
  for (const [width,height] of [[320,720],[360,800],[390,844],[430,932],[768,1024],[820,1180],[844,390],[1180,820],[1440,1000]]) {
    const context = await browser.newContext({ viewport: {width,height}, reducedMotion:'reduce' });
    const page = await context.newPage(); const errors = []; const badRequests = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => {if(r.status()>=400 && !r.url().endsWith('favicon.ico')) badRequests.push(r.url());});
    await page.goto(url); await page.evaluate(() => document.fonts.ready);
    for (const id of tabs) {
      await tab(page,id); await inspectLayout(page,`${width}x${height} ${id}`); layouts++;
      // Decode all images in the active tab; full-page screenshots alone do not load lazy images.
      const broken = await page.locator('#'+id).evaluate(async section => {
        const images = [...section.querySelectorAll('img[src]')];
        return (await Promise.all(images.map(async img => {img.loading='eager'; try{await img.decode();return null}catch{return img.getAttribute('src')}}))).filter(Boolean);
      });
      assert.deepEqual(broken,[],`${width} ${id} broken images`);
    }
    assert.equal(await page.locator('#moods button').count(),7);
    assert.deepEqual(errors,[],`Runtime errors ${width}`);
    assert.deepEqual(badRequests,[],`Network errors ${width}`);
    await context.close();
  }
  console.log(`PASS ${layouts} tab/viewport combinations: bounds, tab text, overlap, artwork, runtime errors`);
  const context = await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(url);
  await tab(page,'diary');await page.locator('[data-mood=sad]').click();
  assert.equal(await page.locator('[data-mood=sad]').getAttribute('aria-pressed'),'true');
  await page.locator('#diaryText').fill('비가 와도 보리와 산책해서 기뻤어. '+'희망'.repeat(120));
  const beforeSeeds=Number(await page.locator('#seeds').innerText());
  await page.locator('#saveDiary').click();
  assert.equal(Number(await page.locator('#seeds').innerText()),beforeSeeds+3);
  await tab(page,'garden');await page.locator('[data-garden-slot="7"]').click();
  await page.locator('[data-plant="2"]').click();await page.locator('#plant').click();
  let saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),storageKey);
  assert.equal(saved.flowers.length,1);assert.equal(saved.flowers[0].gardenSlot,7);assert.equal(saved.seeds,beforeSeeds);
  await page.locator('[data-flower="0"]').click();assert.ok((await page.locator('#gardenDetail').innerText()).includes('보리와 산책'));
  await page.locator('#waterGarden').click();
  await tab(page,'story');await page.locator('#storySelect').selectOption('6');
  const sceneBefore=await page.locator('#storyBg').getAttribute('src');await page.locator('[data-choice="2"]').click();
  assert.notEqual(await page.locator('#storyBg').getAttribute('src'),sceneBefore);
  assert.ok((await page.locator('.story-result').innerText()).includes('꽃길 지도'));
  await tab(page,'letter');const future='2099-12-31';
  await page.locator('#letterDate').fill(future);await page.locator('#letterText').fill('미래의 비밀 편지 내용');await page.locator('#saveLetter').click();
  assert.ok(!(await page.locator('#letterList').innerText()).includes('미래의 비밀 편지 내용'));
  await tab(page,'english');assert.ok(await page.locator('#englishSentence mark').count()>0);assert.equal(await page.locator('#englishWords .english-word').count(),5);
  await page.locator('#englishWritingInput').fill('I can take one small step with hope.');await page.locator('#englishWritingSave').click();
  await page.locator('#englishSpokenDone').click();await page.locator('#englishDone').click();
  const rewardedSeeds=Number(await page.locator('#seeds').innerText());await page.locator('#englishDone').click();
  assert.equal(Number(await page.locator('#seeds').innerText()),rewardedSeeds,'English daily reward must not duplicate');
  await tab(page,'book');
  assert.equal(await page.locator('.memory').count(),5);
  await page.locator('[data-book-filter=letter]').click();assert.equal(await page.locator('.memory').count(),1);
  assert.ok(!(await page.locator('#bookPages').innerText()).includes('미래의 비밀 편지 내용'));
  for(const kind of ['diary','flower','story','english']){await page.locator('[data-book-filter='+kind+']').click();assert.equal(await page.locator('.memory').count(),1);}
  const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;
  const backup=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(backup.data.flowers.length,1);assert.equal(backup.data.letters[0].text,'미래의 비밀 편지 내용');
  await page.reload();await tab(page,'diary');assert.ok((await page.locator('#diaryList').innerText()).includes('보리와 산책'));
  await tab(page,'garden');assert.equal(await page.locator('[data-flower]').count(),1);
  await tab(page,'home');await page.locator('#quoteMissionDone').click();await tab(page,'book');await page.locator('[data-book-filter=quote]').click();assert.equal(await page.locator('.memory').count(),1);
  await tab(page,'home');await page.locator('#quoteReply').fill('오늘의 상상은 내일의 작은 용기가 돼.');await page.locator('#saveQuoteReply').click();await tab(page,'book');await page.locator('[data-book-filter=quote]').click();assert.equal(await page.locator('.memory').count(),1);assert.ok((await page.locator('#bookPages').innerText()).includes('내일의 작은 용기'));
  // Compatibility: existing records survive migration and more than ten flowers remain accessible.
  await page.evaluate(key=>{const d=JSON.parse(localStorage.getItem(key));d.flowers=Array.from({length:23},(_,i)=>({id:i,date:'2026. 10. 1.',name:'기존 꽃 '+i,img:'images/plants/daisy_pot.png',memory:'오래된 기록 '+i}));d.seeds=6;localStorage.setItem(key,JSON.stringify(d));},storageKey);
  await page.reload();await tab(page,'garden');assert.ok((await page.locator('#gardenPageLabel').innerText()).includes('3번째'));
  await page.locator('#gardenPrev').click();assert.equal(await page.locator('[data-flower]').count(),10);
  await page.locator('#gardenPrev').click();assert.equal(await page.locator('[data-flower]').count(),10);
  await page.locator('#plant').click();assert.ok((await page.locator('#gardenPageLabel').innerText()).includes('4번째'));
  saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),storageKey);assert.equal(saved.flowers.length,24);
  assert.equal(saved.flowers[0].memory,'오래된 기록 0');
  await tab(page,'book');await page.locator('[data-book-filter=flower]').click();assert.equal(await page.locator('.memory').count(),12);
  await page.locator('#bookMore').click();assert.equal(await page.locator('.memory').count(),24);
  assert.deepEqual(errors,[]);await context.close();
  console.log('PASS diary reward, explicit planting slot, watering, adventure scene/reward, sealed letters, English saving/reward, all archive filters, export, persistence, legacy 23-flower migration/pagination');
  console.log('PASS all 500 English cards retain original connections and five words');
}
main().then(()=>{process.exitCode=0}).catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();server.close()});
