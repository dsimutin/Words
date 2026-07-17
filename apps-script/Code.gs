const CONFIG = {
  spreadsheetId: '1SR3JT0DmBRByGmNmINLToP-kIZizOfCAQkVTB7MSlVc',
  teacherKey: 'd1ab21ee97e68c0e740e22dcf472b2a20bb394353847bc80',
  teacherPin: '2565',
  initialStudentToken: '3f4298b9fcf6e5f78920196bf6c9dffc5a5d',
  lessonSize: 7,
  sheets: { students: '_Ученики', progress: '_Прогресс', activity: '_Занятия' }
};

function doGet(e) {
  if(e&&e.parameter&&e.parameter.api==='1')return apiRequest_(e);
  const template = HtmlService.createTemplateFromFile('Index');
  template.token = String((e && e.parameter.token) || '');
  template.teacher = String((e && e.parameter.teacher) || '');
  template.webAppUrl = 'https://script.google.com/macros/s/AKfycbzXGwwZqhBFhVkdWnY84sz4YAc-iTSqShHS9PDfTaNq6uDQF-geMDTpUk4zptzNLnHarQ/exec';
  return template.evaluate().setTitle('Words')
    .setFaviconUrl('https://lh3.googleusercontent.com/d/1M141ehKijGxafADGkXv8CJ8ZO3SwTeSG=w180-h180?icon.png')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

function apiRequest_(e){
  const callback=String(e.parameter.callback||'').replace(/[^a-zA-Z0-9_.$]/g,'');
  if(!callback)throw new Error('Callback is required.');
  const allowed={bootstrap:bootstrap,loadLesson:loadLesson,progressDetails:progressDetails,saveLesson:saveLesson,teacherDashboard:teacherDashboard,sourceTabs:sourceTabs,createStudent:createStudent,updateStudent:updateStudent,setStudentActive:setStudentActive,resetStudentProgress:resetStudentProgress,deleteStudent:deleteStudent};
  const action=String(e.parameter.action||''),fn=allowed[action];
  let response;
  try{
    if(!fn)throw new Error('Неизвестная команда API.');
    const args=JSON.parse(String(e.parameter.args||'[]'));
    response={ok:true,data:fn.apply(null,args)};
  }catch(error){response={ok:false,error:String(error&&error.message||error)};}
  return ContentService.createTextOutput(callback+'('+JSON.stringify(response)+');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function setupProject() { setupProject_(); return { ok:true, webAppUrl:ScriptApp.getService().getUrl() || '' }; }

function setupProject_() {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  ensureSheet_(ss, CONFIG.sheets.students,
    ['token','name','words_tab','verbs_tab','active','created_at','last_seen_at','language','best_streak','freeze_count','freeze_dates','freeze_bonus_date','seven_day_freeze_awarded','welcome_freeze_awarded']);
  ensureSheet_(ss, CONFIG.sheets.progress,
    ['token','item_key','category','word','level','correct','wrong','next_review_at','updated_at','streak','last_result']);
  ensureSheet_(ss, CONFIG.sheets.activity,
    ['timestamp','token','category','score','total','known','unknown','recovered','session_id']);
  const students = ss.getSheetByName(CONFIG.sheets.students);
  if (students.getLastRow() === 1) students.appendRow([
    CONFIG.initialStudentToken,'Christina','Christina','Глаголы',true,new Date(),'','en'
  ]);
  rowsAsObjects_(students).forEach(s => {
    ensureSourceIds_(ss.getSheetByName(s.words_tab));
    if (s.verbs_tab) ensureSourceIds_(ss.getSheetByName(s.verbs_tab));
  });
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name); if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.getRange(1,1,1,headers.length).setValues([headers]);
  const existing = sheet.getRange(1,1,1,Math.max(1,sheet.getLastColumn())).getValues()[0].map(String);
  headers.forEach(h => { if (existing.indexOf(h) < 0) { sheet.getRange(1,sheet.getLastColumn()+1).setValue(h); existing.push(h); } });
  sheet.setFrozenRows(1); sheet.getRange(1,1,1,sheet.getLastColumn()).setFontWeight('bold').setBackground('#eaf4ef');
  return sheet;
}

function ensureSourceIds_(sheet) {
  if (!sheet || sheet.getLastRow() < 1) return;
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  let col = headers.indexOf('ID') + 1;
  if (!col) { col = sheet.getLastColumn()+1; sheet.getRange(1,col).setValue('ID'); }
  if (sheet.getLastRow() < 2) return;
  const range = sheet.getRange(2,col,sheet.getLastRow()-1,1), vals = range.getValues();
  let changed=false; vals.forEach(r => { if (!r[0]) { r[0]=Utilities.getUuid(); changed=true; } });
  if (changed) range.setValues(vals);
}

function bootstrap(token, teacherKey, timeZone) {
  if (teacherKey && isTeacher_(teacherKey)) return { role:'teacher',dashboard:teacherDashboard_(),tabs:sourceTabs_() };
  const ss=SpreadsheetApp.openById(CONFIG.spreadsheetId),studentsSheet=ss.getSheetByName(CONFIG.sheets.students);
  const students=rowsAsObjects_(studentsSheet),studentIndex=students.findIndex(x=>secureEqual_(String(x.token),String(token)));
  const student=studentIndex>=0?students[studentIndex]:null;
  if(!student||!truthy_(student.active))throw new Error('Ссылка недействительна или отключена.');
  if(!truthy_(student.welcome_freeze_awarded)){
    const columns=ensureStudentMetaColumns_(studentsSheet),row=studentIndex+2,count=Math.min(2,Math.max(0,Number(student.freeze_count||0))+1);
    studentsSheet.getRange(row,columns.freeze_count).setValue(count);studentsSheet.getRange(row,columns.welcome_freeze_awarded).setValue(true);student.freeze_count=count;student.welcome_freeze_awarded=true;
  }
  studentsSheet.getRange(studentIndex+2,7).setValue(new Date());
  const p=rowsAsObjects_(ss.getSheetByName(CONFIG.sheets.progress)).filter(x=>x.token===token),now=new Date();
  const activity=rowsAsObjects_(ss.getSheetByName(CONFIG.sheets.activity)).filter(x=>String(x.token)===String(token)),streak=streakStatsForStudent_(activity,student,timeZone,now),bestStreak=Math.max(Number(student.best_streak||0),streak.longest);
  const summary={studied:p.length,learned:p.filter(x=>Number(x.level)>=3).length,almost:p.filter(x=>Number(x.level)===2).length,due:p.filter(x=>new Date(x.next_review_at||0)<=now).length,today:activity.filter(x=>dateKey_(x.timestamp,timeZone)===streak.todayKey).length};
  const counts={words:sourceRowCount_(ss.getSheetByName(student.words_tab)),verbs:sourceRowCount_(ss.getSheetByName(student.verbs_tab))};
  return { role:'student',student:{name:student.name,language:String(student.language||'en')},counts:counts,
    studied:summary.studied,learned:summary.learned,almost:summary.almost,due:summary.due,today:summary.today,streak:streak.current,longestStreak:bestStreak,totalLessons:activity.length,freezeCount:Math.max(0,Math.min(2,Number(student.freeze_count||0))) };
}

function dateKey_(value,timeZone){
  const date=value instanceof Date?value:new Date(value);if(isNaN(date.getTime()))return'';
  try{return Utilities.formatDate(date,String(timeZone||Session.getScriptTimeZone()),'yyyy-MM-dd');}catch(e){return Utilities.formatDate(date,Session.getScriptTimeZone(),'yyyy-MM-dd');}
}
function previousDateKey_(key){const p=String(key||'').split('-').map(Number);if(p.length!==3||p.some(x=>!x))return'';return new Date(Date.UTC(p[0],p[1]-1,p[2])-86400000).toISOString().slice(0,10);}
function streakStatsFromKeys_(keys,todayKey){
  const unique={};(keys||[]).forEach(key=>{key=String(key||'');if(/^\d{4}-\d{2}-\d{2}$/.test(key)&&key<=todayKey)unique[key]=true;});
  const days=Object.keys(unique).sort();if(!days.length)return{current:0,longest:0,todayKey:todayKey};
  let longest=1,run=1;for(let i=1;i<days.length;i++){run=previousDateKey_(days[i])===days[i-1]?run+1:1;if(run>longest)longest=run;}
  const last=days[days.length-1],yesterday=previousDateKey_(todayKey);if(last!==todayKey&&last!==yesterday)return{current:0,longest:longest,todayKey:todayKey};
  let current=0,cursor=last;while(unique[cursor]){current++;cursor=previousDateKey_(cursor);}
  return{current:current,longest:longest,todayKey:todayKey};
}
function streakStats_(activity,timeZone,now){const todayKey=dateKey_(now||new Date(),timeZone),keys=(activity||[]).map(x=>dateKey_(x.timestamp,timeZone)).filter(Boolean),stats=streakStatsFromKeys_(keys,todayKey);stats.totalLessons=(activity||[]).length;return stats;
}

function freezeDates_(student){return String(student&&student.freeze_dates||'').split(',').map(x=>x.trim()).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x));}
function streakStatsForStudent_(activity,student,timeZone,now){
  const todayKey=dateKey_(now||new Date(),timeZone),keys=(activity||[]).map(x=>dateKey_(x.timestamp,timeZone)).filter(Boolean).concat(freezeDates_(student)),stats=streakStatsFromKeys_(keys,todayKey);stats.totalLessons=(activity||[]).length;return stats;
}
function dayDistance_(fromKey,toKey){const a=new Date(String(fromKey)+'T00:00:00Z'),b=new Date(String(toKey)+'T00:00:00Z');return isNaN(a.getTime())||isNaN(b.getTime())?0:Math.round((b-a)/86400000);}

