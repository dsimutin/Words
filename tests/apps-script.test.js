const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function loadServer(){
  const cacheValues=new Map();
  const cache={get:key=>cacheValues.get(key)||null,put:(key,value)=>cacheValues.set(key,value),remove:key=>cacheValues.delete(key)};
  const properties={SPREADSHEET_ID:'spreadsheet',TEACHER_KEY:'teacher-key',TEACHER_PIN:'1234',INITIAL_STUDENT_TOKEN:'initial-student'};
  const context={console,PropertiesService:{getScriptProperties:()=>({getProperty:name=>properties[name]||null})},CacheService:{getScriptCache:()=>cache},Utilities:{},Session:{getScriptTimeZone:()=> 'Europe/Moscow'}};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../apps-script/Code.gs'),'utf8'),context);
  return context;
}

test('серверный лимит заморозок равен семи',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../apps-script/Code.gs'),'utf8');
  assert.match(source,/const MAX_FREEZE_DAYS_ = 7;/);
  assert.doesNotMatch(source,/Math\.min\(2\s*,|freezeCount\s*<\s*2(?:\D|$)/);
});

test('остаток новых слов уменьшается и не бывает отрицательным',()=>{
  const server=loadServer();
  assert.equal(server.remainingStock_(200,57),143);
  assert.equal(server.remainingStock_(7,10),0);
});

test('данные ученика повторно берутся из кэша',()=>{
  const server=loadServer();
  let reads=0;
  const sheets={_Прогресс:{rows:[{token:'student',item_key:'one'}]},_Занятия:{rows:[{token:'student',total:7}]}};
  server.rowsAsObjects_=sheet=>{reads++;return sheet.rows};
  const spreadsheet={getSheetByName:name=>sheets[name]};
  assert.equal(server.studentData_(spreadsheet,'student').progress.length,1);
  assert.equal(server.studentData_(spreadsheet,'student').activity.length,1);
  assert.equal(reads,2);
  server.clearStudentDataCache_('student');
  server.studentData_(spreadsheet,'student');
  assert.equal(reads,4);
});

test('сервер возвращает до двадцати карточек одним вызовом',()=>{
  const server=loadServer(),student={token:'student',active:true,words_tab:'Words',language:'en',last_seen_at:new Date()};
  const studentsSheet={kind:'students',getRange:()=>({setValue(){}})},sourceSheet={kind:'source'};
  const spreadsheet={getSheetByName:name=>name==='_Ученики'?studentsSheet:sourceSheet};
  server.SpreadsheetApp={openById:()=>spreadsheet};
  server.rowsAsObjects_=sheet=>sheet.kind==='students'?[student]:Array.from({length:25},(_,i)=>({ID:String(i),Слово:'word-'+i,Перевод:'translation-'+i}));
  server.studentData_=()=>({progress:[],activity:[]});
  const lesson=server.loadLesson('student','word','new',[],20);
  assert.equal(lesson.items.length,20);
});

test('прогресс записывается только затронутыми диапазонами',()=>{
  const server=loadServer(),writes=[],sheet={getRange:(row,column,rows,columns)=>({setValues:values=>writes.push({row,column,rows,columns,values})})};
  const body=Array.from({length:5},(_,i)=>Array(11).fill(i));
  server.writeProgressChanges_(sheet,body,4,[1,2]);
  assert.deepEqual(writes.map(x=>[x.row,x.rows]),[[3,2],[6,1]]);
  assert.ok(writes.every(x=>x.columns===11));
});

test('метаданные ученика сохраняются одной записью',()=>{
  const server=loadServer(),writes=[];
  server.ensureStudentMetaColumns_=()=>({best_streak:9,freeze_count:10,last_achievement_days:17});
  const sheet={getRange:(row,column,rows,columns)=>({getValues:()=>[Array(columns).fill('')],setValues:values=>writes.push({row,column,rows,columns,values})})};
  server.saveStudentMeta_(sheet,3,{best_streak:12,freeze_count:4,last_achievement_days:7});
  assert.equal(writes.length,1);
  assert.deepEqual([writes[0].row,writes[0].column,writes[0].columns],[3,9,9]);
  assert.equal(writes[0].values[0][0],12);
  assert.equal(writes[0].values[0][1],4);
  assert.equal(writes[0].values[0][8],7);
});

test('домашняя работа выдаёт не больше семи предложений и сначала новые',()=>{
  const server=loadServer();
  const items=Array.from({length:15},(_,i)=>({row:i+2,id:String(i+1),status:i<3?'Верно':'Не проверено',attempts:i<3?1:0}));
  const selected=server.selectHomeworkItems_(items,7);
  assert.equal(selected.length,7);
  assert.ok(selected.every(item=>item.status==='Не проверено'));
  assert.deepEqual(selected.map(item=>item.id),['4','5','6','7','8','9','10']);
});

test('столбец домашней работы создаётся для старой таблицы учеников',()=>{
  const server=loadServer(),writes=[];
  const sheet={getLastColumn:()=>17,getRange:(row,column)=>({getValues:()=>[Array.from({length:17},(_,i)=>i===0?'token':'column-'+i)],setValue:value=>writes.push({row,column,value})})};
  assert.equal(server.ensureStudentHomeworkColumn_(sheet),18);
  assert.deepEqual(writes,[{row:1,column:18,value:'homework_tab'}]);
});

test('подтверждение ачивки не расходует заморозки',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../apps-script/Code.gs'),'utf8'),body=source.match(/function ackAchievement[\s\S]*?\n}\n/)[0];
  assert.doesNotMatch(body,/freeze_count|freezeCount/);
});

