'use strict';
(() => {
  const { plants, cardCount, englishCard } = window.GardenContent;
  const KEY = 'annes-happiness-garden-v1';
  const pageIds = ['home', 'diary', 'garden', 'letter', 'english'];
  const $ = id => document.getElementById(id);
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const imagePath = (value, fallback = 'images/plants/daisy_pot.png') => /^images\/[a-zA-Z0-9_/-]+\.(png|webp|jpg)$/.test(String(value)) && !String(value).includes('..') ? value : fallback;
  const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const humanDate = (date = new Date()) => date.toLocaleDateString('ko-KR');
  const dayNumber = () => { const d = new Date(); return Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/86400000); };
  const dateLabel = value => { const m = String(value || '').match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/); return m ? `${m[1]}.${m[2].padStart(2,'0')}.${m[3].padStart(2,'0')}` : String(value || '간직한 날'); };
  const moods = [
    { id:'happy', name:'행복', weather:'마음에 햇살이 머문 날' }, { id:'calm', name:'평온', weather:'마음에 잔잔한 바람이 부는 날' },
    { id:'ordinary', name:'보통', weather:'평범해서 소중한 하루' }, { id:'sad', name:'속상', weather:'잠깐 비가 와도 괜찮은 날' },
    { id:'upset', name:'화남', weather:'마음의 바람이 쉬어가는 날' }, { id:'tired', name:'지침', weather:'그늘 아래 잠시 쉬어가는 날' },
    { id:'flutter', name:'설렘', weather:'새로운 꽃망울이 맺히는 날' }
  ];
  const legacyMoods = { '😊':'happy', '😌':'calm', '😐':'ordinary', '😢':'sad', '😠':'upset', '🥱':'tired', '🥰':'flutter' };
  const moodFor = value => moods.find(m => m.id === value || m.name === value || m.id === legacyMoods[value]) || moods[2];
  const defaults = { seeds:0, activities:0, diaries:[], flowers:[], letters:[], decorItems:[], watered:0, englishCardIndex:0, englishWriting:{}, englishCompletedCards:[], englishSpokenCards:[], englishDailyRewardDate:'' };
  let data, rawStorage = '', storageBroken = false;
  try {
    rawStorage = localStorage.getItem(KEY) || '';
    const parsed = rawStorage ? JSON.parse(rawStorage) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('Invalid data');
    data = { ...defaults, ...parsed };
    // Preserve unrecognized and retired fields so every existing record remains in a backup.
    for (const key of ['diaries','flowers','letters','decorItems','englishCompletedCards','englishSpokenCards']) {
      if (!Array.isArray(data[key])) throw Error('Invalid records');
    }
    if (!data.englishWriting || typeof data.englishWriting !== 'object' || Array.isArray(data.englishWriting)) throw Error('Invalid English records');
  } catch {
    data = { ...defaults };
    storageBroken = true;
    $('storageNotice').hidden = false;
    $('storageNotice').textContent = '보관된 기록을 읽지 못했어요. 원본을 덮어쓰지 않도록 저장을 잠시 멈췄어요. 아래 ‘내 기록 백업하기’로 원본을 먼저 간직해주세요.';
  }
  const numeric = value => Math.max(0, Number(value) || 0);
  const cardIndex = () => Math.max(0, Math.min(cardCount-1, Math.floor(Number(data.englishCardIndex)||0)));
  let mood = 'happy', currentPage = 'home', diaryLimit = 6, letterLimit = 6, savedEnglishLimit = 5, letterFilter = 'all';
  let gardenPage = -1, chosenSlot = null, selectedPlant = 0, planting = false, toastTimer, speakingButton = null;
  const englishDrafts = new Map();
  const plotAnchors = [[19,57],[75,57],[11,74],[32,73],[65,74],[87,74],[12,95],[34,94],[64,94],[88,95]];
  const props = [
    {name:'작은 벤치',img:'images/objects/garden_bench_daffodil.png',x:61,y:33,w:26,h:20},
    {name:'꽃 자전거',img:'images/objects/vintage_flower_bicycle.png',x:8,y:27,w:26,h:25},
    {name:'빨간 우체통',img:'images/objects/red_mailbox.png',x:82,y:26,w:13,h:23},
    {name:'피크닉 바구니',img:'images/objects/picnic_basket_books_flowers.png',x:39,y:68,w:15,h:16},
    {name:'정원 이름표',img:'images/objects/wood_sign_cafe_garden.png',x:4,y:30,w:16,h:20},
    {name:'장미 아치',img:'images/decor/rose_trellis.png',x:47,y:9,w:19,h:31}
  ];
  function toast(message) {
    clearTimeout(toastTimer); $('rewardToast').textContent = message; $('rewardToast').hidden = false;
    toastTimer = setTimeout(() => { $('rewardToast').hidden = true; }, 4300);
  }
  function commit(change, message) {
    if (storageBroken) { toast('원본 기록을 보호하고 있어요. 먼저 기록을 백업해주세요.'); return false; }
    const next = JSON.parse(JSON.stringify(data));
    change(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); }
    catch { $('storageNotice').hidden = false; $('storageNotice').textContent = '지금은 기록을 저장하지 못했어요. 입력한 마음은 그대로 두었어요. 저장 공간과 브라우저 설정을 확인하고, 기존 기록은 아래에서 백업해주세요.'; toast('저장하지 못했어요. 입력한 내용을 지우지 않았어요.'); return false; }
    data = next; rawStorage = JSON.stringify(data); $('storageNotice').hidden = true;
    renderAll(); if (message) toast(message); return true;
  }
  function navigate(id, push = true, focus = true) {
    if (!pageIds.includes(id)) id = 'home';
    if (currentPage === 'english' && id !== 'english') stopSpeaking();
    currentPage = id;
    pageIds.forEach(name => { $(name).hidden = name !== id; $(name).classList.toggle('active',name === id); });
    document.querySelectorAll('[data-tab]').forEach(b => { const on = b.dataset.tab === id; b.classList.toggle('active',on); if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current'); });
    if (push && location.hash !== '#'+id) history.pushState({page:id},'', '#'+id);
    if (id === 'letter') { $('letterDate').min = localDate(); renderLetters(); }
    renderHome();
    if (focus) { $(id+'Title').focus({preventScroll:true}); window.scrollTo({top:0,behavior:'instant'}); }
  }
  function renderHome() {
    $('seeds').textContent = numeric(data.seeds);
    $('homeDate').textContent = new Date().toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'long'});
    const daily = englishCard(dayNumber()%cardCount);
    $('homeQuoteKo').textContent = '“'+daily.sourceKo+'”'; $('homeQuoteEn').textContent = daily.sourceEn; $('homeQuoteReflection').textContent = daily.mindset;
    const todays = data.diaries.filter(d => d.dateISO === localDate() || d.date === humanDate());
    const latest = todays[0];
    $('homeMoodWeather').textContent = latest ? moodFor(latest.moodLabel || latest.mood).weather : '오늘 마음에는 어떤 날씨가 머물렀나요?';
    $('homeDiaryTitle').textContent = latest ? moodFor(latest.moodLabel || latest.mood).name+'의 마음을 남겼어요' : '아직 펼치지 않은 한 페이지';
    $('homeDiaryPreview').textContent = latest ? String(latest.text).slice(0,65)+(String(latest.text).length>65?'…':'') : '지금의 마음을 조용히 들려주세요.';
    const flowersToday = data.flowers.filter(f => f.dateISO === localDate() || f.date === humanDate());
    $('homeGardenTitle').textContent = flowersToday.length ? '오늘, '+flowersToday.length+'송이의 기억이 피었어요' : data.flowers.length ? '지금까지 '+data.flowers.length+'송이의 작은 기쁨' : '첫 꽃을 기다리는 정원';
    $('homeGardenPreview').textContent = data.flowers.length ? '가장 최근에 심은 꽃은 '+String(data.flowers[data.flowers.length-1].name)+'예요.' : '마음 한 줄에서 작은 꽃이 시작돼요.';
    const arrived = data.letters.filter(l => l.date <= localDate()), waiting = data.letters.filter(l => l.date > localDate());
    $('homeLetterTitle').textContent = arrived.length ? '도착한 마음이 '+arrived.length+'통 있어요' : waiting.length ? '나에게 오는 편지 '+waiting.length+'통' : '미래의 나를 위한 자리';
    $('homeLetterPreview').textContent = waiting.length ? dateLabel(waiting.map(l=>l.date).sort()[0])+'에 다음 마음이 도착해요.' : arrived.length ? '약속한 날의 내가 되어 편지를 펼쳐봐요.' : '언젠가 다시 읽고 싶은 말을 남겨요.';
    $('companionMessage').textContent = data.pettedDate === localDate() ? '보리가 꼬리를 흔들어요. 오늘도 당신의 작은 기쁨을 함께 찾을게요.' : '보리는 오늘도 네 편이에요. 함께라면 평범한 하루도 조금 특별해져요.';
  }
  function renderMoods() {
    if (!$('moods').children.length) $('moods').innerHTML = moods.map((m,i)=>`<button type="button" class="mood-btn" data-mood="${m.id}" role="radio" aria-label="${m.name}" aria-checked="false" tabindex="-1"><span class="mood-portrait" aria-hidden="true" style="background-position:${(i%4)*100/3}% ${i<4?0:100}%"></span><span class="mood-label">${m.name}</span></button>`).join('');
    document.querySelectorAll('[data-mood]').forEach(b=>{const on=b.dataset.mood===mood;b.setAttribute('aria-checked',String(on));b.tabIndex=on?0:-1;});
  }
  function renderDiaries() {
    $('diaryTotal').textContent = data.diaries.length+'페이지';
    $('diaryList').innerHTML = data.diaries.length ? data.diaries.slice(0,diaryLimit).map(d=>`<article class="diary-entry"><header><b>${safe(moodFor(d.moodLabel||d.mood).name)}</b><span>${safe(dateLabel(d.dateISO||d.date))}</span></header><p>${safe(d.text)}</p></article>`).join('') : '<p class="empty-state">아직 남기지 않은 마음들이 기다리고 있어요.<br>오늘, 첫 페이지를 시작해볼까요?</p>';
    $('diaryMore').hidden = data.diaries.length <= diaryLimit;
  }
  function layoutFlowers() {
    const used = new Set();
    return data.flowers.map((f,index)=>{
      let page = Number.isInteger(f.gardenPage)&&f.gardenPage>=0 ? f.gardenPage : Math.floor(index/10);
      let slot = Number.isInteger(f.gardenSlot)&&f.gardenSlot>=0&&f.gardenSlot<10 ? f.gardenSlot : index%10;
      while(used.has(`${page}:${slot}`)){slot++;if(slot===10){slot=0;page++;}}
      used.add(`${page}:${slot}`);return {f,index,page,slot};
    });
  }
  function gardenPageCount(layout=layoutFlowers()) { return Math.max(1,...layout.map(x=>x.page+1)); }
  function lastGardenPage(layout=layoutFlowers()) { const last=gardenPageCount(layout)-1;return last+(layout.filter(x=>x.page===last).length===10?1:0); }
  function renderGarden() {
    const layout = layoutFlowers(); if(gardenPage<0)gardenPage=gardenPageCount(layout)-1;
    const current = layout.filter(x=>x.page===gardenPage);
    $('gardenScene').dataset.planting = String(planting);
    $('chooseSpot').setAttribute('aria-pressed',String(planting));
    $('chooseSpot').textContent = planting ? '자리 고르기 마치기 ✓' : '꽃 심을 자리 고르기 ＋';
    $('gardenItems').innerHTML = plotAnchors.map(([x,y],i)=>{
      const item=current.find(v=>v.slot===i),anchor=`--plot-x:${x}%;--plot-y:${y}%;z-index:${i+1}`;
      return item ? `<button type="button" class="garden-plant" data-flower="${item.index}" style="${anchor}" aria-label="${safe(item.f.name)} · 그날의 마음 보기"><img src="${safe(imagePath(item.f.img))}" alt="${safe(item.f.name)}" loading="lazy"></button>` : `<button type="button" class="plant-spot" data-garden-slot="${i}" style="${anchor}" aria-label="${i+1}번째 흙자리에 심기" aria-pressed="${chosenSlot===i}">+</button>`;
    }).join('');
    $('gardenCount').textContent = data.flowers.length ? '내 마음이 피운 꽃, '+data.flowers.length+'송이' : '첫 꽃을 기다리는 작은 정원';
    $('gardenPageLabel').textContent = `${gardenPage+1}번째 풍경 · ${current.length}송이`;
    $('gardenPrev').disabled = gardenPage===0; $('gardenNext').disabled = gardenPage>=lastGardenPage(layout);
    $('gardenGrowth').textContent = planting ? '마음에 드는 흙자리를 눌러주세요.' : '꽃을 누르면 그날의 기억을 만나요.';
    $('selectedSpotName').textContent = chosenSlot===null ? '자리는 정원에 맡기기' : `${gardenPage+1}번째 풍경 · ${chosenSlot+1}번째 흙자리`;
    $('gardenSeedHelp').textContent = numeric(data.seeds)<3 ? '지금 씨앗 '+numeric(data.seeds)+'개 · 감정일기 한 줄이면 꽃을 심을 수 있어요.' : '지금 씨앗 '+numeric(data.seeds)+'개 · 한 송이를 심으면 3개를 사용해요.';
    renderGardenDecor();
  }
  function renderPicker() {
    $('plantVarieties').textContent = plants.length+'가지 꽃';
    $('plantPicker').innerHTML = plants.map((p,i)=>`<button type="button" class="plant-choice" data-plant="${i}" aria-pressed="${i===selectedPlant}"><img src="${safe(p.img)}" alt="" loading="lazy"><span>${safe(p.name)}</span></button>`).join('');
    $('selectedPlantName').textContent = plants[selectedPlant].name;
  }
  function renderGardenDecor() {
    $('gardenDecorLayer').innerHTML = props.filter(p=>data.decorItems.includes(p.img)||data.decor===p.img).map(p=>`<img src="${p.img}" alt="${p.name}" style="left:${p.x}%;top:${p.y}%;width:${p.w}%;height:${p.h}%" loading="lazy">`).join('');
    $('decorGrid').innerHTML = props.map((p,i)=>`<button type="button" class="prop-choice" data-decor="${i}" aria-pressed="${data.decorItems.includes(p.img)||data.decor===p.img}"><img src="${p.img}" alt="" loading="lazy"><span>${p.name}</span></button>`).join('');
  }
  function renderLetters() {
    const today=localDate(),waiting=data.letters.filter(l=>l.date>today),arrived=data.letters.filter(l=>l.date<=today);
    $('letterTotal').textContent = data.letters.length+'통';
    $('letterArrival').textContent = waiting.length ? `다음 편지는 ${dateLabel(waiting.map(l=>l.date).sort()[0])}에 만나요. ${waiting.length}통의 마음이 오는 중이에요.` : arrived.length ? '약속한 날이 되었어요. 그때의 나를 천천히 만나보세요.' : '편지를 보내면 여기에 차곡차곡 모여요. 먼저 나에게 안부를 남겨볼까요?';
    const list=data.letters.filter(l=>letterFilter==='all'||(letterFilter==='waiting'?l.date>today:l.date<=today));
    $('letterList').innerHTML = list.length ? list.slice(0,letterLimit).map(l=>l.date>today ? `<article class="letter-entry"><div class="waiting-letter"><div><b>아직 봉인된 마음이에요</b><span class="letter-date">${safe(dateLabel(l.date))}에 다시 만나요</span></div><span class="letter-status">가는 중</span></div></article>` : `<details class="letter-entry arrived"><summary><span>그날의 내가 보낸 편지<span class="letter-date">${safe(dateLabel(l.date))}에 도착했어요</span></span><span class="letter-status">펼쳐보기</span></summary><p>${safe(l.text)}</p></details>`).join('') : '<p class="empty-state">이곳에 머무는 편지는 아직 없어요.<br>정한 날, 다정한 마음이 도착할 거예요.</p>';
    $('letterMore').hidden = list.length<=letterLimit;
    document.querySelectorAll('[data-letter-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.letterFilter===letterFilter)));
  }
  function highlight(text,phrases) {
    const terms=phrases.map(p=>p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).sort((a,b)=>b.length-a.length);
    const regex=new RegExp('\\b('+terms.join('|')+')\\b','gi');let html='',last=0;
    for(const m of String(text).matchAll(regex)){html+=safe(String(text).slice(last,m.index))+'<mark class="english-key-mark">'+safe(m[0])+'</mark>';last=m.index+m[0].length;}
    return html+safe(String(text).slice(last));
  }
  function renderEnglish() {
    const idx=cardIndex(),c=englishCard(idx),completed=data.englishCompletedCards.includes(idx);
    $('englishCounter').textContent = `${idx+1} / ${cardCount}`;
    $('englishSourceSentence').textContent = '“'+c.sourceEn+'”'; $('englishSourceTranslation').textContent = c.sourceKo;
    $('englishMindset').textContent = c.mindset; $('englishConnection').textContent = c.connection;
    $('englishSentence').innerHTML = highlight(c.en,c.keyPhrases); $('englishTranslation').textContent = c.ko;
    $('englishKeyPhraseChips').innerHTML = c.keyPhrases.map(p=>'<span>'+safe(p)+'</span>').join('');
    $('englishPattern').textContent = c.pattern; $('englishPatternKo').textContent = c.patternKo;
    $('englishWords').innerHTML = c.words.map(([word,ko])=>`<div class="english-word"><b lang="en">${safe(word)}</b><span>${safe(ko)}</span></div>`).join('');
    $('englishExample').innerHTML = highlight(c.example,c.keyPhrases); $('englishExampleKo').textContent = c.exampleKo; $('englishSay').textContent = c.say; $('englishChallenge').textContent = c.challenge;
    const val=englishDrafts.has(idx)?englishDrafts.get(idx):(data.englishWriting[String(idx)]||'');
    if($('englishWritingInput').value!==val)$('englishWritingInput').value=val;
    const saved=data.englishWriting[String(idx)]||'';
    $('englishWritingNote').textContent = val!==saved ? '아직 간직하지 않은 문장이 있어요.' : saved ? '이 문장은 아래 ‘간직한 나의 영어 문장’에 있어요.' : '완벽한 문장보다, 직접 써본 한 줄이 소중해요.';
    const count=new Set(data.englishCompletedCards.filter(x=>Number.isInteger(x)&&x>=0&&x<cardCount)).size;
    $('englishProgressBar').style.width = count/cardCount*100+'%'; $('englishProgressText').textContent = `완료 ${count} / ${cardCount}`;
    $('englishProgress').setAttribute('aria-valuenow',count);
    $('englishDone').textContent = completed ? '이미 간직한 한 입이에요 ✓' : '오늘의 한 입 마치기 ✓';
    $('englishDoneNote').textContent = data.englishDailyRewardDate===localDate() ? '오늘의 씨앗은 받았어요. 남은 문장은 천천히 만나도 좋아요.' : '하루 첫 마무리에는 씨앗 한 개를 드려요.';
    const spoken=data.englishSpokenCards.includes(idx); $('englishSpokenDone').setAttribute('aria-pressed',String(spoken)); $('englishSpokenDone').textContent = spoken ? '소리 내어 읽었어요 ✓' : '소리 내어 한 번 읽었어요 ✓';
    renderSavedEnglish();
  }
  function renderSavedEnglish() {
    const entries=Object.entries(data.englishWriting).filter(([i,t])=>Number.isInteger(Number(i))&&Number(i)>=0&&Number(i)<cardCount&&String(t).trim()).reverse();
    $('englishSavedCount').textContent = entries.length+'문장';
    $('englishSavedList').innerHTML = entries.length ? entries.slice(0,savedEnglishLimit).map(([i,t])=>`<article class="saved-sentence"><p lang="en">${safe(t)}</p><button type="button" class="text-button" data-english-card="${Number(i)}">${Number(i)+1}번째 원문 다시 펼치기 ↗</button></article>`).join('') : '<p class="empty-state">직접 쓴 한 줄이 이곳에 남아요.<br>완벽하지 않아도, 나의 문장이니까 소중해요.</p>';
    $('englishSavedMore').hidden = entries.length<=savedEnglishLimit;
  }
  function setEnglishIndex(index) {
    stopSpeaking();
    const next=((index%cardCount)+cardCount)%cardCount;
    if(commit(d=>{d.englishCardIndex=next;}))$('englishStudyCard').scrollIntoView({block:'start',behavior:'instant'});
  }
  function stopSpeaking() {
    if('speechSynthesis' in window)window.speechSynthesis.cancel();
    if(speakingButton){speakingButton.setAttribute('aria-pressed','false');speakingButton=null;}
  }
  function speak(mode,button,rate=.9) {
    if(!('speechSynthesis' in window)||!('SpeechSynthesisUtterance' in window)){toast('이 브라우저에서는 듣기가 지원되지 않아요. 문장을 소리 내어 읽어볼까요?');return;}
    if(speakingButton===button){stopSpeaking();return;}stopSpeaking();
    const c=englishCard(cardIndex()),utterance=new SpeechSynthesisUtterance(mode==='source'?c.sourceEn:c.en);
    utterance.lang='en-US';utterance.rate=rate;
    const voice=window.speechSynthesis.getVoices().find(v=>/^en[-_]/i.test(v.lang));if(voice)utterance.voice=voice;
    speakingButton=button;button.setAttribute('aria-pressed','true');
    utterance.onend=()=>{button.setAttribute('aria-pressed','false');if(speakingButton===button)speakingButton=null;};
    utterance.onerror=e=>{utterance.onend();if(e.error!=='canceled'&&e.error!=='interrupted')toast('영어 음성을 재생하지 못했어요. 기기의 영어 음성 설정을 확인해주세요.');};
    window.speechSynthesis.speak(utterance);
  }
  function renderAll() { renderHome();renderMoods();renderDiaries();renderGarden();renderPicker();renderLetters();renderEnglish(); }
  function sayHello() { commit(d=>{d.pettedDate=localDate();},'보리가 꼬리를 흔들어요. 오늘도 함께, 천천히 걸어요. 🐾'); }
  document.addEventListener('click',e=>{
    const go=e.target.closest('[data-go],[data-tab]');if(go){e.preventDefault();navigate(go.dataset.go||go.dataset.tab);return;}
    const m=e.target.closest('[data-mood]');if(m){mood=m.dataset.mood;renderMoods();return;}
    const p=e.target.closest('[data-plant]');if(p){selectedPlant=Number(p.dataset.plant);renderPicker();planting=true;renderGarden();return;}
    const slot=e.target.closest('[data-garden-slot]');if(slot){chosenSlot=Number(slot.dataset.gardenSlot);renderGarden();toast('이 자리에 '+plants[selectedPlant].name+'를 심을게요. 아래에서 ‘이 꽃 심기’를 눌러주세요.');return;}
    const flower=e.target.closest('[data-flower]');if(flower){const f=data.flowers[Number(flower.dataset.flower)];$('gardenDetail').hidden=false;$('gardenDetail').innerHTML=`<div><b>${safe(f.name)}</b><p>${safe(dateLabel(f.dateISO||f.date))}에 심은 마음</p><p>${safe(f.memory||'오늘 심은 작은 희망')}</p></div><button type="button" class="icon-button" id="closeGardenDetail" aria-label="꽃의 기억 닫기">×</button>`;return;}
    if(e.target.closest('#closeGardenDetail')){$('gardenDetail').hidden=true;return;}
    const prop=e.target.closest('[data-decor]');if(prop){const selected=props[Number(prop.dataset.decor)];commit(d=>{const i=d.decorItems.indexOf(selected.img);if(i>=0)d.decorItems.splice(i,1);else if(d.decor!==selected.img)d.decorItems.push(selected.img);if(d.decor===selected.img)d.decor=null;},'마음에 드는 자리에서 정원의 풍경이 되었어요.');return;}
    const filter=e.target.closest('[data-letter-filter]');if(filter){letterFilter=filter.dataset.letterFilter;letterLimit=6;renderLetters();return;}
    const card=e.target.closest('[data-english-card]');if(card){setEnglishIndex(Number(card.dataset.englishCard));return;}
  });
  $('moods').addEventListener('keydown',e=>{
    const keys=['ArrowRight','ArrowLeft','ArrowUp','ArrowDown','Home','End'];if(!keys.includes(e.key))return;e.preventDefault();
    const i=moods.findIndex(m=>m.id===mood),next=e.key==='Home'?0:e.key==='End'?6:(i+(e.key==='ArrowRight'||e.key==='ArrowDown'?1:-1)+7)%7;
    mood=moods[next].id;renderMoods();$('moods').querySelector(`[data-mood="${mood}"]`).focus();
  });
  $('diaryText').addEventListener('input',()=>{$('diaryCount').textContent=$('diaryText').value.length+' / 3000';});
  $('diaryForm').addEventListener('submit',e=>{
    e.preventDefault();const text=$('diaryText').value.trim();if(!text){toast('지금의 마음 한 줄을 적어주세요.');$('diaryText').focus();return;}
    const name=moodFor(mood).name;
    if(commit(d=>{d.diaries.unshift({id:Date.now(),date:humanDate(),dateISO:localDate(),mood,moodLabel:name,text});d.seeds=numeric(d.seeds)+3;d.activities=numeric(d.activities)+1;},'마음 한 줄이 씨앗이 되었어요. 씨앗 3개를 간직했어요. 🌱')){
      $('diaryText').value='';$('diaryCount').textContent='0 / 3000';$('diaryReply').textContent=name+'의 마음을 다정히 남겼어요. 꽃 한 송이로 오늘을 기억해볼까요?';
    }
  });
  $('diaryMore').addEventListener('click',()=>{diaryLimit+=6;renderDiaries();});
  $('chooseSpot').addEventListener('click',()=>{planting=!planting;renderGarden();});
  $('plantPickerToggle').addEventListener('click',()=>{const expanded=$('plantPicker').dataset.expanded!=='true';$('plantPicker').dataset.expanded=String(expanded);$('plantPickerToggle').setAttribute('aria-expanded',String(expanded));$('plantPickerToggle').textContent=expanded?'꽃 목록 조용히 접기 ↑':'다른 꽃도 만나보기 ↓';});
  $('plant').addEventListener('click',()=>{
    if(numeric(data.seeds)<3){toast('감정일기 한 줄을 남기면 꽃을 심을 씨앗 3개를 받아요.');$('gardenSeedHelp').innerHTML='꽃을 심을 씨앗이 조금 더 필요해요. <button type="button" class="text-button" data-go="diary">마음 남기러 가기 ↗</button>';return;}
    const layout=layoutFlowers(),occupied=new Set(layout.filter(x=>x.page===gardenPage).map(x=>x.slot));
    let slot=chosenSlot,page=gardenPage;
    if(slot===null||occupied.has(slot))slot=Array.from({length:10},(_,i)=>i).find(i=>!occupied.has(i));
    if(slot===undefined){page=gardenPageCount(layout);slot=0;}
    const p=plants[selectedPlant];
    const ok=commit(d=>{d.seeds=numeric(d.seeds)-3;d.flowers.push({id:Date.now(),date:humanDate(),dateISO:localDate(),name:p.name,img:p.img,memory:d.diaries[0]?.text||'오늘 심은 작은 희망',gardenPage:page,gardenSlot:slot});d.activities=numeric(d.activities)+1;},p.name+' 한 송이가 오늘의 정원에 피었어요. ✿');
    if(ok){gardenPage=page;chosenSlot=null;planting=false;renderGarden();$('gardenScene').scrollIntoView({block:'center',behavior:'instant'});}
  });
  function turnGarden(delta){gardenPage=Math.max(0,Math.min(lastGardenPage(),gardenPage+delta));chosenSlot=null;$('gardenDetail').hidden=true;renderGarden();}
  $('gardenPrev').addEventListener('click',()=>turnGarden(-1));$('gardenNext').addEventListener('click',()=>turnGarden(1));
  $('waterGarden').addEventListener('click',()=>{
    if(!data.flowers.length){toast('먼저 작은 꽃 한 송이를 심어볼까요?');return;}
    if(commit(d=>{d.watered=numeric(d.watered)+1;d.lastWateredDate=localDate();},'흙에 물 한 모금, 마음에 쉬어갈 틈. 정원이 더 싱그러워졌어요.')){
      $('gardenScene').classList.remove('garden-ripple');void $('gardenScene').offsetWidth;$('gardenScene').classList.add('garden-ripple');
    }
  });
  $('petDog').addEventListener('click',sayHello);$('gardenPetDog').addEventListener('click',sayHello);
  $('letterForm').addEventListener('submit',e=>{
    e.preventDefault();const text=$('letterText').value.trim(),date=$('letterDate').value;
    if(!text||!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<localDate()){toast('편지 내용과 오늘 이후의 날짜를 확인해주세요.');return;}
    if(commit(d=>{d.letters.unshift({id:Date.now(),date,text,createdDate:localDate()});d.activities=numeric(d.activities)+1;},dateLabel(date)+'의 나에게, 마음을 다정히 보냈어요. 💌')){$('letterText').value='';}
  });
  $('letterMore').addEventListener('click',()=>{letterLimit+=6;renderLetters();});
  $('englishNext').addEventListener('click',()=>setEnglishIndex(cardIndex()+1));$('englishPrev').addEventListener('click',()=>setEnglishIndex(cardIndex()-1));
  $('englishRandom').addEventListener('click',()=>setEnglishIndex((cardIndex()+1+Math.floor(Math.random()*(cardCount-1)))%cardCount));
  $('homeEnglish').addEventListener('click',()=>{setEnglishIndex(dayNumber()%cardCount);navigate('english');});
  $('englishListen').addEventListener('click',e=>speak('source',e.currentTarget,.9));$('englishSlow').addEventListener('click',e=>speak('source',e.currentTarget,.62));$('englishApplyListen').addEventListener('click',e=>speak('application',e.currentTarget,.85));
  $('englishWritingInput').addEventListener('input',()=>{englishDrafts.set(cardIndex(),$('englishWritingInput').value);$('englishWritingNote').textContent='아직 간직하지 않은 문장이 있어요.';});
  $('englishWritingSave').addEventListener('click',()=>{
    const text=$('englishWritingInput').value.trim(),idx=cardIndex();if(!text){toast('내 하루를 담은 영어 한 줄을 적어주세요.');$('englishWritingInput').focus();return;}
    if(commit(d=>{d.englishWriting[String(idx)]=text;d.englishWritingDates={...(d.englishWritingDates||{}),[idx]:localDate()};},'완벽하지 않아도 소중한 나의 문장. 잘 간직했어요.')){englishDrafts.set(idx,text);renderEnglish();}
  });
  $('englishSpokenDone').addEventListener('click',()=>{const idx=cardIndex();commit(d=>{if(!d.englishSpokenCards.includes(idx))d.englishSpokenCards.push(idx);},'앤의 문장이 나의 목소리를 만났어요.');});
  $('englishDone').addEventListener('click',()=>{
    const idx=cardIndex(),text=$('englishWritingInput').value.trim(),reward=data.englishDailyRewardDate!==localDate();
    const ok=commit(d=>{if(!d.englishCompletedCards.includes(idx))d.englishCompletedCards.push(idx);d.englishCompletedDates={...(d.englishCompletedDates||{}),[idx]:localDate()};if(text){d.englishWriting[String(idx)]=text;d.englishWritingDates={...(d.englishWritingDates||{}),[idx]:localDate()};}if(reward){d.seeds=numeric(d.seeds)+1;d.englishDailyRewardDate=localDate();}},reward?'오늘의 작은 배움에 씨앗 한 개. 수고했어요. 🌱':'오늘의 한 입을 간직했어요. 이만큼이면 충분해요.');
    if(ok&&text){englishDrafts.set(idx,text);renderEnglish();}
  });
  $('englishSavedMore').addEventListener('click',()=>{savedEnglishLimit+=5;renderSavedEnglish();});
  $('export').addEventListener('click',()=>{
    const contents=storageBroken?rawStorage:JSON.stringify({app:'앤의 행복 정원',exportedAt:new Date().toISOString(),data},null,2);
    const blob=new Blob([contents],{type:storageBroken?'text/plain;charset=utf-8':'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`annes-happiness-garden-${localDate()}${storageBroken?'-original.txt':'.json'}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  window.addEventListener('popstate',()=>navigate(location.hash.slice(1),false));
  window.addEventListener('hashchange',()=>navigate(location.hash.slice(1),false));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){renderHome();renderLetters();$('letterDate').min=localDate();}});
  window.addEventListener('pagehide',stopSpeaking);
  function syncOffsets(){document.documentElement.style.setProperty('--header-height',document.querySelector('.site-header').getBoundingClientRect().height+'px');document.documentElement.style.setProperty('--nav-height',document.querySelector('.nav-wrap').getBoundingClientRect().height+'px');}
  if('ResizeObserver'in window){const observer=new ResizeObserver(syncOffsets);observer.observe(document.querySelector('.site-header'));observer.observe(document.querySelector('.nav-wrap'));}syncOffsets();
  const openDate=new Date();openDate.setDate(openDate.getDate()+7);$('letterDate').min=localDate();$('letterDate').value=localDate(openDate);
  renderAll();
  const initial=location.hash.slice(1);if(!pageIds.includes(initial))history.replaceState({page:'home'},'','#home');navigate(pageIds.includes(initial)?initial:'home',false,false);
})();
