// Mis Tareas V6 - dashboard visual. Basado en V5.4.1; conserva Supabase, Google Drive/Sheets,
// calendario, búsqueda, edición, borrado y voz. La capa V6 mejora únicamente la experiencia de Hoy.
(function(){
  const $=id=>document.getElementById(id);
  let tasksV6=[];
  let calendarAnchor=new Date();
  const todayISO=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)};
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const priorityText=p=>({urgent:'Urgente',high:'Alta',normal:'Normal',low:'Baja'})[p]||p;
  const statusText=s=>({pending:'Pendiente',in_progress:'En curso',completed:'Completada'})[s]||s;
  const fmtDate=d=>d?new Date(d+'T00:00:00').toLocaleDateString('es-ES',{day:'2-digit',month:'short'}):'Sin fecha';
  const fullDate=d=>d?new Date(d+'T00:00:00').toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'}):'Sin fecha';
  const overdue=t=>t.status!=='completed'&&t.due_date&&t.due_date<todayISO();
  const isToday=t=>t.due_date===todayISO();

  async function fetchTasks(){
    if(!window.db||!window.currentUser)return;
    const {data,error}=await db.from('tasks').select('*, categories(name)').order('due_date',{ascending:true,nullsFirst:false}).order('due_time',{ascending:true,nullsFirst:false});
    if(error){console.error(error);return}
    tasksV6=data||[]; renderV6(); renderCalendar();
  }
  function greeting(){const h=new Date().getHours();return h<12?'Buenos días':h<19?'Buenas tardes':'Buenas noches'}
  function renderHeader(){
    const d=new Date();
    $('todayTitle').textContent=`${greeting()}, Aday`;
    $('welcome').textContent=d.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  }
  function taskHtml(t,compact=false){
    return `<div class="task v6-task ${esc(t.priority)} ${t.status==='completed'?'completed':''} ${overdue(t)?'overdue':''}">
      <div class="task-check-wrap">${t.status==='completed'?'<span class="done-check">✓</span>':`<button class="circle-check" data-complete="${esc(t.id)}" title="Completar">✓</button>`}</div>
      <div class="task-main"><div class="task-title">${esc(t.title)}</div><div class="task-meta">${t.due_time?`<strong>${esc(t.due_time)}</strong> · `:''}${esc(priorityText(t.priority))} · ${esc(statusText(t.status))}${t.categories?.name?' · '+esc(t.categories.name):''}</div>${!compact&&t.description?`<div class="task-meta desc">${esc(t.description)}</div>`:''}</div>
      <div class="task-actions"><button class="edit-btn" data-edit="${esc(t.id)}" title="Editar">✎</button><button class="delete-mini" data-delete="${esc(t.id)}" title="Eliminar">×</button></div>
    </div>`;
  }
  function bindTaskActions(root=document){
    root.querySelectorAll('[data-complete]').forEach(b=>b.onclick=()=>setCompleted(b.dataset.complete));
    root.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEdit(b.dataset.edit));
    root.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deleteTask(b.dataset.delete));
    root.querySelectorAll('[data-v6-filter]').forEach(b=>b.onclick=()=>{const f=b.dataset.v6Filter;if($('taskFilter'))$('taskFilter').value=f;$('taskSearch').value='';$('taskList').scrollIntoView({behavior:'smooth',block:'start'});renderAllTaskList();});
    root.querySelectorAll('[data-open-calendar]').forEach(b=>b.onclick=()=>document.querySelector('[data-section="calendarSection"]')?.click());
  }
  function renderToday(){
    const today=tasksV6.filter(isToday).sort((a,b)=>(a.due_time||'99:99').localeCompare(b.due_time||'99:99'));
    $('todayCount').textContent=today.filter(t=>t.status!=='completed').length;
    $('todayBadge').textContent=today.length;
    $('todayTaskList').innerHTML=today.length?today.map(t=>taskHtml(t,true)).join(''):`<div class="empty-state v6-empty"><div class="empty-icon">☀️</div><h3>Tu día está despejado</h3><p>No tienes tareas para hoy. Puedes crear una nueva.</p><button class="primary" id="emptyNewTask">＋ Nueva tarea</button></div>`;
    $('emptyNewTask')?.addEventListener('click',()=>document.getElementById('newTaskBtn').click());
    bindTaskActions($('todayTaskList'));
  }
  function filtered(){
    const q=($('taskSearch')?.value||'').trim().toLowerCase(),f=$('taskFilter')?.value||'all';
    return tasksV6.filter(t=>{const text=[t.title,t.description,t.categories?.name].filter(Boolean).join(' ').toLowerCase();if(q&&!text.includes(q))return false;if(f==='today'&&!isToday(t))return false;if(f==='pending'&&t.status==='completed')return false;if(f==='urgent'&&t.priority!=='urgent')return false;if(f==='completed'&&t.status!=='completed')return false;if(f==='overdue'&&!overdue(t))return false;return true}).sort((a,b)=>((a.due_date||'9999')+(a.due_time||'99:99')).localeCompare((b.due_date||'9999')+(b.due_time||'99:99')));
  }
  function renderAllTaskList(){
    const list=filtered();
    $('taskList').innerHTML=list.length?list.map(t=>taskHtml(t)).join(''):'<div class="empty-state"><div class="empty-icon">✓</div><h3>No hay tareas con estos filtros</h3><p>Prueba otro filtro o crea una nueva tarea.</p></div>';
    bindTaskActions($('taskList'));
  }
  function renderUpcoming(){
    const list=tasksV6.filter(t=>t.status!=='completed'&&t.due_date&&!isToday(t)).sort((a,b)=>((a.due_date||'9999')+(a.due_time||'99:99')).localeCompare((b.due_date||'9999')+(b.due_time||'99:99'))).slice(0,6);
    $('upcomingList').innerHTML=list.length?list.map(t=>`<div class="upcoming-v6 ${overdue(t)?'upcoming-overdue':''}"><div class="date-chip">${esc(fmtDate(t.due_date))}</div><div><b>${esc(t.title)}</b><span>${t.due_time?esc(t.due_time)+' · ':''}${esc(priorityText(t.priority))}</span></div></div>`).join(''):'<p class="muted">No hay próximas tareas.</p>';
  }
  function renderPriority(){
    const total=Math.max(tasksV6.length,1);const arr=[['urgent','Urgentes','🔴'],['high','Altas','🟠'],['normal','Normales','🔵'],['low','Bajas','⚪']];
    $('prioritySummary').innerHTML=arr.map(([key,label,icon])=>{const n=tasksV6.filter(t=>t.priority===key&&t.status!=='completed').length;return `<div class="summary-row"><span>${icon} ${label}</span><b>${n}</b><div class="summary-bar"><i style="width:${Math.min(100,n/total*100)}%"></i></div></div>`}).join('');
  }
  function renderCategories(){
    const map={};tasksV6.forEach(t=>{const n=t.categories?.name||'Sin categoría';map[n]=(map[n]||0)+1});const entries=Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,6);
    $('categorySummary').innerHTML=entries.length?entries.map(([n,c],i)=>`<div class="category-row"><span class="category-dot dot-${i%6}"></span><span>${esc(n)}</span><b>${c}</b></div>`).join(''):'<p class="muted">Todavía no hay categorías.</p>';
  }
  function renderMiniCalendar(){
    const d=new Date(),year=d.getFullYear(),month=d.getMonth(),first=new Date(year,month,1),last=new Date(year,month+1,0),start=(first.getDay()+6)%7;
    const cells=[];for(let i=0;i<start;i++)cells.push('<span class="mini-empty"></span>');
    for(let day=1;day<=last.getDate();day++){const iso=new Date(year,month,day);const isoS=new Date(iso.getTime()-iso.getTimezoneOffset()*60000).toISOString().slice(0,10);const count=tasksV6.filter(t=>t.due_date===isoS&&t.status!=='completed').length;cells.push(`<button class="mini-day ${isoS===todayISO()?'selected':''}" data-mini-date="${isoS}"><span>${day}</span>${count?`<i>${count}</i>`:''}</button>`)}
    $('miniCalendar').innerHTML=`<div class="mini-month-head"><button class="ghost" id="miniPrev">‹</button><b>${d.toLocaleDateString('es-ES',{month:'long',year:'numeric'})}</b><button class="ghost" id="miniNext">›</button></div><div class="mini-week"><span>LU</span><span>MA</span><span>MI</span><span>JU</span><span>VI</span><span>SÁ</span><span>DO</span></div><div class="mini-days">${cells.join('')}</div>`;
    document.querySelectorAll('[data-mini-date]').forEach(b=>b.onclick=()=>renderMiniDay(b.dataset.miniDate));
    $('miniPrev').onclick=()=>{calendarAnchor=new Date(year,month-1,1);renderMiniCalendar()};$('miniNext').onclick=()=>{calendarAnchor=new Date(year,month+1,1);renderMiniCalendar()};
    renderMiniDay(todayISO());
  }
  function renderMiniDay(iso){const list=tasksV6.filter(t=>t.due_date===iso).sort((a,b)=>(a.due_time||'99:99').localeCompare(b.due_time||'99:99')).slice(0,4);$('miniDayTasks').innerHTML=`<div class="mini-day-title">${iso===todayISO()?'Hoy':new Date(iso+'T00:00:00').toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})}</div>`+(list.length?list.map(t=>`<button class="mini-task" data-edit="${esc(t.id)}"><span class="mini-dot ${esc(t.priority)}"></span><span>${t.due_time?esc(t.due_time)+' · ':''}${esc(t.title)}</span></button>`).join(''):'<span class="muted">Sin tareas.</span>');bindTaskActions($('miniDayTasks'))}
  function renderStats(){const pending=tasksV6.filter(t=>t.status!=='completed');$('pendingCount').textContent=pending.length;$('urgentCount').textContent=pending.filter(t=>t.priority==='urgent').length;$('doneCount').textContent=tasksV6.filter(t=>t.status==='completed').length}
  function renderV6(){renderHeader();renderStats();renderToday();renderAllTaskList();renderUpcoming();renderPriority();renderCategories();renderMiniCalendar();bindTaskActions(document)}

  async function setCompleted(id){const {error}=await db.from('tasks').update({status:'completed',completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',id);if(error)alert(error.message);else fetchTasks()}
  async function deleteTask(id){const t=tasksV6.find(x=>String(x.id)===String(id));if(!t)return;if(!confirm(`¿Eliminar "${t.title}"?`))return;const {error}=await db.from('tasks').delete().eq('id',id);if(error)alert(error.message);else fetchTasks()}
  function openEdit(id){const t=tasksV6.find(x=>String(x.id)===String(id));if(!t)return;$('taskId').value=t.id;$('taskTitle').value=t.title||'';$('taskDescription').value=t.description||'';$('taskDate').value=t.due_date||'';$('taskTime').value=t.due_time||'';$('taskPriority').value=t.priority||'normal';$('taskStatus').value=t.status||'pending';$('taskCategory').value=t.category_id||'';$('modalTitle').textContent='Editar tarea';$('deleteTaskBtn').classList.remove('hidden');$('taskError').textContent='';$('modal').classList.remove('hidden')}
  function resetForm(){ $('taskId').value='';$('taskTitle').value='';$('taskDescription').value='';$('taskDate').value=todayISO();$('taskTime').value='';$('taskPriority').value='normal';$('taskStatus').value='pending';$('taskCategory').value='';$('modalTitle').textContent='Nueva tarea';$('deleteTaskBtn').classList.add('hidden');$('taskError').textContent='';}
  function openNew(){resetForm();$('modal').classList.remove('hidden');setTimeout(()=>$('taskTitle').focus(),50)}
  async function saveTask(e){e.preventDefault();$('taskError').textContent='';const user=await (window.ensureAuthReady?window.ensureAuthReady():window.ensureCurrentUser());if(!user){$('taskError').textContent='La sesión ha caducado. Activa la sincronización una vez en este dispositivo.';return}const id=$('taskId').value;const payload={user_id:user.id,title:$('taskTitle').value.trim(),description:$('taskDescription').value.trim()||null,due_date:$('taskDate').value||null,due_time:$('taskTime').value||null,priority:$('taskPriority').value,status:$('taskStatus').value,category_id:$('taskCategory').value||null,updated_at:new Date().toISOString()};if(!payload.title){$('taskError').textContent='Escribe un título.';return}const res=id?await db.from('tasks').update(payload).eq('id',id):await db.from('tasks').insert(payload);if(res.error){$('taskError').textContent=res.error.message;return}$('modal').classList.add('hidden');fetchTasks()}
  function setupForm(){const old=$('taskForm');const clone=old.cloneNode(true);old.replaceWith(clone);clone.addEventListener('submit',saveTask);$('closeModal').onclick=()=>$('modal').classList.add('hidden');$('newTaskBtn').onclick=openNew;$('deleteTaskBtn').onclick=()=>{const id=$('taskId').value;if(id)deleteTask(id).then(()=>$('modal').classList.add('hidden'))};$('taskSearch').oninput=renderAllTaskList;$('taskFilter').onchange=renderAllTaskList;$('clearFiltersBtn').onclick=()=>{$('taskSearch').value='';$('taskFilter').value='all';renderAllTaskList()};$('refreshBtn').onclick=fetchTasks}
  // ---------------- Voz inteligente V6.2 ----------------
  const numberWords={
    cero:0,uno:1,una:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,
    once:11,doce:12,trece:13,catorce:14,quince:15,dieciseis:16,diecisiete:17,dieciocho:18,diecinueve:19,veinte:20,
    veintiuno:21,veintiuna:21,veintidos:22,veintitres:23
  };
  const weekdays={domingo:0,lunes:1,martes:2,miercoles:3,jueves:4,viernes:5,sabado:6};
  const months={enero:0,febrero:1,marzo:2,abril:3,mayo:4,junio:5,julio:6,agosto:7,septiembre:8,setiembre:8,octubre:9,noviembre:10,diciembre:11};
  const normVoice=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
  const pad2=n=>String(n).padStart(2,'0');
  const isoFromDate=d=>`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  function voiceDateFromDay(day,month,year){
    const now=new Date(), y=year??now.getFullYear(), d=new Date(y,month,day);
    if(!year && d<new Date(now.getFullYear(),now.getMonth(),now.getDate())) d.setFullYear(d.getFullYear()+1);
    return isoFromDate(d);
  }
  function parseVoiceDate(text){
    const n=normVoice(text), now=new Date();
    if(/\bpasado manana\b/.test(n)){const d=new Date(now);d.setDate(d.getDate()+2);return {value:isoFromDate(d),remove:/\bpasado\s+(?:mañana|manana)\b/i};}
    if(/\b(?:manana)\b/.test(n)){const d=new Date(now);d.setDate(d.getDate()+1);return {value:isoFromDate(d),remove:/\bmañana\b/i};}
    if(/\bhoy\b/.test(n))return {value:todayISO(),remove:/\bhoy\b/i};
    let m=n.match(/\b(?:el\s+)?(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
    if(m){let y=m[3]?Number(m[3]):undefined;if(y&&y<100)y+=2000;return {value:voiceDateFromDay(Number(m[1]),Number(m[2])-1,y),remove:new RegExp(m[0],'i')};}
    m=n.match(/\b(?:el\s+)?(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de\s+(\d{4}))?\b/);
    if(m)return {value:voiceDateFromDay(Number(m[1]),months[m[2]],m[3]?Number(m[3]):undefined),remove:new RegExp(m[0],'i')};
    m=n.match(/\b(?:el\s+)?(domingo|lunes|martes|miercoles|jueves|viernes|sabado)\b/);
    if(m){const target=weekdays[m[1]],d=new Date(now);let diff=(target-d.getDay()+7)%7;if(diff===0)diff=7;d.setDate(d.getDate()+diff);return {value:isoFromDate(d),remove:new RegExp(m[0],'i')};}
    return {value:'',remove:null};
  }
  function parseVoiceTime(text){
    const n=normVoice(text);
    if(/\b(?:al\s+)?mediodia\b/.test(n))return {value:'12:00',remove:/\b(?:al\s+)?mediodía\b/i};
    let m=n.match(/\ba\s+las?\s+(\d{1,2})(?:\s*(?::|y)\s*(\d{1,2}))?\s*(?:de\s+la\s+)?(mañana|manana|tarde|noche)?\b/);
    let token='',hour=null,minute=0,period='';
    if(m){hour=Number(m[1]);minute=m[2]?Number(m[2]):0;period=m[3]||'';token=m[0];}
    else {
      m=n.match(/\ba\s+las?\s+(\w+)(?:\s+(y\s+media|y\s+cuarto|menos\s+cuarto|menos\s+\w+))?\s*(?:de\s+la\s+)?(mañana|manana|tarde|noche)?\b/);
      if(m && numberWords[m[1]]!==undefined){hour=numberWords[m[1]];token=m[0];const extra=normVoice(m[2]||'');period=m[3]||'';if(extra.includes('y media'))minute=30;else if(extra.includes('y cuarto'))minute=15;else if(extra.includes('menos cuarto')){hour--;minute=45;}else if(extra.includes('menos ')){const w=extra.replace('menos ','').trim();if(numberWords[w]!==undefined){hour--;minute=60-numberWords[w];}}}
    }
    // También acepta «a las 10», «a las diez» aunque no haya AM/PM.
    if(hour===null)return {value:'',remove:null};
    if(period==='tarde'||period==='noche'){if(hour<12)hour+=12;}
    else if(period==='manana'&&hour===12)hour=0;
    if(hour>23)hour=23;if(minute>59)minute=59;
    return {value:`${pad2(hour)}:${pad2(minute)}`,remove:new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i')};
  }
  function parseVoicePriority(text){
    const n=normVoice(text),rules=[
      ['urgent',/\b(?:urgente|urgencia|maxima|prioridad maxima)\b/i],
      ['high',/\b(?:alta|prioridad alta|importante|muy importante)\b/i],
      ['low',/\b(?:baja|prioridad baja|poco importante)\b/i],
      ['normal',/\b(?:normal|media|prioridad media)\b/i]
    ];
    for(const [value,re] of rules)if(re.test(n))return {value,remove:re};
    return {value:'normal',remove:null};
  }
  function parseVoiceStatus(text){const n=normVoice(text);if(/\b(?:en curso|en progreso|iniciada|iniciar)\b/.test(n))return {value:'in_progress',remove:/\b(?:en curso|en progreso|iniciada|iniciar)\b/i};return {value:'pending',remove:null};}
  function parseVoiceCategory(text){
    const select=$('taskCategory');if(!select)return {value:'',name:'',remove:null};
    const n=normVoice(text);
    const options=[...select.options].filter(o=>o.value).map(o=>({id:o.value,name:o.textContent.trim()})).sort((a,b)=>normVoice(b.name).length-normVoice(a.name).length);
    for(const c of options){
      const cn=normVoice(c.name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      // Admite: «categoría Clientes», «para Clientes», «de Clientes», «en Clientes».
      const re=new RegExp(`(?:categoria|categoría)\\s+${cn}\\b|(?:para|de|en)\\s+(?:la\\s+)?${cn}\\b`,'i');
      if(re.test(n))return {value:c.id,name:c.name,remove:re};
    }
    return {value:'',name:'',remove:null};
  }
  function cleanVoiceTitle(text,removals){
    let s=text;
    s=s.replace(/^\s*(?:añade|anade|agrega|crear|crea|creame|créame|nueva tarea|nueva|tarea)\b\s*/i,'');
    removals.filter(Boolean).forEach(re=>{s=s.replace(re,' ')});
    s=s.replace(/\b(?:para|con)\s+(?:hoy|mañana|manana|pasado mañana|pasado manana)\b/gi,' ');
    s=s.replace(/\b(?:prioridad\s+)?(?:urgente|alta|baja|normal|media|importante)\b/gi,' ');
    s=s.replace(/\b(?:y\s+)?categor[ií]a\s+[\wáéíóúüñ]+\b/gi,' ');
    s=s.replace(/\s*,\s*(?:y\s*)?(?:y|e)?\s*$/i,'');
    return s.replace(/\s{2,}/g,' ').replace(/^\s*[,;:-]+\s*/,'').replace(/\s*[,;:-]+\s*$/,'').trim()||'Nueva tarea';
  }
  function parseSmartVoice(raw){
    const date=parseVoiceDate(raw),time=parseVoiceTime(raw),priority=parseVoicePriority(raw),status=parseVoiceStatus(raw),category=parseVoiceCategory(raw);
    const title=cleanVoiceTitle(raw,[date.remove,time.remove,priority.remove,status.remove,category.remove]);
    return {title,date:date.value,time:time.value,priority:priority.value,status:status.value,categoryId:category.value,categoryName:category.name,raw};
  }
  function applySmartVoice(parsed){
    $('taskTitle').value=parsed.title;
    $('taskDate').value=parsed.date||todayISO();
    $('taskTime').value=parsed.time||'';
    $('taskPriority').value=parsed.priority||'normal';
    $('taskStatus').value=parsed.status||'pending';
    $('taskCategory').value=parsed.categoryId||'';
    const summary=[parsed.date?`📅 ${new Date(parsed.date+'T00:00:00').toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'})}`:'',parsed.time?`🕐 ${parsed.time}`:'',`⚑ ${priorityText(parsed.priority)}`,parsed.categoryName?`🏷️ ${parsed.categoryName}`:''].filter(Boolean).join(' · ');
    if($('voiceStatus'))$('voiceStatus').textContent=`Entendido: ${summary||'revisa los datos'}`;
  }
  function setupVoice(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    const quick=$('voiceQuickBtn'),taskBtn=$('voiceTaskBtn');
    if(!SR){if(quick)quick.title='El reconocimiento de voz no está disponible en este navegador';return;}
    function listen(){
      const r=new SR();r.lang='es-ES';r.interimResults=false;r.maxAlternatives=3;r.continuous=false;
      r.onstart=()=>{if($('voiceStatus'))$('voiceStatus').textContent='🎙️ Escuchando… Di la tarea completa, por ejemplo: «Añade llamar a Juan mañana a las diez, urgente y categoría Clientes»';};
      r.onend=()=>{};
      r.onerror=e=>{if($('voiceStatus'))$('voiceStatus').textContent='No se pudo usar el micrófono: '+(e.error==='not-allowed'?'permiso denegado':e.error)};
      r.onresult=e=>{
        const alternatives=[...e.results[0]].map(x=>x.transcript.trim()).filter(Boolean);
        const text=alternatives[0]||'';const parsed=parseSmartVoice(text);applySmartVoice(parsed);
        if($('voiceStatus'))$('voiceStatus').textContent+=` · Oído: «${text}»`;
      };
      try{r.start();}catch(e){if($('voiceStatus'))$('voiceStatus').textContent='No se pudo iniciar el micrófono.';}
    }
    if(quick)quick.onclick=()=>{openNew();setTimeout(listen,300)};
    if(taskBtn){taskBtn.textContent='🎙️ Dictar tarea completa';taskBtn.onclick=listen;}
  }
  function activateNav(){document.querySelectorAll('.nav-btn').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.nav-btn').forEach(x=>x.classList.remove('active'));btn.classList.add('active');document.querySelectorAll('.app-section').forEach(s=>s.classList.add('hidden'));$(btn.dataset.section).classList.remove('hidden');if(btn.dataset.section==='calendarSection')renderCalendar() }))}
  function startOfWeek(d){const x=new Date(d);x.setHours(0,0,0,0);const day=x.getDay();const diff=day===0?-6:1-day;x.setDate(x.getDate()+diff);return x}
  function isoDate(d){return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)}
  function renderCalendar(){const start=startOfWeek(calendarAnchor),days=[];for(let i=0;i<7;i++){const d=new Date(start);d.setDate(start.getDate()+i);days.push(d)}const end=days[6];$('calendarTitle').textContent=`Semana del ${start.toLocaleDateString('es-ES',{day:'numeric',month:'long'})} al ${end.toLocaleDateString('es-ES',{day:'numeric',month:'long'})}`;$('calendarGrid').innerHTML=days.map(d=>{const iso=isoDate(d),items=tasksV6.filter(t=>t.due_date===iso).sort((a,b)=>(a.due_time||'').localeCompare(b.due_time||''));return `<div class="day-col ${iso===todayISO()?'today-col':''}"><div class="day-head"><span>${d.toLocaleDateString('es-ES',{weekday:'short'})}</span><b>${d.getDate()}</b></div><div class="day-items">${items.length?items.map(t=>`<button class="calendar-task ${esc(t.priority)}" data-cal-edit="${esc(t.id)}"><strong>${t.due_time?esc(t.due_time)+' · ':''}${esc(t.title)}</strong><small>${esc(statusText(t.status))}</small></button>`).join(''):'<span class="no-day-task">—</span>'}</div></div>`}).join('');$('calendarGrid').querySelectorAll('[data-cal-edit]').forEach(b=>b.onclick=()=>openEdit(b.dataset.calEdit))}
  function setupCalendar(){$('prevWeek').onclick=()=>{calendarAnchor.setDate(calendarAnchor.getDate()-7);renderCalendar()};$('nextWeek').onclick=()=>{calendarAnchor.setDate(calendarAnchor.getDate()+7);renderCalendar()};$('todayWeek').onclick=()=>{calendarAnchor=new Date();renderCalendar()}}
  window.ensureCurrentUser=window.ensureCurrentUser||(()=>window.currentUser);
  window.addEventListener('load',async()=>{setupForm();setupCalendar();setupVoice();activateNav();await(window.authReady||Promise.resolve());if(window.currentUser)await fetchTasks();setInterval(()=>{if(window.currentUser)fetchTasks()},60000)})
})();
