(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  const toAr = (value) => String(value).replace(/\d/g, d => arabicDigits[d]);
  const ruleText = (r) => `${r >= 0 ? '+' : '−'}${toAr(Math.abs(r))}`;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const shuffle = (arr) => [...arr].sort(() => Math.random() - .5);

  const stages = [
    {id:1,title:'خطوة واحدة',rule:1,type:'plus',emoji:'🌱'},
    {id:2,title:'ارجع خطوة',rule:-1,type:'minus',emoji:'💧'},
    {id:3,title:'قفزتان',rule:2,type:'plus',emoji:'🐸'},
    {id:4,title:'ناقص اثنين',rule:-2,type:'minus',emoji:'🍃'},
    {id:5,title:'قفزة الثلاثة',rule:3,type:'plus',emoji:'⭐'},
    {id:6,title:'ارجع ثلاثة',rule:-3,type:'minus',emoji:'🪷'},
    {id:7,title:'قفزة الخمسة',rule:5,type:'plus',emoji:'🪙'},
    {id:8,title:'ناقص خمسة',rule:-5,type:'minus',emoji:'🌾'},
    {id:9,title:'عشرات سريعة',rule:10,type:'plus',emoji:'🚀'},
    {id:10,title:'ارجع عشرة',rule:-10,type:'minus',emoji:'🧭'},
    {id:11,title:'محقق القاعدة',mode:'discover',type:'discover',emoji:'🔎'},
    {id:12,title:'التحدي الكبير',mode:'mixed',type:'challenge',emoji:'🏆'}
  ];
  const mixedRules = [1,-1,2,-2,3,-3,5,-5,10,-10];
  const roundsPerStage = 6;

  const defaults = {points:0, coins:0, maxUnlocked:1, stageStars:{}, sound:true};
  let saved;
  try { saved = JSON.parse(localStorage.getItem('patternAdventureProgress') || 'null'); } catch { saved = null; }
  const progress = Object.assign({}, defaults, saved || {});
  progress.stageStars = progress.stageStars || {};

  let currentStage = null;
  let currentRule = 1;
  let current = 3;
  let round = 0;
  let hearts = 3;
  let streak = 0;
  let errors = 0;
  let correctCount = 0;
  let history = [];
  let accepting = true;
  let discoverReady = true;
  let installPrompt = null;

  const screens = {
    home: $('#homeScreen'), stages: $('#stagesScreen'), game: $('#gameScreen')
  };

  function saveProgress(){
    try { localStorage.setItem('patternAdventureProgress', JSON.stringify(progress)); } catch {}
  }
  function totalStars(){ return Object.values(progress.stageStars).reduce((a,b)=>a+Number(b||0),0); }
  function updateGlobalStats(){
    $('#homePoints').textContent = toAr(progress.points);
    $('#homeCoins').textContent = toAr(progress.coins);
    $('#homeStars').textContent = toAr(totalStars());
    $('#stagePoints').textContent = toAr(progress.points);
    $('#pointsNow').textContent = toAr(progress.points);
    $('#coinsNow').textContent = toAr(progress.coins);
    $('#heartsNow').textContent = toAr(hearts);
    $('#streakNow').textContent = toAr(streak);
  }
  function showScreen(name){
    Object.values(screens).forEach(s=>s.classList.remove('active'));
    screens[name].classList.add('active');
    window.scrollTo({top:0,behavior:'smooth'});
    updateGlobalStats();
    if(name==='stages') renderStages();
  }

  function renderStages(){
    const grid = $('#stagesGrid');
    grid.innerHTML = '';
    stages.forEach(stage => {
      const locked = stage.id > progress.maxUnlocked;
      const stars = Number(progress.stageStars[stage.id] || 0);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `stage-card ${stage.type} ${locked ? 'locked' : ''}`;
      card.disabled = locked;
      let rule = stage.mode === 'discover' ? 'اكتشف السر' : stage.mode === 'mixed' ? 'زيادة ونقصان' : `القاعدة ${ruleText(stage.rule)}`;
      card.innerHTML = `
        <span class="stage-num">${toAr(stage.id)}</span>
        <div class="stage-emoji">${stage.emoji}</div>
        <h3>${stage.title}</h3>
        <div class="stage-rule">${rule}</div>
        <div class="stage-stars">${'⭐'.repeat(stars)}${'☆'.repeat(3-stars)}</div>
        ${locked ? '<div class="lock-tag" aria-hidden="true">🔒</div>' : ''}`;
      if(!locked) card.addEventListener('click', ()=>startStage(stage.id));
      grid.appendChild(card);
    });
  }

  function pickRule(){
    if(currentStage.mode==='discover' || currentStage.mode==='mixed') return mixedRules[rand(0,mixedRules.length-1)];
    return currentStage.rule;
  }
  function pickStart(rule){
    if(rule < 0){
      const min = Math.abs(rule)*5 + 5;
      return rand(min, Math.max(min+15, 70));
    }
    return rand(1, rule >= 10 ? 35 : 45);
  }
  function startStage(id){
    currentStage = stages.find(s=>s.id===id);
    if(!currentStage) return;
    round = 0; hearts = 3; streak = 0; errors = 0; correctCount = 0; history = [];
    currentRule = pickRule(); current = pickStart(currentRule); history=[current];
    $('#stageLabel').textContent = `المرحلة ${toAr(currentStage.id)} • ${currentStage.title}`;
    showScreen('game');
    nextQuestion(true);
  }
  function stageHeading(){
    if(currentStage.mode==='discover') return 'اكتشف القاعدة ثم اقفز';
    if(currentStage.mode==='mixed') return `القاعدة الآن: ${ruleText(currentRule)}`;
    return `القاعدة: ${ruleText(currentRule)}`;
  }
  function nextQuestion(first=false){
    accepting = true;
    $('#feedback').textContent = '';
    $('#feedback').className = 'feedback';
    $('#actor').style.transform = 'translateX(-50%)';
    currentRule = first ? currentRule : (currentStage.mode==='mixed' || currentStage.mode==='discover' ? pickRule() : currentRule);
    if(!first && (currentStage.mode==='mixed' || currentStage.mode==='discover')){
      current = pickStart(currentRule); history=[current];
    }
    $('#stageHeading').textContent = stageHeading();
    $('#missionText').textContent = currentStage.mode==='discover'
      ? 'راقب النمط، اكتشف القاعدة، ثم اقفز إلى العدد الصحيح.'
      : 'اقفز على العدد الصحيح وفق القاعدة. كل قفزة صحيحة تمنحك نقاطًا وجائزة!';
    $('#currentPad').textContent = toAr(current);
    renderTrail();
    $('#roundProgress').style.width = `${(round/roundsPerStage)*100}%`;
    if(currentStage.mode==='discover') setupDiscover();
    else { $('#discoverPanel').classList.add('hidden'); discoverReady=true; renderChoices(); }
    updateGlobalStats();
  }
  function renderTrail(){
    const trail = $('#trail'); trail.innerHTML='';
    const recent = history.slice(-4);
    recent.forEach((n,i)=>{
      const s=document.createElement('span');s.textContent=toAr(n);trail.appendChild(s);
      if(i<recent.length-1){const a=document.createElement('i');a.textContent='←';trail.appendChild(a);}
    });
    const a=document.createElement('i');a.textContent='←';trail.appendChild(a);
    const q=document.createElement('span');q.textContent='؟';trail.appendChild(q);
  }
  function setupDiscover(){
    discoverReady=false;
    $('#discoverPanel').classList.remove('hidden');
    $('#choices').innerHTML = '<div style="grid-column:1/-1;text-align:center;color:white;font-weight:900;font-size:20px">اختر القاعدة أولًا 🔎</div>';
    const seq=[current,current+currentRule,current+currentRule*2];
    $('#discoverSequence').textContent = seq.map(toAr).join(' ، ');
    const ruleChoices = new Set([currentRule]);
    while(ruleChoices.size<4){ ruleChoices.add(mixedRules[rand(0,mixedRules.length-1)]); }
    const box=$('#ruleChoices');box.innerHTML='';
    shuffle([...ruleChoices]).forEach(r=>{
      const b=document.createElement('button');b.type='button';b.className='rule-choice';b.textContent=ruleText(r);
      b.addEventListener('click',()=>checkDiscoverRule(b,r));box.appendChild(b);
    });
  }
  function checkDiscoverRule(btn,r){
    if(discoverReady) return;
    if(r===currentRule){
      discoverReady=true; btn.classList.add('correct'); progress.points+=5; playTone('good');
      $('#feedback').textContent='أحسنت! اكتشفت القاعدة. الآن أكمل القفزة.'; $('#feedback').className='feedback good';
      setTimeout(()=>renderChoices(),280);
    }else{
      btn.classList.add('wrong'); progress.points=Math.max(0,progress.points-2); playTone('bad');
      $('#feedback').textContent='جرّب قاعدة أخرى. قارن الفرق بين كل عدد والذي يليه.'; $('#feedback').className='feedback bad';
      setTimeout(()=>btn.classList.remove('wrong'),350);
    }
    updateGlobalStats(); saveProgress();
  }
  function makeOptions(correct){
    const set = new Set([correct]);
    const step = Math.max(1,Math.abs(currentRule));
    const candidates=[correct+step,correct-step,correct+1,correct-1,correct+step*2,correct-step*2,current,current+currentRule*2];
    shuffle(candidates).forEach(n=>{ if(n>=0 && set.size<4) set.add(n); });
    while(set.size<4){ const n=Math.max(0,correct+rand(-12,12)); set.add(n); }
    return shuffle([...set].slice(0,4));
  }
  function renderChoices(){
    const correct=current+currentRule;
    const box=$('#choices');box.innerHTML='';
    makeOptions(correct).forEach(n=>{
      const b=document.createElement('button');b.type='button';b.className='choice-btn';b.setAttribute('aria-label',`العدد ${toAr(n)}`);
      b.innerHTML=`<span class="lily-pad">${toAr(n)}</span>`;
      b.addEventListener('click',()=>chooseNumber(b,n,correct));box.appendChild(b);
    });
  }
  function chooseNumber(btn,n,correct){
    if(!accepting || (currentStage.mode==='discover' && !discoverReady)) return;
    accepting=false;
    if(n===correct){
      btn.classList.add('correct');
      progress.points+=10; progress.coins+=1; streak+=1; correctCount+=1;
      if(streak>0 && streak%3===0) progress.coins+=2;
      $('#feedback').textContent = streak>0 && streak%3===0 ? 'قفزة رائعة! +١٠ نقاط ومكافأة سلسلة 🪙🪙' : 'أحسنت! قفزة صحيحة +١٠ نقاط ⭐';
      $('#feedback').className='feedback good';
      playTone('good'); animateJump(btn); showReward(btn, streak%3===0 ? '⭐ +١٠  🪙×٣' : '⭐ +١٠  🪙');
      const oldCurrent=current; current=correct; history.push(current); round+=1;
      updateGlobalStats(); saveProgress(); renderTrail();
      $('#roundProgress').style.width = `${(round/roundsPerStage)*100}%`;
      if(round>=roundsPerStage){ setTimeout(completeStage,900); }
      else {
        setTimeout(()=>{
          if(currentStage.mode==='discover' || currentStage.mode==='mixed') nextQuestion(false);
          else { $('#currentPad').textContent=toAr(current); renderChoices(); accepting=true; $('#actor').style.transform='translateX(-50%)'; }
        },900);
      }
    }else{
      btn.classList.add('wrong'); progress.points=Math.max(0,progress.points-5); hearts-=1; streak=0; errors+=1;
      $('#feedback').textContent='ليست القفزة المناسبة. خسرت ٥ نقاط، جرّب من جديد.'; $('#feedback').className='feedback bad';
      playTone('bad'); updateGlobalStats(); saveProgress();
      setTimeout(()=>btn.classList.remove('wrong'),380);
      if(hearts<=0){ setTimeout(failStage,650); }
      else setTimeout(()=>{accepting=true;},420);
    }
  }
  function animateJump(target){
    const actor=$('#actor');
    if(!actor.animate) return;
    const a=actor.getBoundingClientRect(), t=target.getBoundingClientRect();
    const dx=(t.left+t.width/2)-(a.left+a.width/2), dy=(t.top+t.height/2)-(a.top+a.height/2)-18;
    actor.animate([
      {transform:'translateX(-50%) translate(0,0) rotate(0deg)'},
      {transform:`translateX(-50%) translate(${dx*.5}px,${dy*.35-75}px) rotate(-8deg)`,offset:.5},
      {transform:`translateX(-50%) translate(${dx}px,${dy}px) rotate(3deg)`}
    ],{duration:650,easing:'cubic-bezier(.2,.7,.25,1)',fill:'forwards'});
  }
  function showReward(target,text){
    const pond=$('#pond'), burst=$('#rewardBurst'), p=pond.getBoundingClientRect(), t=target.getBoundingClientRect();
    burst.textContent=text; burst.style.left=`${t.left+t.width/2-p.left}px`; burst.style.top=`${t.top-p.top}px`;
    burst.classList.remove('show'); void burst.offsetWidth; burst.classList.add('show');
  }
  function completeStage(){
    const stars = errors===0 ? 3 : errors<=2 ? 2 : 1;
    const old=Number(progress.stageStars[currentStage.id]||0);
    progress.stageStars[currentStage.id]=Math.max(old,stars);
    if(currentStage.id<stages.length) progress.maxUnlocked=Math.max(progress.maxUnlocked,currentStage.id+1);
    progress.points+=stars*15; progress.coins+=stars*3; saveProgress(); updateGlobalStats();
    openResult(true,stars);
  }
  function failStage(){ openResult(false,0); }
  function openResult(success,stars){
    $('#modalIcon').textContent=success?'🏆':'💦';
    $('#modalTitle').textContent=success?'أحسنت! أنهيت المرحلة':'انتهت المحاولات';
    $('#modalText').textContent=success
      ? `حصلت على ${toAr(stars)} نجوم ومكافأة إضافية. القفز الصحيح: ${toAr(correctCount)} من ${toAr(roundsPerStage)}.`
      : 'يمكنك إعادة المرحلة. راقب القاعدة واحسب العدد التالي قبل أن تقفز.';
    $('#modalStars').textContent=success?'⭐'.repeat(stars)+'☆'.repeat(3-stars):'♡ ♡ ♡';
    $('#modalPrimary').textContent=success && currentStage.id<stages.length ? 'المرحلة التالية' : 'إعادة المحاولة';
    $('#modalPrimary').onclick=()=>{
      closeResult();
      if(success && currentStage.id<stages.length) startStage(currentStage.id+1); else startStage(currentStage.id);
    };
    $('#modalSecondary').onclick=()=>{closeResult();showScreen('stages');};
    $('#modal').classList.remove('hidden');
  }
  function closeResult(){ $('#modal').classList.add('hidden'); }
  function showHint(){
    const correct=current+currentRule;
    const verb=currentRule>=0?'أضف':'اطرح';
    $('#feedback').textContent=`💡 ${verb} ${toAr(Math.abs(currentRule))} ${currentRule>=0?'إلى':'من'} ${toAr(current)}. فكّر: ما العدد الناتج؟`;
    $('#feedback').className='feedback good';
    playTone('hint');
  }
  function playTone(kind){
    if(!progress.sound) return;
    try{
      const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
      const ctx=new AC(), o=ctx.createOscillator(), g=ctx.createGain();o.connect(g);g.connect(ctx.destination);
      o.type='sine';o.frequency.value=kind==='good'?660:kind==='bad'?180:420;g.gain.value=.0001;
      const t=ctx.currentTime;g.gain.exponentialRampToValueAtTime(.12,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.22);o.start(t);o.stop(t+.24);
    }catch{}
  }
  function toggleSound(){ progress.sound=!progress.sound; $('#soundBtn').textContent=progress.sound?'🔊':'🔇'; $('#soundBtn').setAttribute('aria-pressed',String(progress.sound)); saveProgress(); }

  function openInfo(kind){
    const title=$('#infoTitle'), content=$('#infoContent');
    if(kind==='how'){
      title.textContent='كيف ألعب؟';
      content.innerHTML=`<ul>
        <li>اقرأ القاعدة في أعلى الشاشة.</li>
        <li>ابدأ من العدد الموجود على ورقة الزنبق.</li>
        <li>إذا كانت القاعدة زيادة فأضف، وإذا كانت نقصانًا فاطرح.</li>
        <li>اضغط ورقة الزنبق التي تحمل العدد الصحيح ليقفز الطالب إليها.</li>
        <li>القفزة الصحيحة: <b>+١٠ نقاط</b> وعملة. القفزة الخاطئة: <b>−٥ نقاط</b> وتفقد محاولة.</li>
        <li>في مرحلة «محقق القاعدة» اكتشف القاعدة أولًا ثم أكمل النمط.</li>
      </ul>`;
    }else{
      title.textContent='الإعدادات';
      content.innerHTML=`
        <div class="settings-row"><b>المؤثرات الصوتية</b><button id="infoSound" class="switch-btn" type="button">${progress.sound?'تشغيل 🔊':'إيقاف 🔇'}</button></div>
        <div class="settings-row"><b>فتح جميع المراحل للتجربة</b><button id="unlockAll" class="switch-btn" type="button">فتح 🔓</button></div>
        <div class="settings-row"><b>إعادة التقدم من البداية</b><button id="resetProgress" class="switch-btn" type="button">إعادة ↻</button></div>
        <div class="settings-row"><b>تثبيت اللعبة</b><button id="installBtn" class="switch-btn" type="button" ${installPrompt?'':'disabled'}>${installPrompt?'تثبيت ⬇':'متاح عند النشر عبر HTTPS'}</button></div>`;
      setTimeout(()=>{
        $('#infoSound')?.addEventListener('click',()=>{toggleSound();openInfo('settings');});
        $('#unlockAll')?.addEventListener('click',()=>{progress.maxUnlocked=stages.length;saveProgress();openInfo('settings');});
        $('#resetProgress')?.addEventListener('click',()=>{Object.assign(progress,{points:0,coins:0,maxUnlocked:1,stageStars:{}});saveProgress();updateGlobalStats();openInfo('settings');});
        $('#installBtn')?.addEventListener('click',async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;openInfo('settings');});
      },0);
    }
    $('#infoModal').classList.remove('hidden');
  }

  $('#startBtn').addEventListener('click',()=>showScreen('stages'));
  $('#howBtn').addEventListener('click',()=>openInfo('how'));
  $('#settingsBtn').addEventListener('click',()=>openInfo('settings'));
  $('#closeInfo').addEventListener('click',()=>$('#infoModal').classList.add('hidden'));
  $$('.home-nav').forEach(b=>b.addEventListener('click',()=>showScreen('home')));
  $('#backToStages').addEventListener('click',()=>showScreen('stages'));
  $('#hintBtn').addEventListener('click',showHint);
  $('#restartStageBtn').addEventListener('click',()=>startStage(currentStage.id));
  $('#soundBtn').addEventListener('click',toggleSound);
  $('#soundBtn').textContent=progress.sound?'🔊':'🔇';
  $('#infoModal').addEventListener('click',(e)=>{if(e.target===$('#infoModal'))$('#infoModal').classList.add('hidden');});
  $('#modal').addEventListener('click',(e)=>{if(e.target===$('#modal'))closeResult();});

  window.addEventListener('beforeinstallprompt',(e)=>{e.preventDefault();installPrompt=e;});
  if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(()=>{});

  updateGlobalStats();
})();