function ensureStudentMetaColumns_(sheet){
  const names=['best_streak','freeze_count','freeze_dates','freeze_bonus_date','seven_day_freeze_awarded','welcome_freeze_awarded'],headers=sheet.getRange(1,1,1,Math.max(1,sheet.getLastColumn())).getValues()[0].map(String),columns={};
  names.forEach(name=>{let col=headers.indexOf(name)+1;if(!col){col=sheet.getLastColumn()+1;sheet.getRange(1,col).setValue(name);headers.push(name);}columns[name]=col;});
  return columns;
}

function saveBestStreak_(studentsSheet,rowNumber,value){
  const column=ensureStudentMetaColumns_(studentsSheet).best_streak;
  const old=Number(studentsSheet.getRange(rowNumber,column).getValue()||0),best=Math.max(old,Number(value||0));
  if(best!==old)studentsSheet.getRange(rowNumber,column).setValue(best);
  return best;
}

function saveStudentMeta_(sheet,rowNumber,student){
  const columns=ensureStudentMetaColumns_(sheet);
  Object.keys(columns).forEach(name=>sheet.getRange(rowNumber,columns[name]).setValue(student[name]===undefined?'':student[name]));
}

function loadLesson(token, category, mode, excludeKeys) {
  const ss=SpreadsheetApp.openById(CONFIG.spreadsheetId),studentsSheet=ss.getSheetByName(CONFIG.sheets.students);
  const students=rowsAsObjects_(studentsSheet),studentIndex=students.findIndex(x=>secureEqual_(String(x.token),String(token)));
  const student=studentIndex>=0?students[studentIndex]:null;
  if(!student||!truthy_(student.active))throw new Error('Ссылка недействительна или отключена.');
  category=category==='verb'?'verb':'word';
  const tab=category==='verb'?student.verbs_tab:student.words_tab;
  let items=readItemsFromSheet_(ss.getSheetByName(tab),category,tab);
  const excluded={};(Array.isArray(excludeKeys)?excludeKeys:[]).forEach(key=>excluded[String(key)]=true);
  items=items.filter(x=>!excluded[String(x.key)]);
  const progressRows=rowsAsObjects_(ss.getSheetByName(CONFIG.sheets.progress));
  const progress={}; progressRows.forEach(r=>{if(r.token===token&&r.category===category)progress[r.item_key]=r;});
  const now=new Date();
  items.forEach(x => { const p=progress[x.key]; x.state=!p?'Новое':Number(p.level)>=3?'Закреплено':'Повторение'; x.level=p?Number(p.level||0):0; });
  const due=items.filter(x=>progress[x.key] && new Date(progress[x.key].next_review_at||0)<=now);
  const unseen=items.filter(x=>!progress[x.key]);
  const difficult=items.filter(x=>progress[x.key]&&Number(progress[x.key].wrong||0)>0).sort((a,b)=>Number(progress[b.key].wrong||0)-Number(progress[a.key].wrong||0));
  const learned=items.filter(x=>progress[x.key]&&Number(progress[x.key].level||0)>=3);
  const later=items.filter(x=>progress[x.key] && new Date(progress[x.key].next_review_at||0)>now);
  shuffle_(unseen); shuffle_(later);due.sort((a,b)=>Number(progress[b.key].wrong||0)-Number(progress[a.key].wrong||0));
  mode=String(mode||'mixed');let selected;
  if(mode==='mixed'){
    const repeatLimit=due.length>3?4:due.length,newLimit=CONFIG.lessonSize-repeatLimit;
    selected=due.slice(0,repeatLimit).concat(unseen.slice(0,newLimit));
    if(selected.length<CONFIG.lessonSize)selected=selected.concat(due.slice(repeatLimit),unseen.slice(newLimit),later).slice(0,CONFIG.lessonSize);
  }else{
    const pool=mode==='new'?unseen:mode==='review'?due:mode==='learned'?learned:mode==='difficult'?difficult:due.concat(unseen,later);selected=pool.slice(0,CONFIG.lessonSize);
  }
  selected.forEach(x=>x.language=String(student.language||'en')); studentsSheet.getRange(studentIndex+2,7).setValue(now);
  return {category:category,mode:mode,total:selected.length,items:selected};
}

