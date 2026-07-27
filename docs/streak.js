const STREAK_STATUSES=[
 {days:1,id:'first',asset:'first.webp',name:'Первый шаг',description:'Первый шаг сделан. Главное — продолжать.',color:'#a7bd76'},
 {days:3,id:'student',asset:'student.webp',name:'Ученик',description:'Отличное начало. Регулярность постепенно становится привычкой.',color:'#739dd3'},
 {days:7,id:'rhythm',asset:'rhythm.webp',name:'В ритме',description:'Неделя практики — вы уже вошли в ритм.',color:'#49aca9'},
 {days:14,id:'practice',asset:'practice.webp',name:'Практик',description:'Новые слова начинают запоминаться быстрее.',color:'#8b7aaa'},
 {days:21,id:'habit',asset:'habit.webp',name:'Крепкая привычка',description:'Регулярность превращает знания в навык.',color:'#72945d'},
 {days:30,id:'speaker',asset:'speaker.webp',name:'Собеседник',description:'Месяц ежедневной практики — серьёзный результат.',color:'#d98270'},
 {days:50,id:'explorer',asset:'explorer.webp',name:'Исследователь',description:'Словарный запас заметно расширился.',color:'#3b86ad'},
 {days:75,id:'linguist',asset:'linguist.webp',name:'Лингвист',description:'Язык становится понятной системой.',color:'#8565a8'},
 {days:100,id:'master',asset:'master.webp',name:'Мастер языка',description:'Сто дней — это уже устойчивая привычка.',color:'#34577f'},
 {days:180,id:'expert',asset:'expert.webp',name:'Эксперт',description:'Вы продолжаете там, где большинство останавливается.',color:'#27375f'},
 {days:365,id:'legend',asset:'legend.webp',name:'Легенда',description:'Целый год ежедневной практики.',color:'#e5a325'}
];
const MOTIVATION_PHRASES=['Каждое занятие делает знакомые слова увереннее.','Семь карточек сегодня — меньше сомнений завтра.','Небольшой шаг каждый день сильнее редких рывков.','Ошибки показывают, что повторить, а не что вы не умеете.','Регулярность постепенно превращается в лёгкость.','Сегодняшнее повторение укрепляет память.','Ещё одно занятие — ещё семь встреч со словами.','Вы уже знаете больше, чем в начале пути.','Короткая практика тоже считается важным шагом.','Возвращаться к словам — нормальная часть обучения.','Спокойный темп помогает знаниям закрепиться.','Каждый правильный ответ вырос из предыдущих попыток.','Серия строится по одному занятию за раз.','Слова становятся своими, когда встречаются регулярно.','Лучший результат — тот, к которому вы возвращаетесь.','Пять минут практики лучше отложенного идеального часа.','Сегодня вы поддержали привычку учиться.','Повторение освобождает внимание для новых слов.','Уверенность растёт незаметно, но каждый день.','Продолжайте: память любит регулярные встречи.'];
function medalSrc(x){return'./achievements/'+x.asset+'?v=5'}
function lockedMedalSrc(x){return'./achievements/locked-'+x.days+'.webp?v=1'}
function getStreakStatus(days){days=Math.max(0,Number(days)||0);let current=null,next=STREAK_STATUSES[0];STREAK_STATUSES.forEach(x=>{if(days>=x.days){current=x;next=STREAK_STATUSES[STREAK_STATUSES.indexOf(x)+1]||null}});const start=current?current.days:0,end=next?next.days:start||1,progress=next?Math.max(0,Math.min(1,(days-start)/(end-start))):1;return{days,current,next,remaining:next?Math.max(0,next.days-days):0,progress,max:!next}}
function achievementHeader(d){
 const streak=getStreakStatus(d.streak),best=getStreakStatus(d.longestStreak),current=best.current||STREAK_STATUSES[0],bestDays=Math.max(0,Number(d.longestStreak||0)),lessons=Number(d.totalLessons||0),lessonDone=Number(d.today||0)>0,lessonStatusClass=lessonDone?'done':'pending',lessonStatusText=lessonDone?'Пройдено сегодня':'Урок сегодня не пройден',phrase=MOTIVATION_PHRASES[lessons%MOTIVATION_PHRASES.length],percent=Math.round(streak.progress*100),footer=streak.next?`До достижения «${streak.next.name}»: ${streak.days} из ${streak.next.days} дней · осталось ${streak.remaining} ${dayWord(streak.remaining)}`:'Все достижения серии открыты';
 app.style.setProperty('--achievement-accent',current.color);
 app.style.setProperty('--green',current.color);
 const medals=STREAK_STATUSES.map(x=>bestDays>=x.days?`<button class="medal-slot earned" onclick="openAchievements()" aria-label="${esc(x.name)}, открыть коллекцию"><img src="${medalSrc(x)}" alt=""><small>${x.days}</small></button>`:`<button class="medal-slot locked" onclick="openAchievements()" aria-label="${esc(x.name)}, ${x.days} дней"><img src="${lockedMedalSrc(x)}" alt=""></button>`).join('');
 return`<div class="achievement-hero" style="--achievement-accent:${current.color};--achievement-glow:${current.color}50"><div class="hero-name"><h1>${esc(d.student.name)}</h1></div><div class="achievement-showcase"><div class="medal-collection">${medals}</div><button class="current-medal" onclick="openCurrentAchievement(${current.days})" aria-label="Текущее достижение: ${esc(current.name)}, статус: ${lessonStatusText}">${lessonDone?'<i class="lesson-status-badge done" aria-hidden="true">✓</i>':''}<img src="${medalSrc(current)}" alt=""><span class="current-medal-name">${esc(current.name)}</span><b class="lesson-status-caption ${lessonStatusClass}">${lessonStatusText}</b></button></div><div class="welcome-badges"><span class="streak">🔥 ${Number(d.streak||0)} ${dayWord(Number(d.streak||0))}</span><button class="freeze-pill" onclick="showFreezeInfo()" aria-label="Как работают заморозки">❄️ ${Number(d.freezeCount||0)}</button></div><span class="lesson-count">✓ ${lessons} ${lessonWord(lessons)} · лучшая серия — ${bestDays} ${dayWord(bestDays)}</span><div class="achievement-progress"><div class="achievement-copy"><b>${esc(phrase)}</b><span>${esc(footer)}</span></div><div class="progress-track" role="progressbar" aria-label="Прогресс до следующего достижения" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><i style="width:${percent}%"></i></div></div></div>`;
}
function showFreezeInfo(){alert('❄️ Заморозка сохраняет серию, если пропущен один день.\n\nПервая заморозка — подарок при начале обучения.\n\nКак получить ещё:\n• впервые дойти до серии 7 дней;\n• пройти третье полное занятие за день с результатом не ниже 5/7.\n\nМожно хранить до 2. Заморозка применится автоматически.')}
function openAchievements(){const best=Math.max(0,Number(homeData&&homeData.longestStreak||0)),cards=STREAK_STATUSES.map(x=>{const unlocked=best>=x.days,content=`<div class="medal"><img src="${unlocked?medalSrc(x):lockedMedalSrc(x)}" alt=""></div><div><b>${esc(x.name)}</b><small>${unlocked?'Получено навсегда':x.days+' '+dayWord(x.days)+' подряд'}</small></div>`;return unlocked?`<button class="achievement-card unlocked" onclick="replayAchievementCelebration(${x.days})" aria-label="Показать поздравление за достижение ${esc(x.name)}">${content}</button>`:`<div class="achievement-card locked">${content}</div>`}).join(''),overlay=document.createElement('div');overlay.id='achievementOverlay';overlay.className='achievement-overlay';overlay.innerHTML=`<section class="achievement-modal"><div class="achievement-modal-head"><div><span>КОЛЛЕКЦИЯ</span><h2>Достижения</h2></div><button onclick="closeAchievements()" aria-label="Закрыть">×</button></div><p>Полученные медали остаются навсегда, даже если серия прервётся.</p><div class="achievement-grid">${cards}</div></section>`;overlay.onclick=e=>{if(e.target===overlay)closeAchievements()};document.body.appendChild(overlay)}
function replayAchievementCelebration(days){const status=STREAK_STATUSES.find(x=>x.days===Number(days));if(!status)return;closeAchievements();showAchievementCelebration(status,true)}
function openAchievement(days,isCurrent){const current=STREAK_STATUSES.filter(x=>x.days<=Number(days||0)).pop()||STREAK_STATUSES[0],overlay=document.createElement('div');overlay.id='achievementOverlay';overlay.className='achievement-overlay';overlay.innerHTML=`<section class="achievement-modal current-achievement-modal"><div class="achievement-modal-head"><div><span>${isCurrent?'ТЕКУЩЕЕ ДОСТИЖЕНИЕ':'ПОЛУЧЕННОЕ ДОСТИЖЕНИЕ'}</span><h2>${esc(current.name)}</h2></div><button onclick="closeAchievements()" aria-label="Закрыть">×</button></div><img class="current-achievement-image" src="${medalSrc(current)}" alt=""><b class="current-achievement-days">${current.days} ${dayWord(current.days)} подряд</b><p>${esc(current.description)}</p><button class="btn secondary" onclick="closeAchievements();openAchievements()">Все достижения</button></section>`;overlay.onclick=e=>{if(e.target===overlay)closeAchievements()};document.body.appendChild(overlay)}
function openCurrentAchievement(days){openAchievement(days,true)}
function closeAchievements(){const x=document.getElementById('achievementOverlay');if(x)x.remove()}
function closeAchievementCelebration(){const x=document.getElementById('achievementCelebration');if(x)x.remove();document.body.classList.remove('celebrating')}
function celebrationConfetti(){return Array.from({length:52},(_,i)=>`<i style="--x:${2+(i*37)%96}%;--fall:${48+(i*29)%68}vh;--dx:${(i*43)%120-60}px;--r:${(i*47)%180-90}deg;--spin:${(i*131)%720-360}deg;--d:${(i%10)*.035}s"></i>`).join('')}
function showAchievementCelebration(status,replay){
 closeAchievementCelebration();
 const overlay=document.createElement('div');
 overlay.id='achievementCelebration';
 overlay.className='achievement-celebration';
 overlay.style.setProperty('--celebration-accent',status.color);
 overlay.innerHTML=`<div class="celebration-confetti" aria-hidden="true">${celebrationConfetti()}</div><main class="celebration-content"><div class="celebration-crown" aria-hidden="true"><span>❧</span><b>✦</b><span>❧</span></div><div class="celebration-medal"><span></span><img src="${medalSrc(status)}" alt="Достижение «${esc(status.name)}»"></div><div class="celebration-copy"><div class="celebration-eyebrow">${replay?'ПОЛУЧЕННОЕ ДОСТИЖЕНИЕ':'НОВОЕ ДОСТИЖЕНИЕ'}</div><h1>Поздравляем!</h1><p>${replay?'Эта ачивка уже в вашей коллекции':'Вы получили новую ачивку'}</p><div class="celebration-rule" aria-hidden="true">◆</div><h2>${status.days} ${dayWord(status.days)} подряд</h2><h3>${esc(status.name)}</h3><div class="celebration-rule compact" aria-hidden="true">◆</div><p class="celebration-description">${esc(status.description)}</p></div><div class="celebration-actions"><button class="celebration-primary" onclick="closeAchievementCelebration()">Продолжить <span>›</span></button><button class="celebration-secondary" onclick="closeAchievementCelebration();openAchievements()"><span>▦</span> ${replay?'Назад к достижениям':'Посмотреть все ачивки'} <b>›</b></button></div></main>`;
 document.body.classList.add('celebrating');
 document.body.appendChild(overlay);
}
function maybeCelebrateStatus(days){const info=getStreakStatus(days),key='wordsStreakStatus:'+TOKEN,stored=localStorage.getItem(key),seen=Number(stored||0),level=info.current?info.current.days:0;if(stored===null){localStorage.setItem(key,String(level));return false}if(level<=seen||!info.current)return false;localStorage.setItem(key,String(level));showAchievementCelebration(info.current);return true}

