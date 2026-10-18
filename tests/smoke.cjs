'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'assets/app.js'),'utf8'),content=fs.readFileSync(path.join(root,'assets/content.js'),'utf8'),scenesJS=fs.readFileSync(path.join(root,'assets/scenes.js'),'utf8');
new vm.Script(app);const sandbox={window:{}};vm.runInNewContext(content,sandbox);vm.runInNewContext(scenesJS,sandbox);
const learning=sandbox.window.GardenContent,scenes=sandbox.window.GardenScenes;
assert.equal(learning.cardCount,500);assert.equal(scenes.length,6);assert.equal(new Set(scenes.map(x=>x.id)).size,6);
for(let i=0;i<500;i++){const c=learning.englishCard(i);assert.equal(c.words.length,5);assert.ok(c.sourceEn&&c.sourceKo&&c.mindset&&c.connection&&c.en&&c.ko&&c.example&&c.exampleKo);assert.ok(!/have to (assuming|treating|waiting|filling)|learned that (stay|notice|leave)\b|\.\./.test(c.en+c.example));}
for(const file of new Set((html+app+content+scenesJS).match(/images\/[A-Za-z0-9_.\/-]+\.(?:png|webp|jpg|svg)/g))){assert.ok(fs.existsSync(path.join(root,file)),`Missing artwork ${file}`);}
assert.ok(!/data-(?:tab|go)="(?:book|story)"|나의\s*그림책|이야기\s*모험|id="(?:plant|chooseSpot|waterGarden|decorGrid|seeds)"/.test(html),'Retired planting or menu controls remain');
const tabs=['home','diary','english','letter','garden'],KEY='annes-happiness-garden-v1';
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname.replace(/^\/annes-happiness-garden(?=\/)/,'');const file=path.resolve(root,'.'+decodeURIComponent(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);});
let browser,base;
async function tab(page,id){await page.locator('[data-tab='+id+']').click();assert.equal(await page.locator('#'+id).isVisible(),true);assert.equal(await page.locator('.tab-btn[aria-current=page]').count(),1);}
async function layout(page,label){
 const issues=await page.evaluate(()=>{
  const found=[];if(document.documentElement.scrollWidth>innerWidth+1)found.push('Document overflows');
  for(const el of document.querySelectorAll('button,input,textarea,summary')){if(!el.checkVisibility())continue;const r=el.getBoundingClientRect();if(r.width&&(r.left< -1||r.right>innerWidth+1))found.push((el.id||el.className)+' exceeds viewport');}
  const buttons=[...document.querySelectorAll('.tab-btn')];buttons.forEach((el,i)=>{const a=el.getBoundingClientRect();if(el.scrollWidth>el.clientWidth+1)found.push('Tab text clipped: '+el.textContent);for(const other of buttons.slice(i+1)){const b=other.getBoundingClientRect();if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)found.push('Tabs overlap');}});
  return found;
 });assert.deepEqual(issues,[],label);
}
async function prepare(options={}){const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',...options});const page=await context.newPage();page.setDefaultTimeout(10000);return{context,page};}
async function stored(page){return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);}
async function main(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
 const type=process.env.TEST_BROWSER==='webkit'?webkit:chromium,opts={headless:true};if(type===chromium){opts.args=['--no-sandbox'];const file=process.env.CHROMIUM_PATH||'/usr/bin/chromium';if(fs.existsSync(file))opts.executablePath=file;}browser=await type.launch(opts);
 let combinations=0;
 for(const[width,height]of[[320,720],[360,800],[390,844],[430,932],[768,1024],[820,1180],[844,390],[1180,820],[1440,1000]]){
  const{context,page}=await prepare({viewport:{width,height}}),errors=[],bad=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)bad.push(r.url());});
  await page.goto(base);await page.evaluate(()=>document.fonts.ready);assert.equal(await page.locator('.tab-btn').count(),5);
  assert.deepEqual(await page.locator('.tab-btn').evaluateAll(els=>els.map(x=>x.dataset.tab)),tabs);
  for(const id of tabs){await tab(page,id);await layout(page,width+'x'+height+' '+id);combinations++;
   const broken=await page.locator('#'+id).evaluate(async section=>(await Promise.all([...section.querySelectorAll('img[src]')].map(async img=>{img.loading='eager';try{await img.decode();return null}catch{return img.src}}))).filter(Boolean));assert.deepEqual(broken,[],width+' '+id+' artwork');
   const anne=await page.locator('#'+id+' img[alt*="앤"]').evaluateAll(els=>els.some(el=>el.checkVisibility()));assert.equal(anne,true,'Anne illustration absent from '+id);
  }
  const sizes=await page.evaluate(()=>({body:parseFloat(getComputedStyle(document.body).fontSize),description:parseFloat(getComputedStyle(document.querySelector('.hero-description')).fontSize),textarea:parseFloat(getComputedStyle(document.getElementById('diaryText')).fontSize)}));assert.ok(sizes.body>=16&&sizes.description>=16&&sizes.textarea>=16,'Reading sizes too small');
  await tab(page,'diary');assert.equal(await page.locator('#moods').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),3);assert.equal(await page.locator('[data-mood]').count(),7);
  await tab(page,'garden');assert.equal(await page.locator('.scene-card').count(),6);assert.equal(await page.locator('.scene-card.is-open').count(),1);
  await page.locator('[data-scene="sunlit-window"]').click();assert.equal(await page.locator('#sceneDialog').evaluate(el=>el.open),true);await layout(page,'Locked dialog '+width);await page.keyboard.press('Escape');
  await page.locator('.scene-card[data-scene="first-greeting"]').click();await layout(page,'Open dialog '+width);await page.locator('#closeSceneDialog').click();
  await tab(page,'english');await page.locator('.saved-english details').evaluate(el=>{el.open=true});await layout(page,'Expanded English '+width);
  assert.deepEqual(errors,[],`Runtime errors ${width}`);assert.deepEqual(bad,[],`HTTP failures ${width}`);await context.close();
 }
 console.log(`PASS ${combinations} tab/viewport combinations: readable type, Anne in every tab, 3-column seven moods, bounds, tabs, artwork, dialogs and runtime errors`);
 const{context,page}=await prepare(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/annes-happiness-garden/');
 await tab(page,'garden');await page.locator('.scene-card[data-scene="sunlit-window"]').click();assert.ok((await page.locator('#sceneDialogRequirement').innerText()).includes('감정일기'));await page.locator('#sceneDialogAction').click();assert.equal(await page.locator('#diary').isVisible(),true);
 await page.locator('[data-mood=happy]').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('[data-mood=calm]').getAttribute('aria-checked'),'true');await page.locator('[data-mood=sad]').click();
 await page.locator('#diaryText').fill('보리와 산책하니 마음이 가벼워졌어. '+'희망'.repeat(120));await page.locator('#saveDiary').click();
 let data=await stored(page);assert.equal(data.diaries[0].mood,'sad');assert.ok(data.sceneUnlocks['sunlit-window']);assert.ok((await page.locator('#diaryReply').innerText()).includes('햇살을 읽는 창가'));
 await tab(page,'garden');assert.equal(await page.locator('.scene-card.is-open').count(),2);await page.locator('[data-scene-filter=open]').click();assert.equal(await page.locator('.scene-card').count(),2);await page.locator('.scene-card[data-scene="sunlit-window"]').click();assert.ok((await stored(page)).sceneViews.includes('sunlit-window'));await page.locator('#closeSceneDialog').click();
 await page.locator('[data-scene-filter=locked]').click();assert.equal(await page.locator('.scene-card').count(),4);
 await tab(page,'english');assert.equal(await page.locator('#englishWords .english-word').count(),5);assert.ok(await page.locator('#englishSentence mark').count()>0);
 await page.locator('#englishWritingInput').fill('I can take one small step with hope.');await page.locator('#englishWritingSave').click();assert.equal((await stored(page)).englishWriting['0'],'I can take one small step with hope.');
 await page.locator('#englishDone').click();data=await stored(page);assert.ok(data.sceneUnlocks['words-of-courage']);assert.equal(data.englishCompletedCards.length,1);const unlockTime=data.sceneUnlocks['words-of-courage'];await page.locator('#englishDone').click();assert.equal((await stored(page)).sceneUnlocks['words-of-courage'],unlockTime,'Unlock timestamp must not reset');assert.equal((await stored(page)).englishCompletedCards.length,1);
 await page.locator('#englishWritingInput').fill('An unfinished thought');await page.locator('#englishNext').click();await page.locator('#englishPrev').click();assert.equal(await page.locator('#englishWritingInput').inputValue(),'An unfinished thought');
 await page.evaluate(()=>{window.testUtterances=[];window.SpeechSynthesisUtterance=function(text){this.text=text};Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{cancel(){},getVoices(){return[]},speak(u){window.testUtterances.push({text:u.text,rate:u.rate,lang:u.lang})}}});});
 await page.locator('#englishListen').click();await page.locator('#englishSlow').click();await page.locator('#englishApplyListen').click();const speech=await page.evaluate(()=>window.testUtterances);assert.equal(speech.length,3);assert.equal(speech[0].text,speech[1].text);assert.equal(speech[1].rate,.62);assert.notEqual(speech[0].text,speech[2].text);
 await tab(page,'letter');await page.locator('#letterText').fill('未来의 비밀 편지 본문');await page.locator('#letterDate').fill('2099-12-31');await page.locator('#saveLetter').click();data=await stored(page);assert.ok(data.sceneUnlocks['postbox-promise']);assert.ok(data.sceneUnlocks['small-happy-days']);assert.ok(!(await page.locator('#letterList').innerText()).includes('비밀 편지 본문'));
 await tab(page,'garden');await page.locator('[data-scene-filter=all]').click();assert.equal(await page.locator('.scene-card.is-open').count(),5);assert.ok(!(await page.locator('#garden').innerText()).includes('비밀 편지 본문'));
 await tab(page,'diary');for(const text of ['오늘의 작은 햇살','내일도 궁금해']){await page.locator('#diaryText').fill(text);await page.locator('#saveDiary').click();}
 assert.ok((await stored(page)).sceneUnlocks['rainy-walk']);await tab(page,'garden');assert.equal(await page.locator('.scene-card.is-open').count(),6);await page.locator('[data-scene-filter=locked]').click();assert.equal(await page.locator('.scene-card').count(),0);assert.equal(await page.locator('.gallery-empty').count(),1);
 await page.locator('.gallery-empty [data-scene-filter=all]').click();await page.reload();await tab(page,'garden');assert.equal(await page.locator('.scene-card.is-open').count(),6);
 const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;const backup=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(backup.data.diaries.length,3);assert.equal(backup.data.letters[0].text,'未来의 비밀 편지 본문');assert.ok(backup.data.sceneUnlocks['rainy-walk']);
 // Earlier planting and retired-feature records are kept exactly; they do not restore live game controls.
 await page.evaluate(key=>{const d=JSON.parse(localStorage.getItem(key));delete d.sceneUnlocks;d.sceneViews=[];d.seeds=17;d.stars=4;d.decorItems=['images/objects/red_mailbox.png'];d.flowers=Array.from({length:23},(_,i)=>({id:i,date:'2026. 10. 1.',name:'기존 꽃 '+i,img:'images/plants/daisy_pot.png',memory:'기억 '+i}));d.completedStories=[{title:'예전 이야기'}];d.customNote='그대로 보존';localStorage.setItem(key,JSON.stringify(d));},KEY);
 await page.reload();await tab(page,'garden');assert.equal(await page.locator('.scene-card.is-open').count(),6,'Existing activities should open scenes without ledger');await page.locator('.scene-card[data-scene="sunlit-window"]').click();await page.locator('#closeSceneDialog').click();
 data=await stored(page);assert.equal(data.flowers.length,23);assert.equal(data.flowers[0].memory,'기억 0');assert.equal(data.seeds,17);assert.equal(data.stars,4);assert.equal(data.customNote,'그대로 보존');assert.equal(data.completedStories[0].title,'예전 이야기');
 await tab(page,'home');await page.locator('#homeEnglish').click();assert.equal((await page.locator('#englishSourceSentence').innerText()).replace(/[“”]/g,''),await page.locator('#homeQuoteEn').innerText());
 const today=await page.evaluate(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`});await tab(page,'letter');await page.locator('#letterText').fill('오늘의 나에게 고마워');await page.locator('#letterDate').fill(today);await page.locator('#saveLetter').click();await page.locator('[data-letter-filter=arrived]').click();await page.locator('#letterList summary').first().click();assert.ok((await page.locator('#letterList').innerText()).includes('오늘의 나에게 고마워'));
 await page.goto(base+'/#story');assert.equal(await page.locator('#home').isVisible(),true);assert.deepEqual(errors,[]);await context.close();
 console.log('PASS activity-to-scene rewards, all six unlocks, locked guidance, dialog/seen state, filters, repeated completion, drafts, speech inputs, letter sealing, reload, backup, legacy flowers and subpath');
 const broken=await prepare();await broken.page.addInitScript(key=>localStorage.setItem(key,'{broken old raw'),KEY);await broken.page.goto(base);assert.equal(await broken.page.locator('#storageNotice').isVisible(),true);await tab(broken.page,'diary');await broken.page.locator('#diaryText').fill('사라지면 안 되는 마음');await broken.page.locator('#saveDiary').click();assert.equal(await broken.page.locator('#diaryText').inputValue(),'사라지면 안 되는 마음');assert.equal(await broken.page.evaluate(key=>localStorage.getItem(key),KEY),'{broken old raw');await broken.context.close();
 const quota=await prepare();await quota.page.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('quota','QuotaExceededError')}});await quota.page.goto(base);await tab(quota.page,'diary');await quota.page.locator('#diaryText').fill('저장 실패에도 남아야 하는 마음');await quota.page.locator('#saveDiary').click();assert.equal(await quota.page.locator('#diaryText').inputValue(),'저장 실패에도 남아야 하는 마음');assert.equal(await quota.page.locator('#headerSceneCount').innerText(),'1 / 6');await quota.context.close();
 console.log('PASS corrupt/quota storage protects original, draft and unlock count; all 500 English cards have related content and five words');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();server.close();});