function progressDetails(token,type){
  requireStudent_(token);type=String(type||'studied');
  const now=new Date(),rows=rowsAsObjects_(SpreadsheetApp.openById(CONFIG.spreadsheetId).getSheetByName(CONFIG.sheets.progress)).filter(x=>String(x.token)===String(token));
  const filtered=type==='learned'?rows.filter(x=>Number(x.level)>=3):type==='due'?rows.filter(x=>new Date(x.next_review_at||0)<=now):rows;
  return{type:type,items:filtered.map(x=>({key:String(x.item_key||''),word:String(x.word||''),category:String(x.category||'word'),level:Number(x.level||0),correct:Number(x.correct||0),wrong:Number(x.wrong||0)})).filter(x=>x.word).sort((a,b)=>a.word.localeCompare(b.word))};
}

function getImageData(token,fileId) {
  const student=requireStudent_(token); if(!fileId)return '';
  const allowed=readItems_(student,'word').concat(readItems_(student,'verb')).some(x=>x.imageFileId===String(fileId));
  if(!allowed)throw new Error('Изображение не относится к карточкам ученика.');
  const blob=DriveApp.getFileById(String(fileId)).getBlob();
  return 'data:'+blob.getContentType()+';base64,'+Utilities.base64Encode(blob.getBytes());
}

