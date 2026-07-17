const STREAK_STATUSES=[
 {days:1,id:'first',icon:'📝',name:'Первое слово',description:'Каждый полиглот когда-то начал с первого слова.'},
 {days:3,id:'student',icon:'📖',name:'Ученик',description:'Отличное начало. Регулярность постепенно становится привычкой.'},
 {days:7,id:'explorer',icon:'🎒',name:'Исследователь',description:'Неделя позади. Ваш словарный запас уже растёт.'},
 {days:14,id:'practitioner',icon:'💬',name:'Практик',description:'Новые слова начинают запоминаться быстрее.'},
 {days:21,id:'memorizer',icon:'🧠',name:'Запоминающий',description:'Регулярность превращает знания в навык.'},
 {days:30,id:'speaker',icon:'📚',name:'Собеседник',description:'Уже месяц ежедневной практики.'},
 {days:50,id:'polyglot',icon:'🌍',name:'Полиглот',description:'Ваш словарный запас заметно расширился.'},
 {days:75,id:'linguist',icon:'🎓',name:'Лингвист',description:'Язык становится понятной системой.'},
 {days:100,id:'master',icon:'👑',name:'Мастер языка',description:'Сто дней подряд — это уже устойчивая привычка.'},
 {days:180,id:'expert',icon:'🌟',name:'Эксперт',description:'Вы продолжаете там, где большинство останавливается.'},
 {days:365,id:'legend',icon:'✨',name:'Легенда',description:'Целый год ежедневной практики.'}
];
function getStreakStatus(days){
 days=Math.max(0,Number(days)||0);
 if(!days)return{days:0,current:null,next:STREAK_STATUSES[0],remaining:1,progress:0,max:false};
 let index=0;STREAK_STATUSES.forEach((x,i)=>{if(days>=x.days)index=i});
 const current=STREAK_STATUSES[index],next=STREAK_STATUSES[index+1]||null,max=!next;
 const progress=max?1:Math.max(0,Math.min(1,(days-current.days)/(next.days-current.days)));
 return{days,current,next,remaining:next?Math.max(0,next.days-days):0,progress,max};
}
function achievementHeader(d){
 const info=getStreakStatus(d.streak),lessons=Number(d.totalLessons||0);
 if(!info.current)return`<div class="welcome-head"><h1>${esc(d.student.name)}</h1><div class="welcome-badges"><span class="streak">🔥 Начните серию</span><span class="lesson-count">✓ ${lessons} ${lessonWord(lessons)}</span></div></div><div class="achievement-progress"><div class="achievement-copy"><b>📝 Первое слово</b><span>Завершите первое занятие, чтобы начать серию.</span></div><div class="progress-track" role="progressbar" aria-label="Прогресс до статуса Первое слово" aria-valuemin="0" aria-valuemax="1" aria-valuenow="0"><i style="width:0%"></i></div></div>`;
 const percent=Math.round(info.progress*100),footer=info.max?'Максимальный статус достигнут':`До статуса «${info.next.icon} ${info.next.name}» — ${info.remaining} ${dayWord(info.remaining)}`;
 return`<div class="welcome-head"><h1>${esc(d.student.name)}</h1><div class="welcome-badges"><div class="badge-row"><span class="streak">🔥 ${info.days} ${dayWord(info.days)}</span><span class="status-badge">${info.current.icon} ${info.current.name}</span></div><span class="lesson-count">✓ ${lessons} ${lessonWord(lessons)} · рекорд ${d.longestStreak||info.days}</span></div></div><div class="achievement-progress"><div class="achievement-copy"><b>${info.current.description}</b><span>${footer}</span></div><div class="progress-track" role="progressbar" aria-label="Прогресс до следующего статуса: ${percent}%" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><i style="width:${percent}%"></i></div></div>`;
}
function maybeCelebrateStatus(days){
 const info=getStreakStatus(days),key='wordsStreakStatus:'+TOKEN,seen=localStorage.getItem(key),level=info.current?info.current.days:0;
 if(seen===null){localStorage.setItem(key,String(level));return}
 if(level<=Number(seen)||!info.current)return;
 localStorage.setItem(key,String(level));
 const toast=document.createElement('div');toast.className='achievement-toast';toast.innerHTML=`<small>Новый статус!</small><b>${info.current.icon} ${info.current.name}</b><span>${info.days} ${dayWord(info.days)} подряд</span>`;document.body.appendChild(toast);setTimeout(()=>toast.remove(),4200);
}
