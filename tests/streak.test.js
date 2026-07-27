const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function previous(key){const p=key.split('-').map(Number);return new Date(Date.UTC(p[0],p[1]-1,p[2])-86400000).toISOString().slice(0,10)}
function streak(keys,today){const unique={};keys.forEach(key=>{if(/^\d{4}-\d{2}-\d{2}$/.test(key)&&key<=today)unique[key]=true});const days=Object.keys(unique).sort();if(!days.length)return{current:0,longest:0};let longest=1,run=1;for(let i=1;i<days.length;i++){run=previous(days[i])===days[i-1]?run+1:1;longest=Math.max(longest,run)}const last=days.at(-1);if(last!==today&&last!==previous(today))return{current:0,longest};let current=0,cursor=last;while(unique[cursor]){current++;cursor=previous(cursor)}return{current,longest}}

const statusSource=fs.readFileSync(require('node:path').join(__dirname,'../docs/streak.js'),'utf8');
const stored={};
const statusContext={TOKEN:'test-student',setTimeout(){},localStorage:{getItem(key){return stored[key]??null},setItem(key,value){stored[key]=String(value)}},document:{}};
vm.createContext(statusContext);vm.runInContext(statusSource,statusContext);
const status=days=>JSON.parse(JSON.stringify(statusContext.getStreakStatus(days)));

test('первая завершённая тренировка начинает серию',()=>assert.equal(streak(['2026-07-17'],'2026-07-17').current,1));
test('два урока за день считаются одним днём',()=>assert.equal(streak(['2026-07-17','2026-07-17'],'2026-07-17').current,1));
test('два последовательных дня',()=>assert.equal(streak(['2026-07-16','2026-07-17'],'2026-07-17').current,2));
test('серия сохраняется до конца следующего дня',()=>assert.equal(streak(['2026-07-16'],'2026-07-17').current,1));
test('пропущенный полный день сбрасывает текущую серию',()=>assert.equal(streak(['2026-07-15'],'2026-07-17').current,0));
test('переход между месяцами',()=>assert.equal(streak(['2026-06-30','2026-07-01'],'2026-07-01').current,2));
test('переход между годами',()=>assert.equal(streak(['2025-12-31','2026-01-01'],'2026-01-01').current,2));
test('будущая дата игнорируется',()=>assert.equal(streak(['2026-07-18'],'2026-07-17').current,0));
test('пустые и некорректные данные безопасны',()=>assert.equal(streak(['bad',''],'2026-07-17').current,0));
for(const [days,next] of [[2,3],[6,7],[20,21],[29,30],[364,365]])test(`следующий статус после ${days} дней`,()=>assert.equal(status(days).next.days,next));
test('максимальный статус после 365 дней',()=>{assert.equal(status(365).max,true);assert.equal(status(500).progress,1)});
test('прогресс считается внутри диапазона',()=>assert.equal(status(23).progress,2/9));
test('можно выбрать палитру полученной медали',()=>{stored['wordsPalette:test-student']='rhythm';assert.equal(statusContext.selectedPalette(7,{id:'fallback'}).id,'rhythm')});
test('палитра неполученной медали недоступна',()=>{stored['wordsPalette:test-student']='legend';assert.equal(statusContext.selectedPalette(7,{id:'fallback'}).id,'fallback')});