function saveLesson(token,payload) {
  const lock=LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const cache=CacheService.getScriptCache(),sessionKey='lesson:'+token+':'+String(payload.sessionId||'');
    if(payload.sessionId&&cache.get(sessionKey))return{ok:true,duplicate:true,summary:studentSummary_(token,payload.timeZone)};
    const ss=SpreadsheetApp.openById(CONFIG.spreadsheetId),studentsSheet=ss.getSheetByName(CONFIG.sheets.students);
    const activitySheet=ensureSheet_(ss,CONFIG.sheets.activity,['timestamp','token','category','score','total','known','unknown','recovered','session_id']);
    const activityRows=rowsAsObjects_(activitySheet);
    if(payload.sessionId&&activityRows.some(r=>String(r.token)===String(token)&&String(r.session_id)===String(payload.sessionId))){
      if(payload.sessionId)cache.put(sessionKey,'1',600);
      return{ok:true,duplicate:true,summary:studentSummary_(token,payload.timeZone)};
    }
    const students=studentsSheet.getDataRange().getValues(),headers=students[0].map(String),studentRow=students.findIndex((r,i)=>i>0&&secureEqual_(String(r[0]),String(token))&&truthy_(r[4]));
    if(studentRow<1)throw new Error('Ссылка недействительна или отключена.');
    const student={};headers.forEach((name,i)=>student[name]=students[studentRow][i]);
    const sheet=ss.getSheetByName(CONFIG.sheets.progress),data=sheet.getDataRange().getValues(),body=data.slice(1),idx={};
    body.forEach((r,i)=>idx[String(r[0])+'|'+String(r[1])]=i); const now=new Date();
    (payload.answers||[]).forEach(a => {
      const k=token+'|'+a.key,rowIndex=idx[k],old=rowIndex===undefined?null:body[rowIndex];
      let level=old?Number(old[4]||0):0,correct=old?Number(old[5]||0):0,wrong=old?Number(old[6]||0):0,streak=old?Number(old[9]||0):0;
      const passed=Boolean(a.quizCorrect);
      if(passed){streak++;correct++;level=Math.min(level+1,5);}else{streak=0;wrong++;level=Math.max(0,level-1);}
      const hours=passed?({1:8,2:24,3:72,4:168,5:336}[level]||8):0;
      const row=[token,a.key,payload.category,a.word,level,correct,wrong,new Date(now.getTime()+hours*3600000),now,streak,passed?'correct':'wrong'];
      if(rowIndex===undefined){idx[k]=body.length;body.push(row);}else body[rowIndex]=row;
    });
    if(body.length)sheet.getRange(2,1,body.length,11).setValues(body);
    activitySheet.appendRow([now,token,payload.category,Number(payload.score||0),Number(payload.total||0),Number(payload.known||0),Number(payload.unknown||0),Number(payload.recovered||0),String(payload.sessionId||'')]);
    studentsSheet.getRange(studentRow+1,7).setValue(now);
    if(payload.sessionId)cache.put(sessionKey,'1',600);
    const p=body.filter(r=>String(r[0])===String(token)),studentActivity=activityRows.filter(r=>String(r.token)===String(token)),todayKey=dateKey_(now,payload.timeZone);
    let freezeCount=Math.max(0,Math.min(2,Number(student.freeze_count||0))),freezeDates=freezeDates_(student),freezeUsed=false,freezeEarned=false,freezeReason='';
    const previousKeys=studentActivity.map(r=>dateKey_(r.timestamp,payload.timeZone)).filter(k=>k&&k<todayKey).sort(),lastKey=previousKeys[previousKeys.length-1]||'';
    if(lastKey&&dayDistance_(lastKey,todayKey)===2&&freezeCount>0){
      const missed=previousDateKey_(todayKey);if(freezeDates.indexOf(missed)<0){freezeDates.push(missed);freezeCount--;freezeUsed=true;}
    }
    student.freeze_dates=freezeDates.join(',');student.freeze_count=freezeCount;
    const updatedActivity=studentActivity.concat([{timestamp:now,score:Number(payload.score||0),total:Number(payload.total||0)}]),streak=streakStatsForStudent_(updatedActivity,student,payload.timeZone,now);
    const bestStreak=Math.max(Number(student.best_streak||0),streak.longest);student.best_streak=bestStreak;
    if(bestStreak>=7&&!truthy_(student.seven_day_freeze_awarded)&&freezeCount<2){freezeCount++;student.seven_day_freeze_awarded=true;freezeEarned=true;freezeReason='7 дней подряд';}
    const qualifyingToday=updatedActivity.filter(r=>dateKey_(r.timestamp,payload.timeZone)===todayKey&&Number(r.total||0)>=7&&Number(r.score||0)>=5).length;
    if(qualifyingToday>=3&&String(student.freeze_bonus_date||'')!==todayKey&&freezeCount<2){freezeCount++;student.freeze_bonus_date=todayKey;freezeEarned=true;freezeReason='третье занятие за день';}
    student.freeze_count=freezeCount;saveStudentMeta_(studentsSheet,studentRow+1,student);
    return {ok:true,summary:{studied:p.length,learned:p.filter(r=>Number(r[4])>=3).length,almost:p.filter(r=>Number(r[4])===2).length,due:p.filter(r=>new Date(r[7]||0)<=now).length,today:updatedActivity.filter(r=>dateKey_(r.timestamp,payload.timeZone)===todayKey).length,streak:streak.current,longestStreak:bestStreak,totalLessons:streak.totalLessons,freezeCount:freezeCount,freezeEarned:freezeEarned,freezeUsed:freezeUsed,freezeReason:freezeReason}};
  } finally { lock.releaseLock(); }
}

