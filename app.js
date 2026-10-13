
(()=>{
"use strict";
const DATA=window.APP_DATA;
const STORAGE='planificador-docente-state-final-v1';
const OLD_STORAGE='planificador-docente-state-v2';
const clone=o=>JSON.parse(JSON.stringify(o));
const DEFAULT_PROJECTS=clone(DATA.projects||[]);
const NAV=[
 ['home','⌂','Início'],['calendar','▦','Calendário'],['subjects','▤','Planificações'],
 ['register','✓','Registo'],['classes','♙','Turmas'],['summaries','≡','Sumários'],
 ['assessments','◆','Avaliações'],['projects','★','Projetos'],['settings','⚙','Definições']
];
const MOBILE=['home','calendar','register','classes','subjects'];

let currentView='home', currentSubject=null, currentClass=null, currentRegisterSubject='mat6', currentRegisterLesson='';
let calendarDate=new Date(), filter='Todos', search='';

function freshState(){
 return {theme:'light',statuses:{},notes:{},actualSummaries:{},projects:clone(DEFAULT_PROJECTS),
   customSubjects:[],rosters:{},records:{},studentNotes:{},settings:{teacher:'João Fortuna'}};
}
function migrateOld(){
 try{
   const old=JSON.parse(localStorage.getItem(OLD_STORAGE)||'null');
   if(!old)return null;
   const s=freshState();
   s.theme=old.theme||'light'; s.statuses=old.statuses||{}; s.notes=old.notes||{};
   s.actualSummaries=old.actualSummaries||{}; s.projects=old.projects?.length?old.projects:clone(DEFAULT_PROJECTS);
   s.customSubjects=old.importedSubjects||[];
   return s;
 }catch(e){return null}
}
function loadState(){
 try{
   const x=JSON.parse(localStorage.getItem(STORAGE)||'null');
   if(x){
     const s={...freshState(),...x};
     s.rosters=s.rosters||{};s.records=s.records||{};s.studentNotes=s.studentNotes||{};s.customSubjects=s.customSubjects||[];
     if(!Array.isArray(s.projects)||!s.projects.length)s.projects=clone(DEFAULT_PROJECTS);
     return s;
   }
 }catch(e){}
 const m=migrateOld(); if(m){localStorage.setItem(STORAGE,JSON.stringify(m));return m}
 return freshState();
}
let state=loadState();
function saveState(){localStorage.setItem(STORAGE,JSON.stringify(state))}
function esc(x){return String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function slug(x){return String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')}
function fmtDate(iso,opt={day:'2-digit',month:'2-digit',year:'numeric'}){if(!iso)return'—';const d=new Date(iso+'T12:00:00');return new Intl.DateTimeFormat('pt-PT',opt).format(d)}
function todayISO(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function allSubjects(){return [...(DATA.subjects||[]),...(state.customSubjects||[])]}
function subjectById(id){return allSubjects().find(s=>s.id===id)}
function classLabel(id){return DATA.classCatalog?.find(c=>c.id===id)?.label||id}
function rosterOf(classId){return state.rosters[classId]?.students||[]}
function classInfo(classId){return state.rosters[classId]||{id:classId,label:classLabel(classId),students:[]}}
function statusOf(s,l){return state.statuses[`${s.id}:${l.id}`]||l.baseStatus||'Por realizar'}
function actualSummaryOf(s,l){return state.actualSummaries[`${s.id}:${l.id}`]??l.summary??''}
function noteOf(s,l){return state.notes[`${s.id}:${l.id}`]||''}
function recordKey(sid,lessonKey,studentId){return `${sid}|${lessonKey}|${studentId}`}
function recordOf(sid,lessonKey,studentId){return state.records[recordKey(sid,lessonKey,studentId)]||{}}
function saveRecord(sid,lessonKey,studentId,patch){
 const k=recordKey(sid,lessonKey,studentId);state.records[k]={...recordOf(sid,lessonKey,studentId),...patch,updated:new Date().toISOString()};saveState();
}
function homeworkLabel(v){return ({done:'Fez',missing:'Não fez',partial:'Parcial',excused:'Justificado'})[v]||'—'}
function typeClass(t){const x=(t||'').toLowerCase();if(x.includes('teste')||x==='avaliação')return'test';if(x.includes('questão'))return'qa';if(x.includes('projeto'))return'project';if(x.includes('margem')||x.includes('interrup'))return'margin';return''}
function typeBadge(t){return `<span class="badge ${typeClass(t)}">${esc(t||'Aula')}</span>`}
function progressFor(s){const ls=(s.lessons||[]).filter(l=>!String(l.type).toLowerCase().includes('interrup'));if(!ls.length)return 0;const d=ls.filter(l=>statusOf(s,l)==='Dada').length;return Math.round(d/ls.length*100)}
function navHtml(mobile=false){const ids=mobile?MOBILE:NAV.map(x=>x[0]);return NAV.filter(x=>ids.includes(x[0])).map(([id,ic,lab])=>`<button class="nav-btn ${currentView===id||(id==='subjects'&&currentView==='subject')?'active':''}" data-view="${id}"><span class="nav-icon">${ic}</span><span>${lab}</span></button>`).join('')}
function renderNav(){document.querySelector('#desktopNav').innerHTML=navHtml(false);document.querySelector('#mobileNav').innerHTML=navHtml(true)}
function setTitle(t){document.querySelector('#viewTitle').textContent=t}
function toast(t){const e=document.querySelector('#toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1800)}
function closeModal(){document.querySelector('#modal').classList.add('hidden')}
function openModal(html){document.querySelector('#modalContent').innerHTML=html;document.querySelector('#modal').classList.remove('hidden')}
function download(name,text,type='application/json'){const b=new Blob([text],{type}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),700)}
function jsonDownload(name,obj){download(name,JSON.stringify(obj,null,2))}
function csvCell(v){const s=String(v??'');return `"${s.replace(/"/g,'""')}"`}
function statForStudent(classId,studentId){
 let ps=[],hwTotal=0,hwDone=0,hwMissing=0;
 for(const [k,r] of Object.entries(state.records)){
   const parts=k.split('|'); if(parts[2]!==studentId)continue;
   const s=subjectById(parts[0]); if(!s||s.classId!==classId)continue;
   if(Number.isFinite(Number(r.participation))&&r.participation!==''&&r.participation!=null)ps.push(Number(r.participation));
   if(r.homework){hwTotal++;if(r.homework==='done')hwDone++;if(r.homework==='missing')hwMissing++}
 }
 return {participation:ps.length?Math.round(ps.reduce((a,b)=>a+b,0)/ps.length):null,partN:ps.length,hwTotal,hwDone,hwMissing,hwPct:hwTotal?Math.round(hwDone/hwTotal*100):null};
}
function nextLessons(limit=8){
 const t=todayISO(),a=[];for(const s of allSubjects().filter(s=>s.status!=='draft'))for(const l of (s.lessons||[]))if(l.date>=t&&!String(l.type).toLowerCase().includes('interrup'))a.push({s,l});
 return a.sort((x,y)=>(x.l.date+x.l.start).localeCompare(y.l.date+y.l.start)).slice(0,limit);
}
function countPrivateStudents(){return Object.values(state.rosters||{}).reduce((n,c)=>n+(c.students?.length||0),0)}
function render(){
 document.body.classList.toggle('dark',state.theme==='dark');renderNav();
 const c=document.querySelector('#content');
 if(currentView==='home')renderHome(c);
 else if(currentView==='calendar')renderCalendar(c);
 else if(currentView==='subjects')renderSubjects(c);
 else if(currentView==='subject')renderSubject(c);
 else if(currentView==='classes')renderClasses(c);
 else if(currentView==='register')renderRegister(c);
 else if(currentView==='summaries')renderSummaries(c);
 else if(currentView==='assessments')renderAssessments(c);
 else if(currentView==='projects')renderProjects(c);
 else renderSettings(c);
}
function renderHome(c){
 setTitle('Painel');
 const active=allSubjects().filter(s=>s.status!=='draft'),next=nextLessons(6);
 const today=todayISO(),todayLs=[];for(const s of active)for(const l of s.lessons||[])if(l.date===today)todayLs.push({s,l});
 c.innerHTML=`<div class="privacy-banner"><strong>Dados dos alunos protegidos.</strong> A versão pública no GitHub não contém nomes, TPC nem participação. Esses dados ficam apenas neste navegador e nos backups privados que exportar.</div>
 <div class="kpis" style="margin:14px 0 20px">
  <div class="kpi"><b>${active.length}</b><span>disciplinas/turmas ativas</span></div>
  <div class="kpi"><b>${countPrivateStudents()}</b><span>alunos carregados localmente</span></div>
  <div class="kpi"><b>${todayLs.length}</b><span>aulas hoje</span></div>
  <div class="kpi"><b>${Object.keys(state.records||{}).length}</b><span>registos aluno/aula</span></div>
 </div>
 <div class="hero"><div class="card"><h2>Hoje · ${fmtDate(today,{weekday:'long',day:'2-digit',month:'long'})}</h2>
 ${todayLs.length?`<div class="list">${todayLs.map(x=>lessonRow(x.s,x.l)).join('')}</div>`:`<div class="empty">Não há aulas planificadas para hoje.</div>`}
 </div><div class="card"><h2>Próximas aulas</h2><div class="list">${next.map(x=>lessonRow(x.s,x.l)).join('')||'<div class="empty">Sem aulas futuras.</div>'}</div></div></div>
 <div class="card"><div class="toolbar"><div><h2 style="margin:0">Acesso rápido</h2><p class="muted" style="margin:4px 0 0">TPC, participação e sumários.</p></div></div>
 <div class="grid">
 <button class="card clickable" data-view="register"><h3>✓ Registo diário</h3><p class="muted">TPC e participação 0–100 por aluno e aula.</p></button>
 <button class="card clickable" data-view="classes"><h3>♙ Turmas</h3><p class="muted">Listas, médias, TPC e histórico individual.</p></button>
 <button class="card clickable" data-view="settings"><h3>⇩ Backup privado</h3><p class="muted">Exportar para OneDrive e importar noutro dispositivo.</p></button>
 </div></div>`;
}
function lessonRow(s,l){
 return `<div class="list-row clickable" data-lesson="${esc(s.id)}|${esc(l.id)}"><div style="width:10px;height:38px;border-radius:8px;background:${esc(s.color||'#2563eb')}"></div><div class="grow"><strong>${esc(s.name)} · ${esc(s.className)}</strong><small>${fmtDate(l.date)} · ${esc(l.start||'')} ${l.end?'– '+esc(l.end):''} · ${esc(l.summary||l.section||'Aula')}</small></div>${typeBadge(l.type)}<span class="badge ${statusOf(s,l)==='Dada'?'done':''}">${esc(statusOf(s,l))}</span></div>`
}
function renderSubjects(c){
 setTitle('Planificações');
 const ss=allSubjects();
 c.innerHTML=`<div class="toolbar"><div class="left"><button class="chip active">Todas (${ss.length})</button><button class="secondary" data-action="newSubject">+ Nova disciplina</button></div></div>
 <div class="grid">${ss.map(s=>`<div class="card subject-card" data-subject="${esc(s.id)}"><div class="subject-head" style="background:${esc(s.color||'#2563eb')}"><span class="ico">${esc(s.icon||'▦')}</span><div><h3>${esc(s.name)}</h3><div>${esc(s.className)}</div></div></div>
 <div class="small">${s.status==='draft'?'Planificação por adicionar':`${(s.lessons||[]).length} registos · ${rosterOf(s.classId).length} alunos`}</div>
 <div class="small">${s.homeworkEnabled?'TPC ativo · ':''}Participação 0–100 ativa</div><div class="progress"><span style="width:${progressFor(s)}%"></span></div><div class="small">${progressFor(s)}% concluído</div></div>`).join('')}</div>`;
}
function renderSubject(c){
 const s=subjectById(currentSubject);if(!s){currentView='subjects';render();return}setTitle(`${s.name} — ${s.className}`);
 const types=['Todos',...new Set((s.lessons||[]).map(l=>l.type).filter(Boolean))];
 let ls=(s.lessons||[]).filter(l=>(filter==='Todos'||l.type===filter)&&(!search||[l.summary,l.section,l.notes,l.objective].join(' ').toLowerCase().includes(search.toLowerCase())));
 c.innerHTML=`<div class="card"><div class="toolbar"><div><h2 style="margin:0">${esc(s.name)} · ${esc(s.className)}</h2><p class="muted" style="margin:4px 0">${(s.lessons||[]).length} registos · ${rosterOf(s.classId).length} alunos · ${progressFor(s)}% concluído</p></div><div class="right"><button class="secondary" data-action="goRegister" data-sid="${esc(s.id)}">Registo TPC/participação</button></div></div>
 <div class="tabs">${types.map(t=>`<button class="chip ${filter===t?'active':''}" data-filter="${esc(t)}">${esc(t)}</button>`).join('')}</div><div style="height:10px"></div>
 <input id="lessonSearch" class="field search" value="${esc(search)}" placeholder="Pesquisar aula, conteúdo, projeto…">
 </div><div style="height:14px"></div>
 ${ls.length?`<div class="table-wrap"><table class="table"><thead><tr><th>N.º</th><th>Data</th><th>Conteúdo / sumário</th><th>Bloco</th><th>Tipo</th><th>Estado</th></tr></thead><tbody>${ls.map(l=>`<tr class="clickable" data-lesson="${esc(s.id)}|${esc(l.id)}"><td>${l.number??''}</td><td>${fmtDate(l.date)}<br><small>${esc(l.start||'')}</small></td><td><strong>${esc(l.summary||'')}</strong>${l.objective?`<br><small>${esc(l.objective)}</small>`:''}</td><td>${esc(l.section||l.domain||'')}</td><td>${typeBadge(l.type)}</td><td><select class="field" data-status="${esc(s.id)}|${esc(l.id)}"><option>${esc(statusOf(s,l))}</option>${['Por realizar','Dada','Adiada','Não realizada','Alterada'].filter(x=>x!==statusOf(s,l)).map(x=>`<option>${x}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>`:`<div class="empty">Esta disciplina ainda não tem planificação importada. Pode continuar a usar a turma, participação e registos livres.</div>`}`;
}
function renderCalendar(c){
 setTitle('Calendário');
 const y=calendarDate.getFullYear(),m=calendarDate.getMonth(),first=new Date(y,m,1),start=new Date(y,m,1-first.getDay()+1);
 let days=[];for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);days.push(d)}
 const eventMap={};
 for(const s of allSubjects().filter(s=>s.status!=='draft'))for(const l of s.lessons||[])(eventMap[l.date]??=[]).push({kind:'lesson',s,l});
 for(const p of state.projects||[])if(p.date)(eventMap[p.date]??=[]).push({kind:'project',p});
 const isoToday=todayISO();
 c.innerHTML=`<div class="card"><div class="calendar-head"><button class="secondary" data-action="prevMonth">‹</button><h2>${new Intl.DateTimeFormat('pt-PT',{month:'long',year:'numeric'}).format(first)}</h2><div><button class="secondary" data-action="monthToday">Hoje</button> <button class="secondary" data-action="nextMonth">›</button></div></div>
 <div class="calendar-grid">${['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(x=>`<div class="dow">${x}</div>`).join('')}${days.map(d=>{const iso=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'),ev=eventMap[iso]||[];return `<div class="day ${d.getMonth()!==m?'other':''} ${iso===isoToday?'today':''}" data-date="${iso}"><div class="day-num">${d.getDate()}</div><div class="dots">${ev.slice(0,8).map(e=>`<span class="dot" style="background:${e.kind==='project'?e.p.color:e.s.color}"></span>`).join('')}</div>${ev.slice(0,2).map(e=>`<div class="event-mini">${esc(e.kind==='project'?e.p.name:e.l.summary)}</div>`).join('')}</div>`}).join('')}</div></div>`;
}
function renderSummaries(c){
 setTitle('Sumários');
 const rows=[];for(const s of allSubjects().filter(s=>s.status!=='draft'))for(const l of s.lessons||[])if(l.summary)rows.push({s,l});
 rows.sort((a,b)=>(a.l.date+a.l.start).localeCompare(b.l.date+b.l.start));
 c.innerHTML=`<div class="card"><h2>Sumários previstos e efetivos</h2><p class="muted">O sumário previsto vem da planificação. O sumário efetivamente dado é editado no detalhe da aula.</p></div><div style="height:14px"></div>
 <div class="table-wrap"><table class="table"><thead><tr><th>Data</th><th>Disciplina</th><th>Previsto</th><th>Efetivamente dado</th><th></th></tr></thead><tbody>${rows.map(({s,l})=>`<tr><td>${fmtDate(l.date)}</td><td>${esc(s.name)} · ${esc(s.className)}</td><td>${esc(l.summary)}</td><td>${esc(actualSummaryOf(s,l))}</td><td><button class="secondary" data-copy="${esc(actualSummaryOf(s,l))}">Copiar</button></td></tr>`).join('')}</tbody></table></div>`;
}
function renderAssessments(c){
 setTitle('Avaliações');
 const a=[];for(const s of allSubjects())for(const l of s.lessons||[]){const t=(l.type||'').toLowerCase(),x=(l.assessment||'').toLowerCase();if(t.includes('avalia')||t.includes('questão')||t.includes('teste')||x.includes('avalia'))a.push({s,l})}
 a.sort((x,y)=>(x.l.date+x.l.start).localeCompare(y.l.date+y.l.start));
 c.innerHTML=`<div class="card"><h2>Avaliações e checkpoints</h2><p class="muted">Matemática: testes e questões-aula. TIC/Robótica: apresentações, projetos e evidências práticas.</p></div><div style="height:14px"></div><div class="list">${a.map(x=>lessonRow(x.s,x.l)).join('')||'<div class="empty">Sem avaliações identificadas.</div>'}</div>`;
}
function renderProjects(c){
 setTitle('Projetos / iniciativas');
 c.innerHTML=`<div class="card"><h2>Calendário de projetos</h2><p class="muted">Quando definir uma data, a iniciativa aparece automaticamente no calendário.</p></div><div style="height:14px"></div><div class="grid two">${(state.projects||[]).map(p=>`<div class="card"><div style="display:flex;gap:10px;align-items:center"><span class="dot" style="width:14px;height:14px;background:${p.color}"></span><h3 style="margin:0">${esc(p.name)}</h3></div><label class="detail-label">Data</label><input class="field" type="date" data-project-date="${esc(p.id)}" value="${esc(p.date||'')}"><label class="detail-label">Notas</label><textarea class="actual-summary" data-project-note="${esc(p.id)}">${esc(p.note||'')}</textarea><div class="action-row"><button class="primary" data-action="saveProject" data-id="${esc(p.id)}">Guardar</button></div></div>`).join('')}</div>`;
}
function allClassIds(){
 const sids=allSubjects().map(s=>s.classId).filter(Boolean);const rids=Object.keys(state.rosters||{});
 return [...new Set([...(DATA.classCatalog||[]).map(c=>c.id),...sids,...rids])];
}
function renderClasses(c){
 setTitle('Turmas e alunos');
 if(currentClass){renderClassDetail(c);return}
 const ids=allClassIds();
 c.innerHTML=`<div class="privacy-banner"><strong>Importante:</strong> nomes e acompanhamento não estão em <code>data.js</code> nem devem ser enviados para um repositório GitHub público.</div><div style="height:14px"></div>
 <div class="toolbar"><div><h2 style="margin:0">Turmas</h2><p class="muted" style="margin:4px 0">Uma lista de alunos pode ser partilhada por várias disciplinas da mesma turma.</p></div><button class="secondary" data-action="importRosters">Importar ficheiro privado</button></div>
 <div class="grid">${ids.map(id=>{const r=classInfo(id),subs=allSubjects().filter(s=>s.classId===id);return `<div class="card clickable" data-class="${esc(id)}"><h3>${esc(r.label||classLabel(id))}</h3><p class="muted">${r.students?.length||0} alunos · ${subs.map(s=>s.name).join(' / ')||'sem disciplina'}</p>${r.sourceNote?`<p class="review">${esc(r.sourceNote)}</p>`:''}</div>`}).join('')}</div>`;
}
function renderClassDetail(c){
 const r=classInfo(currentClass),students=r.students||[],subs=allSubjects().filter(s=>s.classId===currentClass);
 c.innerHTML=`<div class="toolbar"><div class="left"><button class="secondary" data-action="backClasses">← Turmas</button><div><h2 style="margin:0">${esc(r.label||classLabel(currentClass))}</h2><p class="muted" style="margin:4px 0">${students.length} alunos · ${subs.map(s=>s.name).join(' / ')||'sem disciplina'}</p></div></div><div class="right"><button class="secondary" data-action="addStudent">+ Aluno</button><button class="secondary" data-action="pasteRoster">Colar lista</button><button class="primary" data-action="exportClassCSV">Exportar CSV</button></div></div>
 ${r.sourceNote?`<div class="privacy-banner">${esc(r.sourceNote)}</div><div style="height:12px"></div>`:''}
 ${students.length?`<div class="list">${students.map(st=>{const x=statForStudent(currentClass,st.id);return `<div class="roster-card"><div><div class="roster-name">${st.number?`${st.number}. `:''}${esc(st.name)}</div>${st.needsReview?'<div class="review">Nome truncado na captura original — confirmar.</div>':''}</div><div class="metric"><b>${x.participation??'—'}</b>participação média</div><div class="metric"><b>${x.hwPct==null?'—':x.hwPct+'%'}</b>TPC feitos</div><div><button class="chip" data-action="studentProfile" data-student="${esc(st.id)}">Histórico</button> <button class="chip" data-action="renameStudent" data-student="${esc(st.id)}">Editar</button></div></div>`}).join('')}</div>`:`<div class="empty"><strong>Sem lista de alunos.</strong><br>Use «Colar lista» ou importe o ficheiro privado.</div>`}`;
}
function lessonsForRegister(s){
 return (s.lessons||[]).filter(l=>!String(l.type).toLowerCase().includes('interrup')).sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));
}
function registerLessonKey(s,l){return l?l.id:`free-${todayISO()}`}
function renderRegister(c){
 setTitle('Registo diário');
 let s=subjectById(currentRegisterSubject)||allSubjects().find(x=>x.status!=='draft')||allSubjects()[0];
 if(!s)return c.innerHTML='<div class="empty">Sem disciplinas.</div>';
 currentRegisterSubject=s.id;
 const ls=lessonsForRegister(s);
 let l=ls.find(x=>x.id===currentRegisterLesson);if(!l){l=ls.find(x=>x.date===todayISO())||ls.find(x=>x.date>=todayISO())||ls[0]||null;currentRegisterLesson=l?.id||''}
 const roster=rosterOf(s.classId),lk=registerLessonKey(s,l);
 c.innerHTML=`<div class="privacy-banner">Os registos desta página ficam <strong>apenas neste dispositivo</strong> até exportar um backup privado. Não são enviados para o GitHub.</div><div style="height:12px"></div>
 <div class="card"><div class="register-toolbar"><select id="regSubject" class="field">${allSubjects().filter(x=>x.status!=='draft'||x.id===s.id).map(x=>`<option value="${esc(x.id)}" ${x.id===s.id?'selected':''}>${esc(x.name)} · ${esc(x.className)}</option>`).join('')}</select>
 <select id="regLesson" class="field">${ls.length?ls.map(x=>`<option value="${esc(x.id)}" ${l&&x.id===l.id?'selected':''}>${fmtDate(x.date)} · ${esc(x.start)} · ${esc(x.summary||x.section||'Aula')}</option>`).join(''):`<option value="">Registo livre — ${fmtDate(todayISO())}</option>`}</select>
 <button class="secondary" data-action="goClassFromRegister">Ver turma</button></div>
 ${l?`<div><strong>${fmtDate(l.date,{weekday:'long',day:'2-digit',month:'long'})}</strong> · ${esc(l.start||'')} · ${esc(l.summary||'')}</div>`:`<div>Registo livre — ${fmtDate(todayISO())}</div>`}
 <div class="action-row" style="margin-top:12px">${s.homeworkEnabled?`<button class="secondary" data-action="allHomework" data-value="done">Todos fizeram TPC</button><button class="secondary" data-action="allHomework" data-value="">Limpar TPC</button>`:''}<button class="secondary" data-action="allParticipation" data-value="75">Participação 75 a todos</button></div></div><div style="height:12px"></div>
 ${roster.length?`<div>${roster.map(st=>registerRow(s,l,st,lk)).join('')}</div>`:`<div class="empty">Ainda não existe lista de alunos para ${esc(s.className)}.<br><button class="secondary" style="margin-top:10px" data-action="goClassFromRegister">Adicionar / importar alunos</button></div>`}`;
}
function registerRow(s,l,st,lk){
 const r=recordOf(s.id,lk,st.id),hw=r.homework||'',part=(r.participation??'');
 return `<div class="register-row"><button class="student-button" data-action="cycleHomework" data-student="${esc(st.id)}" title="${s.homeworkEnabled?'Toque no nome para alternar o estado do TPC.':'Aluno'}">${st.number?st.number+'. ':''}${esc(st.name)}${st.needsReview?' ⚠':''}</button>
 ${s.homeworkEnabled?`<div class="hw-group">${[['done','✓ Fez'],['missing','✕ Não fez'],['partial','◐ Parcial'],['excused','J Just.']].map(([v,lab])=>`<button class="hw ${hw===v?'active '+v:''}" data-action="setHomework" data-student="${esc(st.id)}" data-value="${v}">${lab}</button>`).join('')}</div>`:`<div class="muted">TPC não usado nesta disciplina</div>`}
 <div class="part"><input type="number" min="0" max="100" step="1" value="${esc(part)}" placeholder="0–100" data-part="${esc(st.id)}"><button class="quick-score" data-action="score" data-student="${esc(st.id)}" data-value="50">50</button><button class="quick-score" data-action="score" data-student="${esc(st.id)}" data-value="75">75</button><button class="quick-score" data-action="score" data-student="${esc(st.id)}" data-value="100">100</button></div>
 <input class="note-input" data-record-note="${esc(st.id)}" value="${esc(r.note||'')}" placeholder="Nota opcional"></div>`;
}
function renderSettings(c){
 setTitle('Definições e dados');
 c.innerHTML=`<div class="grid two">
 <div class="card"><h3>Backup privado</h3><p class="muted">Inclui listas de alunos, TPC, participação, notas, estados e projetos. Guarde este ficheiro no OneDrive.</p><div class="action-row"><button class="primary" data-action="exportBackup">Exportar backup</button><button class="secondary" data-action="importBackup">Importar backup</button></div></div>
 <div class="card"><h3>Listas de alunos</h3><p class="muted">Importe <code>dados_privados_turmas.json</code>. Este ficheiro não deve ser colocado num GitHub público.</p><button class="primary" data-action="importRosters">Importar listas privadas</button></div>
 <div class="card"><h3>Mais disciplinas</h3><p class="muted">Pode acrescentar qualquer disciplina/turma. A lista de alunos é ligada pelo ID da turma, podendo ser reutilizada por Matemática e TIC.</p><button class="secondary" data-action="newSubject">+ Nova disciplina</button></div>
 <div class="card"><h3>Exportar registos para Excel</h3><p class="muted">Exporta CSV com TPC, participação e notas. O ficheiro abre diretamente no Excel.</p><button class="secondary" data-action="exportAllCSV">Exportar CSV geral</button></div>
 <div class="card"><h3>GitHub e privacidade</h3><p class="muted">Publique apenas a pasta <strong>01_PUBLICAR_NO_GITHUB</strong>. Os nomes dos alunos e o acompanhamento ficam fora dessa pasta.</p><button class="secondary" data-action="installHelp">Ver instruções</button></div>
 <div class="card"><h3>Repor dados locais</h3><p class="muted">Faça primeiro um backup.</p><button class="danger" data-action="resetState">Apagar dados locais</button></div>
 </div>`;
}
function openLesson(s,l){
 openModal(`<div class="detail-label">${esc(s.name)} · ${esc(s.className)}</div><h2>${esc(l.summary||l.section||'Aula')}</h2>
 <div class="pill-row"><span class="badge">${fmtDate(l.date)}</span><span class="badge">${esc(l.start||'')}${l.end?'–'+esc(l.end):''}</span>${typeBadge(l.type)}</div>
 ${l.section?`<div class="detail-label">Bloco / capítulo</div><p class="detail-text">${esc(l.section)}</p>`:''}
 ${l.domain?`<div class="detail-label">Domínio</div><p class="detail-text">${esc(l.domain)}</p>`:''}
 <div class="detail-label">Sumário previsto</div><p class="detail-text">${esc(l.summary||'')}</p>
 <div class="detail-label">Sumário efetivamente dado</div><textarea id="actualSummary" class="actual-summary">${esc(actualSummaryOf(s,l))}</textarea>
 ${l.objective?`<div class="detail-label">Objetivos</div><p class="detail-text">${esc(l.objective)}</p>`:''}
 ${l.student?`<div class="detail-label">O que os alunos fazem / missão prática</div><p class="detail-text">${esc(l.student)}</p>`:''}
 ${l.teacher?`<div class="detail-label">Orientações para o professor</div><p class="detail-text">${esc(l.teacher)}</p>`:''}
 ${l.materials?`<div class="detail-label">Materiais</div><p class="detail-text">${esc(l.materials)}</p>`:''}
 ${l.differentiation?`<div class="detail-label">Diferenciação</div><p class="detail-text">${esc(l.differentiation)}</p>`:''}
 ${l.assessment?`<div class="detail-label">Avaliação</div><p class="detail-text">${esc(l.assessment)}</p>`:''}
 <div class="detail-label">Observações</div><p class="detail-text">${esc(l.notes||'—')}</p>
 <div class="detail-label">Notas pessoais</div><textarea id="lessonNote" class="actual-summary">${esc(noteOf(s,l))}</textarea>
 <div class="action-row"><button class="secondary" data-copy="${esc(actualSummaryOf(s,l))}">Copiar sumário</button><button class="secondary" data-action="registerLesson" data-sid="${esc(s.id)}" data-lid="${esc(l.id)}">TPC / participação</button><button class="primary" data-action="saveLesson" data-key="${esc(s.id)}|${esc(l.id)}">Guardar aula</button></div>`);
}
function dateModal(iso){
 const ev=[];for(const s of allSubjects().filter(x=>x.status!=='draft'))for(const l of s.lessons||[])if(l.date===iso)ev.push({kind:'lesson',s,l});
 for(const p of state.projects||[])if(p.date===iso)ev.push({kind:'project',p});
 openModal(`<h2>${fmtDate(iso,{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}</h2>${ev.length?`<div class="list">${ev.map(e=>e.kind==='lesson'?lessonRow(e.s,e.l):`<div class="list-row"><div class="dot" style="width:12px;height:12px;background:${e.p.color}"></div><div><strong>${esc(e.p.name)}</strong><small>${esc(e.p.note||'')}</small></div></div>`).join('')}</div>`:'<div class="empty">Sem eventos.</div>'}`);
}
function openStudentProfile(studentId){
 const r=classInfo(currentClass),st=(r.students||[]).find(x=>x.id===studentId);if(!st)return;
 const rows=[];
 for(const [k,rec] of Object.entries(state.records)){const [sid,lk,stud]=k.split('|');if(stud!==studentId)continue;const s=subjectById(sid);if(!s)continue;const l=(s.lessons||[]).find(x=>x.id===lk);rows.push({s,l,rec,lk})}
 rows.sort((a,b)=>String(b.l?.date||b.rec.updated||'').localeCompare(String(a.l?.date||a.rec.updated||'')));
 const stt=statForStudent(currentClass,studentId);
 openModal(`<h2>${esc(st.name)}</h2><div class="kpis" style="grid-template-columns:repeat(3,1fr)"><div class="kpi"><b>${stt.participation??'—'}</b><span>participação média</span></div><div class="kpi"><b>${stt.hwPct==null?'—':stt.hwPct+'%'}</b><span>TPC feitos</span></div><div class="kpi"><b>${rows.length}</b><span>registos</span></div></div>
 <label class="detail-label">Nota geral do aluno</label><textarea id="studentGeneralNote" class="actual-summary">${esc(state.studentNotes[studentId]||'')}</textarea><div class="action-row"><button class="primary" data-action="saveStudentNote" data-student="${esc(studentId)}">Guardar nota</button></div>
 <div class="detail-label">Histórico</div>${rows.length?`<div class="table-wrap"><table class="table" style="min-width:650px"><thead><tr><th>Data</th><th>Disciplina</th><th>TPC</th><th>Participação</th><th>Nota</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${x.l?fmtDate(x.l.date):'—'}</td><td>${esc(x.s.name)}</td><td>${esc(homeworkLabel(x.rec.homework))}</td><td>${x.rec.participation??'—'}</td><td>${esc(x.rec.note||'')}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Sem registos ainda.</div>'}`);
}
function pasteRosterModal(){
 openModal(`<h2>Colar lista — ${esc(classLabel(currentClass))}</h2><p class="muted">Uma linha por aluno. Se a linha começar por número, esse número será usado como n.º de aluno. Esta operação substitui a lista atual.</p><textarea id="rosterPaste" class="actual-summary" style="min-height:320px" placeholder="1 ANA ...&#10;2 BRUNO ..."></textarea><div class="action-row"><button class="primary" data-action="applyPastedRoster">Importar lista</button></div>`);
}
function newSubjectModal(){
 openModal(`<h2>Nova disciplina</h2><label class="detail-label">Disciplina</label><input id="nsName" class="field" value="TIC"><label class="detail-label">Turma</label><input id="nsClass" class="field" placeholder="Ex.: 7.º A"><label class="detail-label">ID da turma</label><input id="nsClassId" class="field" placeholder="Ex.: 7A"><label class="detail-label">ID da disciplina</label><input id="nsId" class="field" placeholder="Ex.: tic7b"><label class="detail-label">Cor</label><input id="nsColor" type="color" value="#7c3aed"><div class="action-row"><button class="primary" data-action="createSubject">Criar disciplina</button></div>`);
}
function installHelp(){
 openModal(`<h2>Como funciona a versão definitiva</h2><div class="detail-label">GitHub</div><p class="detail-text">Carregue <strong>apenas</strong> o conteúdo da pasta <code>01_PUBLICAR_NO_GITHUB</code>. Essa pasta não contém listas de alunos.</p>
 <div class="detail-label">Dados dos alunos</div><p class="detail-text">No primeiro uso, abra Turmas/Definições e importe o ficheiro <code>dados_privados_turmas.json</code> a partir da pasta privada. Os nomes passam a ficar no armazenamento local do navegador.</p>
 <div class="detail-label">PC e iPhone</div><p class="detail-text">Cada dispositivo mantém os seus próprios dados. Para passar dados entre eles: Definições → Exportar backup → guardar no OneDrive → no outro dispositivo Importar backup.</p>
 <div class="detail-label">Atualizações da app</div><p class="detail-text">Se substituir os ficheiros no mesmo GitHub Pages, os dados locais permanecem no navegador. Faça sempre um backup antes de uma atualização importante.</p>`);
}
function exportClassCSV(){
 const r=classInfo(currentClass),lines=[['Turma','N.º','Aluno','Participação média','N registos participação','TPC feitos','TPC registados','TPC %','Nota geral']];
 for(const st of r.students||[]){const x=statForStudent(currentClass,st.id);lines.push([r.label,st.number||'',st.name,x.participation??'',x.partN,x.hwDone,x.hwTotal,x.hwPct??'',state.studentNotes[st.id]||''])}
 download(`acompanhamento_${currentClass}.csv`,lines.map(row=>row.map(csvCell).join(';')).join('\n'),'text/csv;charset=utf-8');
}
function exportAllCSV(){
 const lines=[['Turma','Aluno','Disciplina','Data/Aula','TPC','Participação','Nota','Atualizado']];
 for(const [k,r] of Object.entries(state.records)){const [sid,lk,studentId]=k.split('|'),s=subjectById(sid);if(!s)continue;const st=rosterOf(s.classId).find(x=>x.id===studentId);const l=(s.lessons||[]).find(x=>x.id===lk);lines.push([classLabel(s.classId),st?.name||studentId,s.name,l?l.date:lk,homeworkLabel(r.homework),r.participation??'',r.note||'',r.updated||''])}
 download('registos_alunos_2026_2027.csv',lines.map(row=>row.map(csvCell).join(';')).join('\n'),'text/csv;charset=utf-8');
}
function applyRosterPayload(obj){
 if(!obj||!Array.isArray(obj.classes))throw new Error('Formato inválido');
 for(const c of obj.classes){
   if(!c.id)continue;state.rosters[c.id]={id:c.id,label:c.label||classLabel(c.id),sourceNote:c.sourceNote||'',students:(c.students||[]).map((st,i)=>({id:st.id||`${c.id}-${st.number||i+1}-${slug(st.name)}`,number:st.number||i+1,name:st.name||`Aluno ${i+1}`,needsReview:!!st.needsReview}))};
 }
 saveState();
}
function cycleHomeworkValue(v){return v===''?'done':v==='done'?'missing':v==='missing'?'partial':v==='partial'?'excused':''}

document.addEventListener('click',e=>{
 const view=e.target.closest('[data-view]');if(view){currentView=view.dataset.view;currentSubject=null;if(currentView!=='classes')currentClass=null;render();return}
 const sub=e.target.closest('[data-subject]');if(sub){currentSubject=sub.dataset.subject;currentView='subject';filter='Todos';search='';render();return}
 const cls=e.target.closest('[data-class]');if(cls){currentClass=cls.dataset.class;currentView='classes';render();return}
 const lr=e.target.closest('[data-lesson]');if(lr&&!e.target.closest('select')){const [sid,lid]=lr.dataset.lesson.split('|'),s=subjectById(sid),l=s?.lessons?.find(x=>x.id===lid);if(s&&l)openLesson(s,l);return}
 const date=e.target.closest('[data-date]');if(date){dateModal(date.dataset.date);return}
 const cp=e.target.closest('[data-copy]');if(cp){navigator.clipboard?.writeText(cp.dataset.copy||'');toast('Copiado');return}
 const f=e.target.closest('[data-filter]');if(f){filter=f.dataset.filter;render();return}
 const a=e.target.closest('[data-action]');if(!a)return;
 const act=a.dataset.action;
 if(act==='closeModal')closeModal();
 else if(act==='theme'){state.theme=state.theme==='dark'?'light':'dark';saveState();render()}
 else if(act==='quickToday'){currentView='calendar';calendarDate=new Date();render()}
 else if(act==='prevMonth'){calendarDate=new Date(calendarDate.getFullYear(),calendarDate.getMonth()-1,1);render()}
 else if(act==='nextMonth'){calendarDate=new Date(calendarDate.getFullYear(),calendarDate.getMonth()+1,1);render()}
 else if(act==='monthToday'){calendarDate=new Date();render()}
 else if(act==='installHelp')installHelp();
 else if(act==='saveLesson'){const [sid,lid]=a.dataset.key.split('|');state.notes[`${sid}:${lid}`]=document.querySelector('#lessonNote').value;state.actualSummaries[`${sid}:${lid}`]=document.querySelector('#actualSummary').value;saveState();toast('Aula guardada')}
 else if(act==='registerLesson'){currentRegisterSubject=a.dataset.sid;currentRegisterLesson=a.dataset.lid;closeModal();currentView='register';render()}
 else if(act==='goRegister'){currentRegisterSubject=a.dataset.sid;currentRegisterLesson='';currentView='register';render()}
 else if(act==='saveProject'){const p=(state.projects||[]).find(x=>x.id===a.dataset.id);if(p){p.date=document.querySelector(`[data-project-date="${p.id}"]`).value;p.note=document.querySelector(`[data-project-note="${p.id}"]`).value;saveState();toast('Projeto guardado');render()}}
 else if(act==='backClasses'){currentClass=null;render()}
 else if(act==='goClassFromRegister'){currentClass=subjectById(currentRegisterSubject)?.classId;currentView='classes';render()}
 else if(act==='importRosters'){document.querySelector('#rosterInput').click()}
 else if(act==='pasteRoster')pasteRosterModal()
 else if(act==='applyPastedRoster'){
   const lines=document.querySelector('#rosterPaste').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
   const students=lines.map((line,i)=>{const m=line.match(/^(\d+)[\s;,\-]+(.+)$/);const n=m?Number(m[1]):i+1,name=m?m[2].trim():line;return{id:`${currentClass}-${n}-${slug(name)}-${Date.now().toString(36)}`,number:n,name,needsReview:false}});
   state.rosters[currentClass]={id:currentClass,label:classLabel(currentClass),sourceNote:'Lista introduzida manualmente.',students};saveState();closeModal();render();toast('Lista importada')
 }
 else if(act==='addStudent'){const name=prompt('Nome do aluno:');if(!name)return;const r=state.rosters[currentClass]||{id:currentClass,label:classLabel(currentClass),students:[]};const num=(r.students.reduce((m,s)=>Math.max(m,Number(s.number)||0),0)+1);r.students.push({id:`${currentClass}-${num}-${Date.now().toString(36)}`,number:num,name:name.trim(),needsReview:false});state.rosters[currentClass]=r;saveState();render()}
 else if(act==='renameStudent'){const r=state.rosters[currentClass],st=r?.students?.find(x=>x.id===a.dataset.student);if(!st)return;const name=prompt('Nome do aluno:',st.name);if(name){st.name=name.trim();st.needsReview=false;saveState();render()}}
 else if(act==='studentProfile')openStudentProfile(a.dataset.student)
 else if(act==='saveStudentNote'){state.studentNotes[a.dataset.student]=document.querySelector('#studentGeneralNote').value;saveState();toast('Nota guardada')}
 else if(act==='exportClassCSV')exportClassCSV()
 else if(act==='exportAllCSV')exportAllCSV()
 else if(act==='exportBackup')jsonDownload(`planificador_backup_privado_${todayISO()}.json`,{version:3,exported:new Date().toISOString(),state})
 else if(act==='importBackup')document.querySelector('#backupInput').click()
 else if(act==='newSubject')newSubjectModal()
 else if(act==='createSubject'){
   const name=document.querySelector('#nsName').value.trim(),cl=document.querySelector('#nsClass').value.trim(),classId=document.querySelector('#nsClassId').value.trim(),id=document.querySelector('#nsId').value.trim().replace(/\s+/g,'-').toLowerCase(),color=document.querySelector('#nsColor').value;
   if(!name||!cl||!classId||!id)return alert('Preencha disciplina, turma, ID da turma e ID da disciplina.');
   state.customSubjects=state.customSubjects.filter(s=>s.id!==id);state.customSubjects.push({id,name,className:cl,classId,color,icon:'▦',status:'active',kind:'custom',homeworkEnabled:false,participationEnabled:true,schedule:[],lessons:[]});saveState();closeModal();currentView='subjects';render();toast('Disciplina criada')
 }
 else if(act==='setHomework'){const s=subjectById(currentRegisterSubject),l=s?.lessons?.find(x=>x.id===currentRegisterLesson),lk=registerLessonKey(s,l);saveRecord(s.id,lk,a.dataset.student,{homework:a.dataset.value});render()}
 else if(act==='cycleHomework'){const s=subjectById(currentRegisterSubject);if(!s?.homeworkEnabled)return;const l=s.lessons?.find(x=>x.id===currentRegisterLesson),lk=registerLessonKey(s,l),r=recordOf(s.id,lk,a.dataset.student);saveRecord(s.id,lk,a.dataset.student,{homework:cycleHomeworkValue(r.homework||'')});render()}
 else if(act==='score'){const s=subjectById(currentRegisterSubject),l=s?.lessons?.find(x=>x.id===currentRegisterLesson),lk=registerLessonKey(s,l);saveRecord(s.id,lk,a.dataset.student,{participation:Number(a.dataset.value)});render()}
 else if(act==='allHomework'){const s=subjectById(currentRegisterSubject),l=s?.lessons?.find(x=>x.id===currentRegisterLesson),lk=registerLessonKey(s,l);for(const st of rosterOf(s.classId))saveRecord(s.id,lk,st.id,{homework:a.dataset.value});render()}
 else if(act==='allParticipation'){const s=subjectById(currentRegisterSubject),l=s?.lessons?.find(x=>x.id===currentRegisterLesson),lk=registerLessonKey(s,l);for(const st of rosterOf(s.classId))saveRecord(s.id,lk,st.id,{participation:Number(a.dataset.value)});render()}
 else if(act==='resetState'){if(confirm('Apagar listas, TPC, participação, notas e restantes dados locais? Faça primeiro um backup.')){localStorage.removeItem(STORAGE);location.reload()}}
});
document.addEventListener('change',e=>{
 if(e.target.matches('[data-status]')){const [sid,lid]=e.target.dataset.status.split('|');state.statuses[`${sid}:${lid}`]=e.target.value;saveState();toast('Estado atualizado')}
 else if(e.target.id==='regSubject'){currentRegisterSubject=e.target.value;currentRegisterLesson='';render()}
 else if(e.target.id==='regLesson'){currentRegisterLesson=e.target.value;render()}
 else if(e.target.matches('[data-part]')){const s=subjectById(currentRegisterSubject),l=s?.lessons?.find(x=>x.id===currentRegisterLesson),lk=registerLessonKey(s,l);let v=e.target.value===''?null:Math.max(0,Math.min(100,Number(e.target.value)));saveRecord(s.id,lk,e.target.dataset.part,{participation:v});toast('Participação guardada')}
 else if(e.target.matches('[data-record-note]')){const s=subjectById(currentRegisterSubject),l=s?.lessons?.find(x=>x.id===currentRegisterLesson),lk=registerLessonKey(s,l);saveRecord(s.id,lk,e.target.dataset.recordNote,{note:e.target.value})}
 else if(e.target.id==='rosterInput'&&e.target.files[0]){const fr=new FileReader();fr.onload=()=>{try{applyRosterPayload(JSON.parse(fr.result));toast('Listas privadas importadas');render()}catch(err){alert('Ficheiro de listas inválido.')}};fr.readAsText(e.target.files[0])}
 else if(e.target.id==='backupInput'&&e.target.files[0]){const fr=new FileReader();fr.onload=()=>{try{const o=JSON.parse(fr.result);state={...freshState(),...(o.state||o)};saveState();toast('Backup importado');render()}catch(err){alert('Backup inválido.')}};fr.readAsText(e.target.files[0])}
});
document.addEventListener('input',e=>{if(e.target.id==='lessonSearch'){search=e.target.value;render()}})
if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
render();
})();
