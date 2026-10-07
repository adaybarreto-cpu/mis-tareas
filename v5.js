// Mis Tareas V5 - dashboard, filtros, edición, calendario y voz.
(function(){
  const $ = id => document.getElementById(id);
  let tasksV5 = [];
  let calendarAnchor = new Date();
  const todayISO = () => { const d=new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10); };
  const escV5 = v => String(v ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmt = d => d ? new Date(d+'T00:00:00').toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit'}) : 'Sin fecha';
  const fullFmt = d => d ? new Date(d+'T00:00:00').toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'}) : 'Sin fecha';
  const priorityText = p => ({urgent:'Urgente',high:'Alta',normal:'Normal',low:'Baja'})[p]||p;
  const statusText = s => ({pending:'Pendiente',in_progress:'En curso',completed:'Completada'})[s]||s;
  function isOverdue(t){ return t.status!=='completed' && t.due_date && t.due_date < todayISO(); }

  async function fetchTasksV5(){
    if(!window.db || !window.currentUser) return;
    const {data,error}=await db.from('tasks').select('*, categories(name)').order('due_date',{ascending:true,nullsFirst:false}).order('due_time',{ascending:true,nullsFirst:false});
    if(error){ console.error(error); return; }
    tasksV5=data||[]; renderDashboard(); renderCalendar();
  }
  function filteredTasks(){
    const q=($('taskSearch')?.value||'').trim().toLowerCase();
    const f=$('taskFilter')?.value||'all';
    return tasksV5.filter(t=>{
      const text=[t.title,t.description,t.categories?.name].filter(Boolean).join(' ').toLowerCase();
      if(q && !text.includes(q)) return false;
      if(f==='today' && t.due_date!==todayISO()) return false;
      if(f==='pending' && t.status==='completed') return false;
      if(f==='urgent' && t.priority!=='urgent') return false;
      if(f==='completed' && t.status!=='completed') return false;
      if(f==='overdue' && !isOverdue(t)) return false;
      return true;
    });
  }
  function renderDashboard(){
    const pending=tasksV5.filter(t=>t.status!=='completed');
    $('pendingCount').textContent=pending.length;
    $('urgentCount').textContent=pending.filter(t=>t.priority==='urgent').length;
    $('doneCount').textContent=tasksV5.filter(t=>t.status==='completed').length;
    const list=filteredTasks();
    $('taskList').innerHTML=list.length?list.map(t=>`<div class="task ${escV5(t.priority)} ${t.status==='completed'?'completed':''} ${isOverdue(t)?'overdue':''}">
      <div class="task-main"><div class="task-title">${escV5(t.title)}</div><div class="task-meta">${escV5(priorityText(t.priority))} · ${escV5(statusText(t.status))} · ${t.due_date?fullFmt(t.due_date):'Sin fecha'}${t.due_time?' · '+escV5(t.due_time):''}${t.categories?.name?' · '+escV5(t.categories.name):''}</div>${t.description?`<div class="task-meta desc">${escV5(t.description)}</div>`:''}</div>
      <div class="task-actions">${t.status!=='completed'?`<button class="complete-btn" data-complete="${t.id}" title="Completar">✓</button>`:'<span class="done-mark">✓</span>'}<button class="edit-btn" data-edit="${t.id}" title="Editar">✎</button><button class="delete-mini" data-delete="${t.id}" title="Eliminar">×</button></div></div>`).join(''):'<div class="empty-state"><div class="empty-icon">✓</div><h3>No hay tareas con estos filtros</h3><p>Prueba otro filtro o crea una nueva tarea.</p></div>';
    $('taskList').querySelectorAll('[data-complete]').forEach(b=>b.onclick=()=>setCompleted(b.dataset.complete));
    $('taskList').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEdit(b.dataset.edit));
    $('taskList').querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deleteTaskV5(b.dataset.delete));
    const upcoming=tasksV5.filter(t=>t.status!=='completed'&&t.due_date).sort((a,b)=>((a.due_date||'9999')+(a.due_time||'' )).localeCompare((b.due_date||'9999')+(b.due_time||''))).slice(0,7);
    $('upcomingList').innerHTML=upcoming.length?upcoming.map(t=>`<div class="upcoming ${isOverdue(t)?'upcoming-overdue':''}"><b>${escV5(t.title)}</b><span>${fmt(t.due_date)}${t.due_time?' · '+escV5(t.due_time):''}</span></div>`).join(''):'<p class="muted">Sin próximas tareas.</p>';
  }
  async function setCompleted(id){const {error}=await db.from('tasks').update({status:'completed',completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',id);if(error)alert(error.message);else fetchTasksV5();}
  async function deleteTaskV5(id){const t=tasksV5.find(x=>String(x.id)===String(id));if(!t)return;if(!confirm(`¿Eliminar "${t.title}"?`))return;const {error}=await db.from('tasks').delete().eq('id',id);if(error)alert(error.message);else fetchTasksV5();}
  function resetForm(){ $('taskId').value='';$('taskTitle').value='';$('taskDescription').value='';$('taskDate').value=todayISO();$('taskTime').value='';$('taskPriority').value='normal';$('taskStatus').value='pending';$('taskCategory').value='';$('modalTitle').textContent='Nueva tarea';$('deleteTaskBtn').classList.add('hidden');$('taskError').textContent=''; }
  function openNew(){resetForm();$('modal').classList.remove('hidden');setTimeout(()=>$('taskTitle').focus(),50);}
  function openEdit(id){const t=tasksV5.find(x=>String(x.id)===String(id));if(!t)return;$('taskId').value=t.id;$('taskTitle').value=t.title||'';$('taskDescription').value=t.description||'';$('taskDate').value=t.due_date||'';$('taskTime').value=t.due_time||'';$('taskPriority').value=t.priority||'normal';$('taskStatus').value=t.status||'pending';$('taskCategory').value=t.category_id||'';$('modalTitle').textContent='Editar tarea';$('deleteTaskBtn').classList.remove('hidden');$('taskError').textContent='';$('modal').classList.remove('hidden');}
  async function saveTaskV5(e){e.preventDefault();$('taskError').textContent='';const user=await (window.ensureAuthReady?window.ensureAuthReady():window.ensureCurrentUser());if(!user){$('taskError').textContent='La sesión ha caducado. Activa la sincronización una vez en este dispositivo.';return;}const id=$('taskId').value;const payload={user_id:user.id,title:$('taskTitle').value.trim(),description:$('taskDescription').value.trim()||null,due_date:$('taskDate').value||null,due_time:$('taskTime').value||null,priority:$('taskPriority').value,status:$('taskStatus').value,category_id:$('taskCategory').value||null,updated_at:new Date().toISOString()};if(!payload.title){$('taskError').textContent='Escribe un título.';return;}let res=id?await db.from('tasks').update(payload).eq('id',id):await db.from('tasks').insert(payload);if(res.error){$('taskError').textContent=res.error.message;return;}$('modal').classList.add('hidden');fetchTasksV5();}
  function setupForm(){const old=$('taskForm');const clone=old.cloneNode(true);old.replaceWith(clone);clone.addEventListener('submit',saveTaskV5);$('closeModal').onclick=()=>$('modal').classList.add('hidden');$('newTaskBtn').onclick=openNew;$('deleteTaskBtn').onclick=()=>{const id=$('taskId').value;if(id)deleteTaskV5(id).then(()=>$('modal').classList.add('hidden'));};$('taskSearch').oninput=renderDashboard;$('taskFilter').onchange=renderDashboard;$('clearFiltersBtn').onclick=()=>{$('taskSearch').value='';$('taskFilter').value='all';renderDashboard();};$('refreshBtn').onclick=fetchTasksV5;}

  function startOfWeek(d){const x=new Date(d);x.setHours(0,0,0,0);const day=x.getDay();const diff=day===0?-6:1-day;x.setDate(x.getDate()+diff);return x;}
  function isoDate(d){return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);}
  function renderCalendar(){const start=startOfWeek(calendarAnchor);const days=[];for(let i=0;i<7;i++){const d=new Date(start);d.setDate(start.getDate()+i);days.push(d);}const end=days[6];$('calendarTitle').textContent=`Semana del ${start.toLocaleDateString('es-ES',{day:'numeric',month:'long'})} al ${end.toLocaleDateString('es-ES',{day:'numeric',month:'long'})}`;$('calendarGrid').innerHTML=days.map(d=>{const iso=isoDate(d),items=tasksV5.filter(t=>t.due_date===iso).sort((a,b)=>(a.due_time||'').localeCompare(b.due_time||''));return `<div class="day-col ${iso===todayISO()?'today-col':''}"><div class="day-head"><span>${d.toLocaleDateString('es-ES',{weekday:'short'})}</span><b>${d.getDate()}</b></div><div class="day-items">${items.length?items.map(t=>`<button class="calendar-task ${escV5(t.priority)}" data-cal-edit="${t.id}"><strong>${t.due_time?escV5(t.due_time)+' · ':''}${escV5(t.title)}</strong><small>${escV5(statusText(t.status))}</small></button>`).join(''):'<span class="no-day-task">—</span>'}</div></div>`}).join('');$('calendarGrid').querySelectorAll('[data-cal-edit]').forEach(b=>b.onclick=()=>openEdit(b.dataset.calEdit));}
  function setupCalendar(){ $('prevWeek').onclick=()=>{calendarAnchor.setDate(calendarAnchor.getDate()-7);renderCalendar();};$('nextWeek').onclick=()=>{calendarAnchor.setDate(calendarAnchor.getDate()+7);renderCalendar();};$('todayWeek').onclick=()=>{calendarAnchor=new Date();renderCalendar();}; }

  function setupVoice(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){$('voiceQuickBtn').title='El dictado por voz no está disponible en este navegador';$('voiceTaskBtn').title='El dictado por voz no está disponible en este navegador';return;}function listen(target){const r=new SR();r.lang='es-ES';r.interimResults=false;r.maxAlternatives=1;r.onstart=()=>{$('voiceStatus').textContent='Escuchando…';};r.onend=()=>{$('voiceStatus').textContent='';};r.onerror=e=>{$('voiceStatus').textContent='No se pudo usar el micrófono: '+e.error;};r.onresult=e=>{const text=e.results[0][0].transcript.trim();if(target==='quick'){$('modal').classList.remove('hidden');resetForm();$('taskTitle').value=text;}else $('taskTitle').value=text;};r.start();}$('voiceQuickBtn').onclick=()=>{openNew();setTimeout(()=>listen('quick'),250);};$('voiceTaskBtn').onclick=()=>listen('task');}

  function activateNav(){document.querySelectorAll('.nav-btn').forEach(btn=>btn.addEventListener('click',()=>{if(btn.dataset.section==='tasksSection')setTimeout(renderDashboard,0);if(btn.dataset.section==='calendarSection')setTimeout(renderCalendar,0);}));}
  window.ensureCurrentUser=ensureCurrentUser;
  window.addEventListener('load',async()=>{setupForm();setupCalendar();setupVoice();activateNav();await (window.authReady||Promise.resolve());if(window.currentUser) await fetchTasksV5();setInterval(()=>{if(window.currentUser)fetchTasksV5();},60000);});
})();