function teacherDashboard(teacherKey){if(!isTeacher_(teacherKey))throw new Error('Нет доступа.');return teacherDashboard_();}
function sourceTabs(teacherKey){if(!isTeacher_(teacherKey))throw new Error('Нет доступа.');return sourceTabs_();}

function sourceTabs_(){
  const cache=CacheService.getScriptCache(),cached=cache.get('source-tabs-v6');if(cached)return JSON.parse(cached);
  const ss=SpreadsheetApp.openById(CONFIG.spreadsheetId),result={words:[],verbs:[]};
  ss.getSheets().forEach(sheet=>{
    const name=sheet.getName();if(name.charAt(0)==='_')return;
    const headers=sheet.getLastColumn()?sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String):[];
    const spanish=headers.indexOf('Español')>=0||headers.indexOf('Infinitivo')>=0||/espa[nñ]ol|spanish|испан/i.test(name),verb=headers.indexOf('Verb')>=0||headers.indexOf('Infinitivo')>=0||/глагол|verbs?|verbos?/i.test(name);
    (verb?result.verbs:result.words).push({name:name,language:spanish?'es':'en'});
  });
  result.words.sort((a,b)=>a.name.localeCompare(b.name));result.verbs.sort((a,b)=>a.name.localeCompare(b.name));
  cache.put('source-tabs-v6',JSON.stringify(result),300);return result;
}