test('проверка домашней работы не зависит от регистра и пунктуации',()=>{
  const server=loadServer();
  assert.equal(server.normalizeHomeworkAnswer_('Please speak slowly!'),server.normalizeHomeworkAnswer_('Please speak slowly.'));
  assert.equal(server.gradeHomeworkAnswer_("i'm tired after work",'I am tired after work.','').result,'correct');
  assert.equal(server.gradeHomeworkAnswer_('Please speak slowly!','Please speak slowly.','').result,'correct');
  assert.equal(server.gradeHomeworkAnswer_('I speak some English.','I speak a little English.','').result,'wrong');
});

test('британское и американское написание считаются равнозначными',()=>{
  const server=loadServer();
  assert.equal(server.gradeHomeworkAnswer_('My neighbour is very polite.','My neighbor is very polite.','').result,'correct');
  assert.equal(server.gradeHomeworkAnswer_('This is my favourite colour.','This is my favorite color.','').result,'correct');
});

test('небольшая опечатка не мешает засчитать понятную структуру',()=>{
  const server=loadServer();
  assert.equal(server.gradeHomeworkAnswer_('She replid after lunch.','She replied after lunch.','').result,'correct');
});

test('понятная структура с опечаткой и пропущенным вспомогательным глаголом засчитывается',()=>{
  const server=loadServer(),grade=server.gradeHomeworkAnswer_('I tied after work.','I am tired after work.','');
  assert.equal(grade.result,'correct');
  assert.ok(grade.similarity>=.7);
});

test('допустимые варианты ответа разделяются вертикальной чертой',()=>{
  const server=loadServer();
  assert.equal(server.gradeHomeworkAnswer_('I am going to stay home.','I will stay home.','I am going to stay home. | I plan to stay home.').result,'correct');
});

test('перестановка слов засчитывается при совпадении структуры от 70 процентов',()=>{
  const server=loadServer(),grade=server.gradeHomeworkAnswer_('After work I am tired.','I am tired after work.','');
  assert.equal(grade.result,'correct');
  assert.ok(grade.similarity>=.7);
  assert.doesNotMatch(grade.message,/%/);
});

test('отрицание и замена ключевого смысла не проходят по проценту сходства',()=>{
  const server=loadServer();
  assert.equal(server.gradeHomeworkAnswer_('I am not tired after work.','I am tired after work.','').result,'wrong');
  assert.equal(server.gradeHomeworkAnswer_('I am happy after work.','I am tired after work.','').result,'wrong');
});

test('simple и continuous можно явно добавить как допустимые варианты',()=>{
  const server=loadServer();
  assert.equal(server.gradeHomeworkAnswer_('I go to work.','I am going to work.','I go to work.').result,'correct');
});

test('ошибка с explain получает понятное грамматическое пояснение',()=>{
  const server=loadServer();
  const result=server.gradeHomeworkAnswer_('Could you explain me this word?','Can you explain this word to me?','');
  assert.equal(result.result,'wrong');
  assert.match(result.message,/после explain.*to me/i);
});

test('дата заморозки из ячейки Date сохраняет серию',()=>{
  const server=loadServer();server.Utilities.formatDate=value=>value.toISOString().slice(0,10);
  assert.equal(server.freezeDates_({freeze_dates:new Date('2026-08-03T00:00:00Z')}).join(','),'2026-08-03');
});

test('клиент сохраняет домашнюю работу после каждого проверенного ответа',()=>{
  const client=fs.readFileSync(path.join(__dirname,'../docs/index.html'),'utf8');
  assert.match(client,/saveHomeworkSession\(homeworkIndex\+1\)/);
  assert.match(client,/wordsHomeworkSession:/);
  assert.match(client,/Date\.now\(\)-Number\(saved\.savedAt\|\|0\)>7\*86400000/);
});

test('завершённая домашняя работа записывается как дневное занятие',()=>{
  const server=fs.readFileSync(path.join(__dirname,'../apps-script/Code.gs'),'utf8'),client=fs.readFileSync(path.join(__dirname,'../docs/index.html'),'utf8');
  assert.match(server,/function finishHomeworkSession/);
  assert.match(server,/appendRow\(\[now,token,'homework'/);
  assert.match(client,/finishHomeworkSession',TOKEN,homeworkScore/);
});

test('кабинет учителя автоматически суммирует последние ответы',()=>{
  const server=loadServer(),sheet={};
  server.homeworkRows_=()=>[
    {row:2,prompt:'Первое',answer:'First',correct:'First',status:'Верно',hint:'Нет',attempts:1,attemptedAt:'2026-08-05T10:00:00Z'},
    {row:3,prompt:'Второе',answer:'Second?',correct:'Second',status:'Почти верно',hint:'Да · уровень 1',attempts:2,attemptedAt:'2026-08-05T10:01:00Z'},
    {row:4,prompt:'Третье',answer:'Wrong',correct:'Third',status:'Неверно',hint:'Да · уровень 2',attempts:1,attemptedAt:'2026-08-05T10:02:00Z'}
  ];
  server.dateIso_=value=>String(value||'');
  const summary=server.homeworkSummaryForStudent_({getSheetByName:()=>sheet},{name:'Student'});
  assert.deepEqual([summary.correct,summary.almost,summary.wrong,summary.hints],[1,1,1,2]);
  assert.equal(summary.problems.length,2);
  assert.equal(summary.problems[0].prompt,'Третье');
});