/* Emphasize the numeric progress in the achievement card without changing the copy. */
(function highlightAchievementProgress(){
  const style = document.createElement('style');
  style.textContent = `
    .achievement-copy .achievement-next{
      display:flex!important;
      flex-wrap:wrap;
      align-items:baseline;
      gap:4px 8px;
    }
    .achievement-copy .achievement-next > span:first-child{
      flex:1 1 100%;
      color:#718078;
    }
    .achievement-copy .achievement-next strong{
      color:var(--achievement-accent,#319a87);
      font-weight:800;
      white-space:nowrap;
    }
    .achievement-copy .achievement-next em{
      color:#718078;
      font-style:normal;
      white-space:nowrap;
    }
  `;
  document.head.appendChild(style);

  function apply(){
    document.querySelectorAll('.achievement-copy > span').forEach((el)=>{
      if (el.dataset.progressStyled) return;
      const text=el.textContent||'';
      const match=text.match(/^(.*?):\s*(\d+\s+из\s+\d+\s+дней?)\s*·\s*(осталось.*)$/i);
      if(!match) return;
      el.dataset.progressStyled='1';
      el.className='achievement-next';
      el.innerHTML='';
      const label=document.createElement('span');
      label.textContent=match[1]+':';
      const value=document.createElement('strong');
      value.textContent=match[2];
      const remaining=document.createElement('em');
      remaining.textContent=match[3];
      el.append(label,value,remaining);
    });
  }
  const run=()=>{apply();new MutationObserver(apply).observe(document.body,{childList:true,subtree:true});};
  if(document.body) run(); else document.addEventListener('DOMContentLoaded',run,{once:true});
})();