function teacherDashboard_() {
  const ss=SpreadsheetApp.openById(CONFIG.spreadsheetId),students=rowsAsObjects_(ss.getSheetByName(CONFIG.sheets.students));
  const progress=rowsAsObjects_(ss.getSheetByName(CONFIG.sheets.progress)),activity=rowsAsObjects_(ss.getSheetByName(CONFIG.sheets.activity));
  const now=Date.now(),day=86400000;
  return students.map(s => {
    const p=progress.filter(x=>x.token===s.token),a=activity.filter(x=>x.token===s.token);
    const recent=a.slice(-8).reverse().map(x=>({date:dateIso_(x.timestamp),category:x.category,score:Number(x.score||0),total:Number(x.total||0)}));
    const difficult=p.slice().sort((x,y)=>Number(y.wrong||0)-Number(x.wrong||0)).filter(x=>Number(x.wrong||0)>0).slice(0,5).map(x=>({word:String(x.word),wrong:Number(x.wrong||0)}));
    const last=a.length?a[a.length-1]:null, byCat=c=>p.filter(x=>x.category===c);
    return {name:s.name,active:truthy_(s.active),token:s.token,wordsTab:s.words_tab,verbsTab:s.verbs_tab,language:String(s.language||'en'),
      lastSeen:dateIso_(s.last_seen_at),studied:p.length,learned:p.filter(x=>Number(x.level)>=3).length,
      words:{studied:byCat('word').length,learned:byCat('word').filter(x=>Number(x.level)>=3).length},
      verbs:{studied:byCat('verb').length,learned:byCat('verb').filter(x=>Number(x.level)>=3).length},
      today:a.filter(x=>now-new Date(x.timestamp).getTime()<day).length,
      week:a.filter(x=>now-new Date(x.timestamp).getTime()<7*day).length,
      lastScore:last?Number(last.score)+'/'+Number(last.total):'—',difficult:difficult,history:recent};
  });
}

function createStudent(teacherKey,data) {
  if(!isTeacher_(teacherKey))throw new Error('Нет доступа.');
  const name=String(data.name||'').trim(),wordsTab=String(data.wordsTab||'').trim(),verbsTab=String(data.verbsTab||'').trim(),language=data.language==='es'?'es':'en';
  if(!name||!wordsTab)throw new Error('Укажите имя и вкладку со словами.');
  const ss=SpreadsheetApp.openById(CONFIG.spreadsheetId);
  if(!ss.getSheetByName(wordsTab))throw new Error('Вкладка «'+wordsTab+'» не найдена.');
  if(verbsTab&&!ss.getSheetByName(verbsTab))throw new Error('Вкладка «'+verbsTab+'» не найдена.');
  ensureSourceIds_(ss.getSheetByName(wordsTab)); if(verbsTab)ensureSourceIds_(ss.getSheetByName(verbsTab));
  const token=Utilities.getUuid().replace(/-/g,''); ss.getSheetByName(CONFIG.sheets.students).appendRow([token,name,wordsTab,verbsTab,true,new Date(),'',language]);
  return {ok:true,token:token,dashboard:teacherDashboard_()};
}

