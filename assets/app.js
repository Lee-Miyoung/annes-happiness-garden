'use strict';
(() => {
  const { cardCount, englishCard } = window.GardenContent;
  const KEY = 'annes-happiness-garden-v1';
  const pageIds = ['home', 'diary', 'english', 'letter', 'garden'];
  const scenes = window.GardenScenes;
  const $ = id => document.getElementById(id);
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
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
  const defaults = { diaries:[], letters:[], englishCardIndex:0, englishWriting:{}, englishCompletedCards:[], englishSpokenCards:[], sceneUnlocks:{}, sceneViews:[] };
  let data, rawStorage = '', storageBroken = false;
  try {
    rawStorage = localStorage.getItem(KEY) || '';
    const parsed = rawStorage ? JSON.parse(rawStorage) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('Invalid data');
    data = { ...defaults, ...parsed };
    // Preserve unrecognized and retired fields so every existing record remains in a backup.
    for (const key of ['diaries','letters','englishCompletedCards','englishSpokenCards']) {
      if (!Array.isArray(data[key])) throw Error('Invalid records');
    }
    if (!data.englishWriting || typeof data.englishWriting !== 'object' || Array.isArray(data.englishWriting)) throw Error('Invalid English records');
  } catch {
    data = { ...defaults };
    storageBroken = true;
    $('storageNotice').hidden = false;
    $('storageNotice').textContent = '보관된 기록을 읽지 못했어요. 원본을 덮어쓰지 않도록 저장을 잠시 멈췄어요. 아래 ‘내 기록 백업하기’로 원본을 먼저 간직해주세요.';
  }
  const cardIndex = () => Math.max(0, Math.min(cardCount-1, Math.floor(Number(data.englishCardIndex)||0)));
  let mood = 'happy', currentPage = 'home', diaryLimit = 6, letterLimit = 6, savedEnglishLimit = 5, letterFilter = 'all';
  let sceneFilter = 'all', toastTimer, speakingButton = null, openedSceneId = null;
  const englishDrafts = new Map();
  function activityStats(state=data) {
    const english = new Set(state.englishCompletedCards.map(Number).filter(i=>Number.isInteger(i)&&i>=0&&i<cardCount)).size;
    return {diaries:state.diaries.length,english,letters:state.letters.length};
  }
  function unlockedSceneIds(state=data) {
    const stats=activityStats(state),ledger=state.sceneUnlocks&&typeof state.sceneUnlocks==='object'?state.sceneUnlocks:{};
    return new Set(scenes.filter(scene=>ledger[scene.id]||Object.entries(scene.rule).every(([key,n])=>stats[key]>=n)).map(scene=>scene.id));
  }
  function retainUnlocks(state) {
    const ledger=state.sceneUnlocks&&typeof state.sceneUnlocks==='object'&&!Array.isArray(state.sceneUnlocks)?{...state.sceneUnlocks}:{};
    unlockedSceneIds(state).forEach(id=>{if(!ledger[id])ledger[id]=new Date().toISOString();});
    state.sceneUnlocks=ledger;
  }
  function todayActivities() {
    return {
      diary:data.diaries.some(d=>d.dateISO===localDate()||d.date===humanDate()),
      english:Object.values(data.englishCompletedDates||{}).includes(localDate())||data.englishDailyRewardDate===localDate(),
      letter:data.letters.some(l=>l.createdDate===localDate())
    };
  }
  function toast(message) {
    clearTimeout(toastTimer); $('rewardToast').textContent = message; $('rewardToast').hidden = false;
    toastTimer = setTimeout(() => { $('rewardToast').hidden = true; }, 4300);
  }
  function commit(change, message, kind=null) {
    if (storageBroken) { toast('원본 기록을 보호하고 있어요. 먼저 기록을 백업해주세요.'); return false; }
    const before=unlockedSceneIds();
    const next = JSON.parse(JSON.stringify(data));
    change(next);
    retainUnlocks(next);
    const newlyOpened=scenes.filter(scene=>!before.has(scene.id)&&unlockedSceneIds(next).has(scene.id));
    try { localStorage.setItem(KEY, JSON.stringify(next)); }
    catch { $('storageNotice').hidden = false; $('storageNotice').textContent = '지금은 기록을 저장하지 못했어요. 입력한 마음은 그대로 두었어요. 저장 공간과 브라우저 설정을 확인하고, 기존 기록은 아래에서 백업해주세요.'; toast('저장하지 못했어요. 입력한 내용을 지우지 않았어요.'); return false; }
    data = next; rawStorage = JSON.stringify(data); $('storageNotice').hidden = true;
    renderAll();
    if(message)toast(message+(newlyOpened.length?' 새 장면 '+newlyOpened.length+'개가 열렸어요.':''));
    if(kind){const target=$(({diary:'diaryReply',english:'englishUnlockNote',letter:'letterReply'})[kind]);if(target)target.innerHTML='<span>'+safe(newlyOpened.length?'새로 열린 장면 · '+newlyOpened.map(x=>x.title).join(' / '):'오늘의 작은 기록이 행복정원에 함께 쌓였어요.')+'</span><button type="button" class="text-button" data-go="garden">앤의 장면 만나러 가기 ↗</button>';}
    return true;
  }
  function navigate(id, push = true, focus = true) {
    if (!pageIds.includes(id)) id = 'home';
    if (currentPage === 'english' && id !== 'english') stopSpeaking();
    if($('sceneDialog').open)$('sceneDialog').close();
    currentPage = id;
    pageIds.forEach(name => { $(name).hidden = name !== id; $(name).classList.toggle('active',name === id); });
    document.querySelectorAll('[data-tab]').forEach(b => { const on = b.dataset.tab === id; b.classList.toggle('active',on); if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current'); });
    if (push && location.hash !== '#'+id) history.pushState({page:id},'', '#'+id);
    if (id === 'letter') { $('letterDate').min = localDate(); renderLetters(); }
    renderHome();
    if (focus) { $(id+'Title').focus({preventScroll:true}); window.scrollTo({top:0,behavior:'instant'}); }
  }
  function renderHome() {
    const opened=unlockedSceneIds();$('headerSceneCount').textContent=opened.size+' / '+scenes.length;
    $('homeDate').textContent = new Date().toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'long'});
    const daily = englishCard(dayNumber()%cardCount);
    $('homeQuoteKo').textContent = '“'+daily.sourceKo+'”'; $('homeQuoteEn').textContent = daily.sourceEn; $('homeQuoteReflection').textContent = daily.mindset;
    const todays = data.diaries.filter(d => d.dateISO === localDate() || d.date === humanDate());
    const latest = todays[0];
    $('homeMoodWeather').textContent = latest ? moodFor(latest.moodLabel || latest.mood).weather : '오늘 마음에는 어떤 날씨가 머물렀나요?';
    $('homeDiaryTitle').textContent = latest ? moodFor(latest.moodLabel || latest.mood).name+'의 마음을 남겼어요' : '아직 펼치지 않은 한 페이지';
    $('homeDiaryPreview').textContent = latest ? String(latest.text).slice(0,65)+(String(latest.text).length>65?'…':'') : '지금의 마음을 조용히 들려주세요.';
    $('homeGardenTitle').textContent='앤의 장면 '+opened.size+'개가 열렸어요';
    $('homeGardenPreview').textContent=opened.size===scenes.length?'모든 장면이 열렸어요. 마음에 드는 풍경에 잠깐 머물러요.':'마음과 문장, 편지가 모일수록 앤의 세계도 풍성해져요.';
    const done=todayActivities(),count=Object.values(done).filter(Boolean).length;
    const mission=!done.diary?{text:'지금 마음에 가장 가까운 표정을 고르고 한 줄 남겨봐요.',go:'diary'}:!done.english?{text:'앤의 문장 한 줄을 천천히 읽고, 오늘의 한 입을 마쳐봐요.',go:'english'}:!done.letter?{text:'미래의 나에게 다정한 안부 한 줄을 보내볼까요?',go:'letter'}:{text:'오늘의 작은 마음들을 잘 간직했어요. 열린 풍경에서 잠깐 쉬어요.',go:'garden'};
    $('dailyMissionText').textContent=mission.text;$('dailyMissionProgress').textContent=count?'오늘의 작은 발걸음 '+count+' / 3 · 하나만 해도 충분해요.':'오늘은 마음이 가는 하나부터. 서두르지 않아도 괜찮아요.';
    $('dailyMissionGo').dataset.go=mission.go;$('dailyMissionGo').textContent=count===3?'풍경 보러 가기 ↗':'지금 해보기 ↗';
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
  function renderGallery() {
    const opened=unlockedSceneIds(),available=scenes.filter(scene=>opened.has(scene.id));
    const featured=available[available.length-1]||scenes[0];
    $('galleryFeatureImage').src=featured.image;$('galleryFeatureImage').alt=featured.alt;$('galleryFeatureTitle').textContent=featured.title;$('galleryFeatureText').textContent=featured.description;$('galleryFeatureOpen').dataset.scene=featured.id;
    const seen=new Set((Array.isArray(data.sceneViews)?data.sceneViews:[]).filter(id=>opened.has(id)));
    $('galleryProgressText').textContent=`열린 장면 ${opened.size} / ${scenes.length} · 둘러본 장면 ${seen.size}개`;
    $('sceneProgress').setAttribute('aria-valuemax',scenes.length);$('sceneProgress').setAttribute('aria-valuenow',opened.size);$('sceneProgressBar').style.width=opened.size/scenes.length*100+'%';
    const visible=scenes.filter(scene=>sceneFilter==='all'||(sceneFilter==='open'?opened.has(scene.id):!opened.has(scene.id)));
    $('sceneGrid').innerHTML=visible.length?visible.map(scene=>{const on=opened.has(scene.id);return `<button type="button" class="scene-card ${on?'is-open':'is-locked'}" data-scene="${scene.id}" aria-label="${safe(scene.title)} · ${on?'열린 장면 보기':scene.condition}"><span class="scene-card-art"><img src="${scene.image}" alt="${safe(scene.alt)}" width="1536" height="1024" loading="lazy"><span class="scene-card-status">${on?'열린 장면':'기다리는 장면'}</span></span><span class="scene-card-copy"><small>${safe(scene.category)}</small><b>${safe(scene.title)}</b><span>${safe(on?scene.quote:scene.condition)}</span></span></button>`;}).join(''):'<div class="surface gallery-empty"><p>기다리던 풍경이 모두 열렸어요.<br>마음에 드는 장면을 다시 만나보세요.</p><button type="button" class="text-button" data-scene-filter="all">모든 풍경 보기 ↗</button></div>';
    document.querySelectorAll('[data-scene-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sceneFilter===sceneFilter)));
    const memory=data.diaries.find(d=>d.dateISO===localDate()||d.date===humanDate());
    $('gardenMemoryTitle').textContent=memory?moodFor(memory.moodLabel||memory.mood).name+'의 마음을 남긴 오늘':'아직 쓰이지 않은 오늘의 페이지';
    $('gardenMemoryText').textContent=memory?String(memory.text).slice(0,160)+(String(memory.text).length>160?'…':''):'한 줄의 마음으로 시작해도 좋아요. 오늘의 작은 기억이 이곳에 함께 남을 거예요.';
  }
  function openScene(id) {
    const scene=scenes.find(s=>s.id===id);if(!scene)return;
    const on=unlockedSceneIds().has(id);openedSceneId=id;
    if(on&&!storageBroken&&!(Array.isArray(data.sceneViews)?data.sceneViews:[]).includes(id))commit(d=>{d.sceneViews=Array.isArray(d.sceneViews)?d.sceneViews:[];d.sceneViews.push(id);});
    const dialog=$('sceneDialog');dialog.classList.toggle('is-locked',!on);
    $('sceneDialogImage').src=scene.image;$('sceneDialogImage').alt=scene.alt;$('sceneDialogTag').textContent=on?scene.category:'곧 만나게 될 앤의 풍경';$('sceneDialogTitle').textContent=scene.title;
    $('sceneDialogText').textContent=on?scene.description:'작은 기록이 모이면 이 장면을 온전히 만날 수 있어요. 기다림에도 저마다의 다정한 이야기가 있어요.';
    $('sceneDialogQuote').textContent=on?'“'+scene.quote+'”':'';$('sceneDialogQuote').hidden=!on;
    $('sceneDialogRequirement').textContent=on?'이미 남겨주신 마음과 활동으로 열린 장면이에요.':scene.condition;
    $('sceneDialogAction').textContent=on?'장면을 마음에 담고 돌아가기':'이 장면을 여는 작은 행동 ↗';
    if(!dialog.open)dialog.showModal();
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
    $('englishDoneNote').textContent = completed?'간직한 배움은 행복정원의 풍경으로 이어져요. 다음 문장은 천천히 만나도 좋아요.':'첫 카드의 마무리로 ‘편지에 담긴 작은 용기’ 장면이 열려요.';
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
  function renderAll() { renderHome();renderMoods();renderDiaries();renderGallery();renderLetters();renderEnglish(); }
  function sayHello() { commit(d=>{d.pettedDate=localDate();},'보리가 꼬리를 흔들어요. 오늘도 함께, 천천히 걸어요. 🐾'); }
  document.addEventListener('click',e=>{
    const go=e.target.closest('[data-go],[data-tab]');if(go){e.preventDefault();navigate(go.dataset.go||go.dataset.tab);return;}
    const m=e.target.closest('[data-mood]');if(m){mood=m.dataset.mood;renderMoods();return;}
    const scene=e.target.closest('[data-scene]');if(scene){openScene(scene.dataset.scene);return;}
    const sceneFilterButton=e.target.closest('[data-scene-filter]');if(sceneFilterButton){sceneFilter=sceneFilterButton.dataset.sceneFilter;renderGallery();return;}
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
    if(commit(d=>{d.diaries.unshift({id:Date.now(),date:humanDate(),dateISO:localDate(),mood,moodLabel:name,text});},'오늘 마음이 정원 한쪽에 조용히 놓였어요.','diary')){
      $('diaryText').value='';$('diaryCount').textContent='0 / 3000';
    }
  });
  $('diaryMore').addEventListener('click',()=>{diaryLimit+=6;renderDiaries();});
  $('petDog').addEventListener('click',sayHello);
  $('closeSceneDialog').addEventListener('click',()=>$('sceneDialog').close());
  $('sceneDialog').addEventListener('close',()=>{if(currentPage==='garden'&&openedSceneId){const target=document.querySelector('.scene-card[data-scene="'+openedSceneId+'"]');if(target)target.focus({preventScroll:true});}});
  $('sceneDialog').addEventListener('click',e=>{const box=$('sceneDialog').getBoundingClientRect();if(e.target===$('sceneDialog')&&(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom))$('sceneDialog').close();});
  $('sceneDialogAction').addEventListener('click',()=>{const scene=scenes.find(x=>x.id===openedSceneId);if(!scene)return;const on=unlockedSceneIds().has(scene.id);$('sceneDialog').close();if(!on)navigate(scene.go);});
  $('letterForm').addEventListener('submit',e=>{
    e.preventDefault();const text=$('letterText').value.trim(),date=$('letterDate').value;
    if(!text||!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<localDate()){toast('편지 내용과 오늘 이후의 날짜를 확인해주세요.');return;}
    if(commit(d=>{d.letters.unshift({id:Date.now(),date,text,createdDate:localDate()});},dateLabel(date)+'의 나에게, 마음을 다정히 보냈어요.','letter')){$('letterText').value='';}
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
    const idx=cardIndex(),text=$('englishWritingInput').value.trim();
    const ok=commit(d=>{if(!d.englishCompletedCards.includes(idx))d.englishCompletedCards.push(idx);d.englishCompletedDates={...(d.englishCompletedDates||{}),[idx]:localDate()};if(text){d.englishWriting[String(idx)]=text;d.englishWritingDates={...(d.englishWritingDates||{}),[idx]:localDate()};}},'오늘의 한 입을 간직했어요. 이만큼이면 충분해요.','english');
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
