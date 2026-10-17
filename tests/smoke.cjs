'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const { chromium, webkit } = require('playwright');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'assets/app.js'), 'utf8');
const content = fs.readFileSync(path.join(root, 'assets/content.js'), 'utf8');
new vm.Script(app); new vm.Script(content);
const sandbox = { window: {} }; vm.runInNewContext(content, sandbox);
const learning = sandbox.window.GardenContent;
assert.equal(learning.cardCount, 500);
for (let i = 0; i < 500; i++) {
  const c = learning.englishCard(i);
  assert.equal(c.words.length, 5);
  assert.ok(c.sourceEn && c.sourceKo && c.mindset && c.connection && c.en && c.ko && c.example && c.exampleKo);
  assert.ok(!/have to (assuming|treating|waiting|filling)|learned that (stay|notice|leave)\b|\.\./.test(c.en+c.example));
}
for (const asset of new Set((html+app+content).match(/images\/[A-Za-z0-9_.\/-]+\.(?:png|webp|jpg|svg)/g))) {
  assert.ok(fs.existsSync(path.join(root, asset)), `Missing artwork: ${asset}`);
}
assert.ok(!/data-(?:tab|go)="(?:book|story)"|나의\s*그림책|이야기\s*모험|보물상자|관리자/.test(html), 'Removed feature links or labels remain');
const tabs = ['home','diary','garden','letter','english'];
const KEY = 'annes-happiness-garden-v1';
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.png':'image/png', '.woff2':'font/woff2' };
const server = http.createServer((req,res)=>{
  const pathname = new URL(req.url,'http://localhost').pathname.replace(/^\/annes-happiness-garden(?=\/)/,'');
  const file = path.resolve(root,'.'+decodeURIComponent(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
let browser, base;
async function tab(page,id) {
  await page.locator('[data-tab='+id+']').click();
  assert.equal(await page.locator('#'+id).isVisible(),true);
  assert.equal(await page.locator('.tab-btn[aria-current=page]').count(),1);
}
async function layout(page,label) {
  const issues = await page.evaluate(()=>{
    const list=[];
    if(document.documentElement.scrollWidth>innerWidth+1)list.push('Horizontal document overflow');
    for(const el of document.querySelectorAll('button,input,textarea,summary')){
      if(!el.checkVisibility())continue;
      const r=el.getBoundingClientRect();
      if(r.width&&(r.left< -1||r.right>innerWidth+1))list.push((el.id||el.className)+' exceeds viewport');
    }
    const buttons=[...document.querySelectorAll('.tab-btn')];
    buttons.forEach((el,i)=>{const a=el.getBoundingClientRect();if(el.scrollWidth>el.clientWidth+1)list.push('Tab text clipped: '+el.textContent);for(const other of buttons.slice(i+1)){const b=other.getBoundingClientRect();if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)list.push('Tab overlap');}});
    return list;
  });
  assert.deepEqual(issues,[],label);
}
async function prepare(options={}) {
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',...options});
  const page=await context.newPage();page.setDefaultTimeout(10000);
  return {context,page};
}
async function stored(page) { return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY); }
async function main() {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
  const type=process.env.TEST_BROWSER==='webkit'?webkit:chromium,opts={headless:true};
  if(type===chromium){opts.args=['--no-sandbox'];const executable=process.env.CHROMIUM_PATH||'/usr/bin/chromium';if(fs.existsSync(executable))opts.executablePath=executable;}
  browser=await type.launch(opts);
  let layouts=0;
  for(const [width,height] of [[320,720],[360,800],[390,844],[430,932],[768,1024],[820,1180],[844,390],[1180,820],[1440,1000]]){
    const {context,page}=await prepare({viewport:{width,height}}),errors=[],bad=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)bad.push(r.url());});
    await page.goto(base);await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.locator('.tab-btn').count(),5);
    for(const id of tabs){
      await tab(page,id);await layout(page,width+'x'+height+' '+id);layouts++;
      const broken=await page.locator('#'+id).evaluate(async section=>(await Promise.all([...section.querySelectorAll('img[src]')].map(async img=>{img.loading='eager';try{await img.decode();return null}catch{return img.src}}))).filter(Boolean));
      assert.deepEqual(broken,[],width+' '+id+' artwork');
    }
    await page.locator('.english-example').evaluate(el=>{el.open=true});await page.locator('.saved-english details').evaluate(el=>{el.open=true});await layout(page,'English expanded '+width);
    await tab(page,'garden');await page.locator('#chooseSpot').click();await page.locator('#plantPickerToggle').click();await page.locator('.garden-props').evaluate(el=>{el.open=true});await layout(page,'Garden expanded '+width);
    assert.equal(await page.locator('[data-plant]:visible').count(),23);
    assert.deepEqual(errors,[],`Runtime errors ${width}`);assert.deepEqual(bad,[],`HTTP failures ${width}`);
    await context.close();
  }
  console.log(`PASS ${layouts} tab/viewport combinations: five menus, no removed links, bounds, tab overlap/clipping, artwork, expanded controls, runtime and HTTP errors`);
  const {context,page}=await prepare();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/annes-happiness-garden/');
  await tab(page,'diary');assert.equal(await page.locator('[data-mood]').count(),7);
  await page.locator('[data-mood=happy]').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('[data-mood=calm]').getAttribute('aria-checked'),'true');
  await page.locator('[data-mood=sad]').click();
  await page.locator('#diaryText').fill('보리와 산책하니 조금 가벼워졌어. '+'희망'.repeat(150));await page.locator('#saveDiary').click();
  assert.equal((await stored(page)).seeds,3);assert.equal((await stored(page)).diaries[0].mood,'sad');assert.ok((await page.locator('#diaryList').innerText()).includes('보리와 산책'));
  await tab(page,'home');assert.ok((await page.locator('#homeDiaryTitle').innerText()).includes('속상'));
  await tab(page,'garden');assert.equal(await page.locator('.plant-spot:visible').count(),0);
  await page.locator('#chooseSpot').click();await page.locator('[data-garden-slot="7"]').click();await page.locator('[data-plant="2"]').click();await page.locator('#plant').click();
  let data=await stored(page);assert.equal(data.seeds,0);assert.equal(data.flowers.length,1);assert.equal(data.flowers[0].gardenSlot,7);
  assert.equal(await page.locator('.plant-spot:visible').count(),0);
  await page.locator('[data-flower="0"]').click();assert.ok((await page.locator('#gardenDetail').innerText()).includes('보리와 산책'));
  await page.locator('#waterGarden').click();assert.equal((await stored(page)).watered,1);
  await page.locator('.garden-props').evaluate(el=>{el.open=true});await page.locator('[data-decor="0"]').click();
  assert.equal(await page.locator('#gardenDecorLayer img').count(),1);assert.equal((await stored(page)).seeds,0,'Decor has no new currency requirement');
  await tab(page,'letter');await page.locator('#letterText').fill('미래의 비밀 편지');await page.locator('#letterDate').fill('2099-12-31');await page.locator('#saveLetter').click();
  assert.ok(!(await page.locator('#letterList').innerText()).includes('미래의 비밀 편지'));assert.equal(await page.locator('#letterList details').count(),0);
  const today=await page.evaluate(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`});
  await page.locator('#letterText').fill('오늘의 나에게 고마워');await page.locator('#letterDate').fill(today);await page.locator('#saveLetter').click();
  await page.locator('[data-letter-filter=arrived]').click();assert.equal(await page.locator('#letterList details').count(),1);await page.locator('#letterList summary').click();assert.ok((await page.locator('#letterList').innerText()).includes('오늘의 나에게 고마워'));
  await page.locator('[data-letter-filter=waiting]').click();assert.equal(await page.locator('#letterList .letter-entry').count(),1);assert.ok(!(await page.locator('#letterList').innerText()).includes('미래의 비밀 편지'));
  await tab(page,'english');assert.equal(await page.locator('#englishWords .english-word').count(),5);assert.ok(await page.locator('#englishSentence mark').count()>0);
  await page.locator('#englishWritingInput').fill('I can take one small step with hope.');await page.locator('#englishWritingSave').click();
  assert.equal((await stored(page)).englishWriting['0'],'I can take one small step with hope.');
  await page.locator('#englishDone').click();assert.equal((await stored(page)).seeds,1);await page.locator('#englishDone').click();assert.equal((await stored(page)).seeds,1,'No repeated daily reward');
  await page.locator('#englishWritingInput').fill('An unfinished thought');await page.locator('#englishNext').click();await page.locator('#englishPrev').click();assert.equal(await page.locator('#englishWritingInput').inputValue(),'An unfinished thought','Card switching preserves unsaved writing');
  // Check the exact speech source and speed without pretending a cloud machine has iPhone audio hardware.
  await page.evaluate(()=>{window.testUtterances=[];window.SpeechSynthesisUtterance=function(text){this.text=text};Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{cancel(){},getVoices(){return[]},speak(u){window.testUtterances.push({text:u.text,rate:u.rate,lang:u.lang})}}});});
  await page.locator('#englishListen').click();await page.locator('#englishSlow').click();await page.locator('#englishApplyListen').click();
  const spoken=await page.evaluate(()=>window.testUtterances);assert.equal(spoken.length,3);assert.equal(spoken[0].text,spoken[1].text);assert.equal(spoken[1].rate,.62);assert.notEqual(spoken[0].text,spoken[2].text);
  await page.locator('#homeEnglish').evaluate(el=>el.click());assert.equal(await page.locator('#english').isVisible(),true);
  await tab(page,'home');await page.locator('#homeEnglish').click();assert.equal((await page.locator('#englishSourceSentence').innerText()).replace(/[“”]/g,''),await page.locator('#homeQuoteEn').innerText());
  const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;const backup=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(backup.data.letters.length,2);assert.equal(backup.data.letters[1].text,'미래의 비밀 편지');
  await page.reload();await tab(page,'diary');assert.ok((await page.locator('#diaryList').innerText()).includes('보리와 산책'));
  // Older records and retired feature data stay intact without restoring retired menus.
  await page.evaluate(key=>{const d=JSON.parse(localStorage.getItem(key));d.completedStories=[{title:'간직한 오래된 이야기',ending:'기록은 지워지지 않아요'}];d.adventureInventory=[{name:'오래된 보물'}];d.quoteCollected=[{key:'q12',index:12,date:'2026. 10. 1.'}];d.stars=17;d.customNote='그대로 보존';d.flowers=Array.from({length:23},(_,i)=>({id:i,date:'2026. 10. 1.',name:'기존 꽃 '+i,img:'images/plants/daisy_pot.png',memory:'오래된 기록 '+i}));d.seeds=6;localStorage.setItem(key,JSON.stringify(d));},KEY);
  await page.reload();await tab(page,'garden');assert.ok((await page.locator('#gardenPageLabel').innerText()).includes('3번째'));assert.equal(await page.locator('[data-flower]').count(),3);
  await page.locator('#gardenPrev').click();await page.locator('#gardenPrev').click();assert.equal(await page.locator('[data-flower]').count(),10);
  await page.locator('#plant').click();assert.ok((await page.locator('#gardenPageLabel').innerText()).includes('4번째'));
  data=await stored(page);assert.equal(data.flowers.length,24);assert.equal(data.flowers[0].memory,'오래된 기록 0');assert.equal(data.completedStories[0].ending,'기록은 지워지지 않아요');assert.equal(data.adventureInventory[0].name,'오래된 보물');assert.equal(data.quoteCollected[0].key,'q12');assert.equal(data.stars,17);assert.equal(data.customNote,'그대로 보존');
  await page.goto(base+'/#story');assert.equal(await page.locator('#home').isVisible(),true);assert.equal(await page.locator('[data-tab]').count(),5);
  assert.deepEqual(errors,[]);await context.close();
  console.log('PASS diary/mood keyboard, seeds, chosen planting slot, memory, watering, free decor, future/today letter filters, English drafts/speech sources/progress/reward, backup, refresh, subpath, legacy 23 flowers and retired-data preservation');
  // Storage failures must never destroy the draft or overwrite unreadable old records.
  const broken=await prepare();await broken.page.addInitScript(key=>localStorage.setItem(key,'{broken legacy raw'),KEY);await broken.page.goto(base);assert.equal(await broken.page.locator('#storageNotice').isVisible(),true);await tab(broken.page,'diary');await broken.page.locator('#diaryText').fill('사라지면 안 되는 마음');await broken.page.locator('#saveDiary').click();assert.equal(await broken.page.locator('#diaryText').inputValue(),'사라지면 안 되는 마음');assert.equal(await broken.page.evaluate(key=>localStorage.getItem(key),KEY),'{broken legacy raw');await broken.context.close();
  const quota=await prepare();await quota.page.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('quota','QuotaExceededError')}});await quota.page.goto(base);await tab(quota.page,'diary');await quota.page.locator('#diaryText').fill('저장 실패에도 남아야 하는 마음');await quota.page.locator('#saveDiary').click();assert.equal(await quota.page.locator('#diaryText').inputValue(),'저장 실패에도 남아야 하는 마음');assert.equal(await quota.page.locator('#seeds').innerText(),'0');await quota.context.close();
  console.log('PASS unreadable old storage and quota errors preserve original/draft; 500 connected English cards with five words');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();server.close();});