function updateStudent(teacherKey,token,data){
  if(!isTeacher_(teacherKey))throw new Error('Нет доступа.');
  const name=String(data.name||'').trim(),wordsTab=String(data.wordsTab||'').trim(),verbsTab=String(data.verbsTab||'').trim(),language=data.language==='es'?'es':'en';
  if(!name||!wordsTab)throw new Error('Укажите имя и вкладку со словами.');
  const ss=SpreadsheetApp.openById(CONFIG.spreadsheetId);if(!ss.getSheetByName(wordsTab))throw new Error('Вкладка «'+wordsTab+'» не найдена.');if(verbsTab&&!ss.getSheetByName(verbsTab))throw new Error('Вкладка «'+verbsTab+'» не найдена.');
  const sheet=ss.getSheetByName(CONFIG.sheets.students),rows=sheet.getDataRange().getValues();
  for(let i=1;i<rows.length;i++)if(String(rows[i][0])===String(token)){sheet.getRange(i+1,2,1,3).setValues([[name,wordsTab,verbsTab]]);sheet.getRange(i+1,8).setValue(language);return teacherDashboard_();}
  throw new Error('Ученик не найден.');
}

function setStudentActive(teacherKey,token,active){
  if(!isTeacher_(teacherKey))throw new Error('Нет доступа.');
  const sheet=SpreadsheetApp.openById(CONFIG.spreadsheetId).getSheetByName(CONFIG.sheets.students),v=sheet.getDataRange().getValues();
  for(let i=1;i<v.length;i++)if(v[i][0]===token)sheet.getRange(i+1,5).setValue(Boolean(active));
  return teacherDashboard_();
}

function resetStudentProgress(teacherKey,token){
  if(!isTeacher_(teacherKey))throw new Error('Нет доступа.');
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try{
    const ss=SpreadsheetApp.openById(CONFIG.spreadsheetId);
    [CONFIG.sheets.progress,CONFIG.sheets.activity].forEach(name=>{
      const sheet=ss.getSheetByName(name),data=sheet.getDataRange().getValues();
      if(data.length<2)return;
      const tokenColumn=name===CONFIG.sheets.activity?1:0;
      const kept=data.slice(1).filter(r=>String(r[tokenColumn])!==String(token));
      sheet.getRange(2,1,Math.max(1,sheet.getLastRow()-1),sheet.getLastColumn()).clearContent();
      if(kept.length)sheet.getRange(2,1,kept.length,kept[0].length).setValues(kept);
    });
    const students=ss.getSheetByName(CONFIG.sheets.students),rows=students.getDataRange().getValues();
    for(let i=1;i<rows.length;i++)if(String(rows[i][0])===String(token))students.getRange(i+1,7).clearContent();
    return teacherDashboard_();
  }finally{lock.releaseLock();}
}

function deleteStudent(teacherKey,token){
  if(!isTeacher_(teacherKey))throw new Error('Нет доступа.');
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try{
    const ss=SpreadsheetApp.openById(CONFIG.spreadsheetId);
    [CONFIG.sheets.progress,CONFIG.sheets.activity].forEach(name=>{
      const sheet=ss.getSheetByName(name),data=sheet.getDataRange().getValues();if(data.length<2)return;
      const tokenColumn=name===CONFIG.sheets.activity?1:0,kept=data.slice(1).filter(r=>String(r[tokenColumn])!==String(token));
      sheet.getRange(2,1,Math.max(1,sheet.getLastRow()-1),sheet.getLastColumn()).clearContent();
      if(kept.length)sheet.getRange(2,1,kept.length,kept[0].length).setValues(kept);
    });
    const students=ss.getSheetByName(CONFIG.sheets.students),rows=students.getDataRange().getValues();
    for(let i=rows.length-1;i>=1;i--)if(String(rows[i][0])===String(token))students.deleteRow(i+1);
    return teacherDashboard_();
  }finally{lock.releaseLock();}
}

function readItems_(student,category) {
  const ss=SpreadsheetApp.openById(CONFIG.spreadsheetId),tab=category==='verb'?student.verbs_tab:student.words_tab;if(!tab)return [];
  return readItemsFromSheet_(ss.getSheetByName(tab),category,tab);
}

