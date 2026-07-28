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