function readItemsFromSheet_(sheet,category,tab) {
  if(!sheet)return [];
  const rows=rowsAsObjects_(sheet); return rows.map((r,index)=>{
    const word=category==='verb'?(r['Verb']||r['Infinitivo']):(r['Слово']||r['Español']||r['English']||r['Inglés']),translation=r['Перевод'];if(!word||!translation)return null;
    return {key:String(r['ID']||category+':'+tab+':'+(index+2)),category:category,word:String(word),translation:String(translation),
      transcription:String(category==='verb'?'':(r['Транскрипция']||'')),example:String(category==='verb'?(r['Example']||r['Ejemplo']||''):(r['Пример']||'')),exampleTranslation:String(r['Перевод примера']||r['Example translation']||r['Traducción del ejemplo']||''),difficulty:String(r['Сложность']||''),
      present:String(r['Presente (yo)']||''),pastSimple:String(r['Past Simple']||r['Pretérito (yo)']||''),pastParticiple:String(r['Past Participle']||r['Participio']||''),imageFileId:String(r['Image file ID']||'')};
  }).filter(Boolean);
}

function sourceRowCount_(sheet){return sheet?Math.max(0,sheet.getLastRow()-1):0;}

function countSourceItems_(s){return{words:readItems_(s,'word').length,verbs:readItems_(s,'verb').length};}
function studentSummary_(token,timeZone){
  const ss=SpreadsheetApp.openById(CONFIG.spreadsheetId),student=rowsAsObjects_(ss.getSheetByName(CONFIG.sheets.students)).find(x=>String(x.token)===String(token))||{},p=rowsAsObjects_(ss.getSheetByName(CONFIG.sheets.progress)).filter(x=>String(x.token)===String(token)),activity=rowsAsObjects_(ss.getSheetByName(CONFIG.sheets.activity)).filter(x=>String(x.token)===String(token)),now=new Date(),streak=streakStatsForStudent_(activity,student,timeZone,now),today=activity.filter(x=>dateKey_(x.timestamp,timeZone)===streak.todayKey).length,best=Math.max(Number(student.best_streak||0),streak.longest);
  return{studied:p.length,learned:p.filter(x=>Number(x.level)>=3).length,almost:p.filter(x=>Number(x.level)===2).length,due:p.filter(x=>new Date(x.next_review_at||0)<=now).length,today:today,streak:streak.current,longestStreak:best,totalLessons:activity.length,freezeCount:Math.max(0,Math.min(2,Number(student.freeze_count||0)))};
}
function progressMap_(token,category){const rows=rowsAsObjects_(SpreadsheetApp.openById(CONFIG.spreadsheetId).getSheetByName(CONFIG.sheets.progress)),m={};rows.forEach(r=>{if(r.token===token&&r.category===category)m[r.item_key]=r;});return m;}
function requireStudent_(token){const s=findStudent_(token);if(!s||!truthy_(s.active))throw new Error('Ссылка недействительна или отключена.');return s;}
function findStudent_(token){if(!token)return null;return rowsAsObjects_(SpreadsheetApp.openById(CONFIG.spreadsheetId).getSheetByName(CONFIG.sheets.students)).find(x=>secureEqual_(String(x.token),String(token)))||null;}
function touchStudent_(token){const sh=SpreadsheetApp.openById(CONFIG.spreadsheetId).getSheetByName(CONFIG.sheets.students),v=sh.getDataRange().getValues();for(let i=1;i<v.length;i++)if(v[i][0]===token)sh.getRange(i+1,7).setValue(new Date());}
function rowsAsObjects_(sheet){if(!sheet||sheet.getLastRow()<2)return[];const d=sheet.getDataRange().getValues(),h=d.shift().map(String);return d.map(r=>{const o={};h.forEach((x,i)=>o[x]=r[i]);return o;});}
function dateIso_(v){if(!v)return'';const d=v instanceof Date?v:new Date(v);return isNaN(d.getTime())?'':d.toISOString();}
function truthy_(v){return v===true||String(v).toLowerCase()==='true'||v===1;}
function shuffle_(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}}
function secureEqual_(a,b){a=String(a||'');b=String(b||'');if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;}
function isTeacher_(value){return secureEqual_(value,CONFIG.teacherKey)||secureEqual_(value,CONFIG.teacherPin);}
