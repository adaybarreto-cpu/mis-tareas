const SUPABASE_URL = 'https://bdhrkjahiivxivefjves.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Cqae6XBhcnKnhzcH2M7P0w_7-vsT86H';
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY); window.db = db;
const $ = id => document.getElementById(id);
let currentUser = null;
let googleTokenClient = null;
let driveAccessToken = null;
let allSheets = [];

function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function fmtDate(d){if(!d)return 'Sin fecha'; const x=new Date(d+'T00:00:00'); return x.toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'numeric'})}
function priorityLabel(p){return ({urgent:'Urgente',high:'Alta',normal:'Normal',low:'Baja'})[p]||p}
function statusLabel(s){return ({pending:'Pendiente',in_progress:'En curso',completed:'Completada'})[s]||s}

let authReadyResolve; window.authReady = new Promise(r=>authReadyResolve=r);
async function loadSession(){ try { const {data:{session},error}=await db.auth.getSession(); if(error) throw error; if(session){ await showApp(session.user); } else { showLogin(); } return session; } catch(e){ console.error('Supabase session',e); showLogin(); return null; } finally { authReadyResolve(true); } }
function showLogin(){ $('loginView').classList.remove('hidden'); $('appView').classList.add('hidden'); currentUser=null; window.currentUser=null; }
async function showApp(user){ currentUser=user; window.currentUser=user; $('loginView').classList.add('hidden'); $('appView').classList.remove('hidden'); $('welcome').textContent='Tu agenda personal'; const now=new Date(); $('todayTitle').textContent=now.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'}); $('googleClientId').value=localStorage.getItem('misTareasGoogleClientId')||'699358995932-uhbghsm4cindr75d3iqig3rik2edlotr.apps.googleusercontent.com'; $('googleApiKey').value=localStorage.getItem('misTareasGoogleApiKey')||''; $('googleProjectNumber').value=localStorage.getItem('misTareasGoogleProjectNumber')||'699358995932'; await loadCategories(); await loadTasks(); renderDriveState(); }

async function ensureCurrentUser(){
  if(window.currentUser) return window.currentUser;
  const {data:{session},error}=await db.auth.getSession();
  if(error){console.error('Supabase getSession',error);return null;}
  if(session){currentUser=session.user;window.currentUser=session.user;return session.user;}
  return null;
}

$('loginForm').addEventListener('submit',async e=>{e.preventDefault(); $('loginError').textContent=''; const {error}=await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value}); if(error) $('loginError').textContent=error.message; else await loadSession();});
$('logoutBtn').addEventListener('click',async()=>{await db.auth.signOut();showLogin()});
db.auth.onAuthStateChange(async (_event,session)=>{ if(session){ await showApp(session.user); } else { showLogin(); } });
window.ensureAuthReady=async()=>{ await window.authReady; return ensureCurrentUser(); };
loadSession();

async function loadCategories(){const {data,error}=await db.from('categories').select('id,name').order('name'); if(error){console.error(error);return} $('taskCategory').innerHTML='<option value="">Sin categoría</option>'+(data||[]).map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}
async function loadTasks(){const {data,error}=await db.from('tasks').select('*, categories(name)').order('due_date',{ascending:true,nullsFirst:false}).order('due_time',{ascending:true,nullsFirst:false}); if(error){console.error(error); alert('No se pudieron cargar las tareas: '+error.message);return} renderTasks(data||[])}
function renderTasks(tasks){const pending=tasks.filter(t=>t.status!=='completed'); $('pendingCount').textContent=pending.length; $('urgentCount').textContent=pending.filter(t=>t.priority==='urgent').length; $('doneCount').textContent=tasks.filter(t=>t.status==='completed').length; const list=$('taskList'); list.innerHTML=tasks.length?tasks.map(t=>`<div class="task ${esc(t.priority)} ${t.status==='completed'?'completed':''}"><div><div class="task-title">${esc(t.title)}</div><div class="task-meta">${esc(priorityLabel(t.priority))} · ${esc(statusLabel(t.status))} · ${fmtDate(t.due_date)}${t.due_time?' · '+esc(t.due_time):''}${t.categories?.name?' · '+esc(t.categories.name):''}</div>${t.description?`<div class="task-meta">${esc(t.description)}</div>`:''}</div>${t.status!=='completed'?`<button class="complete-btn" data-id="${t.id}">✓</button>`:''}</div>`).join(''):'<p class="muted">No hay tareas todavía.</p>'; list.querySelectorAll('.complete-btn').forEach(b=>b.onclick=()=>completeTask(b.dataset.id)); const upcoming=tasks.filter(t=>t.status!=='completed'&&t.due_date).slice(0,7); $('upcomingList').innerHTML=upcoming.length?upcoming.map(t=>`<div class="upcoming"><b>${esc(t.title)}</b><span>${fmtDate(t.due_date)}${t.due_time?' · '+esc(t.due_time):''}</span></div>`).join(''):'<p class="muted">Sin próximas tareas.</p>'}
async function completeTask(id){const {error}=await db.from('tasks').update({status:'completed',completed_at:new Date().toISOString()}).eq('id',id); if(error) alert(error.message); else loadTasks()}
$('refreshBtn').onclick=loadTasks; $('newTaskBtn').onclick=()=>{$('modal').classList.remove('hidden');$('taskDate').value=new Date().toISOString().slice(0,10);$('taskError').textContent=''}; $('closeModal').onclick=()=>$('modal').classList.add('hidden');
$('taskForm').addEventListener('submit',async e=>{e.preventDefault(); $('taskError').textContent=''; if(!currentUser){$('taskError').textContent='La sesión ha caducado. Inicia sesión de nuevo.';return} const payload={user_id:currentUser.id,title:$('taskTitle').value.trim(),description:$('taskDescription').value.trim()||null,due_date:$('taskDate').value||null,due_time:$('taskTime').value||null,priority:$('taskPriority').value,status:$('taskStatus').value,category_id:$('taskCategory').value||null}; const {error}=await db.from('tasks').insert(payload); if(error){$('taskError').textContent=error.message;return} $('taskForm').reset();$('modal').classList.add('hidden');await loadTasks()});

// Navegación interna
for(const btn of document.querySelectorAll('.nav-btn')) btn.addEventListener('click',()=>{document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));document.querySelectorAll('.app-section').forEach(s=>s.classList.add('hidden'));btn.classList.add('active');$(btn.dataset.section).classList.remove('hidden');if(btn.dataset.section==='sheetsSection') renderSheets();});

// Google Drive / Sheets — V4.4.3 (Google Identity Services + official Picker)
function renderDriveState(message=''){const connected=!!driveAccessToken; $('syncStatus').textContent=connected?'☁ Drive conectado':'☁ Sincronizado'; $('driveState').innerHTML=message||(!localStorage.getItem('misTareasGoogleClientId')?'<div class="info-box">Para usar Google Sheets, guarda primero tu Google OAuth Client ID en Configuración.</div>':connected?'<div class="success-box">Google Drive conectado. Puedes seleccionar hojas con el selector oficial.</div>':'<div class="info-box">Pulsa <b>Conectar Google Drive</b> o <b>Elegir desde Google Drive</b>.</div>');}
function getClientId(){return localStorage.getItem('misTareasGoogleClientId')||$('googleClientId').value.trim()}
function getApiKey(){return localStorage.getItem('misTareasGoogleApiKey')||$('googleApiKey').value.trim()}
function getProjectNumber(){return localStorage.getItem('misTareasGoogleProjectNumber')||$('googleProjectNumber').value.trim()}
const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.metadata.readonly';
function makeGoogleTokenClient(onToken){
  const clientId=getClientId();
  if(!clientId){renderDriveState('<div class="warning-box">Falta el Google OAuth Client ID. Ve a Configuración.</div>');return null}
  if(!window.google?.accounts?.oauth2){renderDriveState('<div class="warning-box">Google todavía está cargando. Espera unos segundos y vuelve a intentarlo.</div>');return null}
  googleTokenClient=google.accounts.oauth2.initTokenClient({
    client_id:clientId,
    scope:DRIVE_SCOPE,
    include_granted_scopes:true,
    callback:onToken
  });
  return googleTokenClient;
}
function handleGoogleToken(response, after){
  if(!response || response.error){
    const detail=response?.error_description||response?.error||'No se pudo obtener el permiso de Google.';
    renderDriveState('<div class="error-box">Google no pudo autorizar el acceso: '+esc(detail)+'</div>');
    return;
  }
  driveAccessToken=response.access_token;
  renderDriveState();
  if(after) after();
}
$('connectDriveBtn').onclick=()=>{
  const client=makeGoogleTokenClient((response)=>handleGoogleToken(response,loadSheets));
  if(client) client.requestAccessToken({prompt:driveAccessToken?'':'consent'});
};

let pickerApiLoaded=false;
function loadPickerApi(){return new Promise((resolve,reject)=>{
  if(window.google?.picker){pickerApiLoaded=true;resolve();return}
  if(!window.gapi){reject(new Error('Google API Loader no está disponible.'));return}
  gapi.load('picker',{callback:()=>{pickerApiLoaded=true;resolve()},onerror:()=>reject(new Error('No se pudo cargar Google Picker.'))});
});}
async function openGooglePicker(){
  const clientId=getClientId(), apiKey=getApiKey(), appId=getProjectNumber();
  if(!clientId){renderDriveState('<div class="warning-box">Falta el Google OAuth Client ID. Ve a Configuración.</div>');return}
  if(!apiKey || !appId){renderDriveState('<div class="warning-box">Faltan la API Key y/o el número de proyecto. Ve a Configuración.</div>');return}
  if(!window.google?.accounts?.oauth2){renderDriveState('<div class="warning-box">Google todavía está cargando. Espera unos segundos y vuelve a intentarlo.</div>');return}
  try{await loadPickerApi();}catch(e){renderDriveState('<div class="error-box">'+esc(e.message)+'</div>');return}
  const show=()=>{
    try{
      const view=new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS);
      view.setIncludeFolders(false);
      view.setSelectFolderEnabled(false);
      const picker=new google.picker.PickerBuilder()
        .setDeveloperKey(apiKey)
        .setAppId(appId)
        .setOAuthToken(driveAccessToken)
        .setOrigin(window.location.origin)
        .addView(view)
        .setCallback(pickerCallback)
        .build();
      picker.setVisible(true);
    }catch(e){renderDriveState('<div class="error-box">No se pudo abrir Google Picker: '+esc(e.message||String(e))+'</div>');}
  };
  if(driveAccessToken){show();return}
  const client=makeGoogleTokenClient((response)=>handleGoogleToken(response,show));
  if(client) client.requestAccessToken({prompt:'consent'});
}
function pickerCallback(data){
  if(data.action!==google.picker.Action.PICKED)return;
  const docs=data[google.picker.Response.DOCUMENTS]||[];
  const chosen=docs[0]; if(!chosen)return;
  const id=chosen[google.picker.Document.ID];
  const name=chosen[google.picker.Document.NAME]||'Google Sheet';
  const url=chosen[google.picker.Document.URL]||('https://docs.google.com/spreadsheets/d/'+id+'/edit');
  let saved=JSON.parse(localStorage.getItem('misTareasPickedSheets')||'[]');
  if(!saved.some(x=>x.id===id)) saved.unshift({id,name,url,addedAt:new Date().toISOString()});
  localStorage.setItem('misTareasPickedSheets',JSON.stringify(saved.slice(0,100)));
  renderPickedSheets();
}
function renderPickedSheets(){const wrap=$('pickedSheets');if(!wrap)return;const saved=JSON.parse(localStorage.getItem('misTareasPickedSheets')||'[]');wrap.innerHTML=saved.length?'<h3>⭐ Seleccionadas por ti</h3>'+saved.map(s=>`<a class="sheet-card picked" href="${esc(s.url)}" target="_blank" rel="noopener"><div class="sheet-icon">📊</div><div class="sheet-info"><b>${esc(s.name)}</b><small>Guardada en Mis Tareas</small></div><span class="open-arrow">↗</span></a>`).join(''):'<p class="muted">Todavía no has seleccionado hojas.</p>';}
$('pickSheetBtn').onclick=openGooglePicker;
$('refreshSheetsBtn').onclick=()=>{if(driveAccessToken)loadSheets();else renderDriveState()};
$('sheetSearch').addEventListener('input',renderSheets);
$('saveGoogleClientId').onclick=()=>{const id=$('googleClientId').value.trim(),key=$('googleApiKey').value.trim(),project=$('googleProjectNumber').value.trim();if(!id){$('settingsMessage').textContent='Introduce un Client ID válido.';return}localStorage.setItem('misTareasGoogleClientId',id);if(key)localStorage.setItem('misTareasGoogleApiKey',key);if(project)localStorage.setItem('misTareasGoogleProjectNumber',project);$('settingsMessage').textContent='Configuración de Google guardada en este dispositivo.';renderDriveState()};
$('disconnectDrive').onclick=()=>{driveAccessToken=null;googleTokenClient=null;allSheets=[];renderSheets();renderPickedSheets();renderDriveState('<div class="info-box">Google Drive desconectado en este dispositivo.</div>');};
renderPickedSheets();

async function loadSheets(){
  if(!driveAccessToken)return;
  $('sheetsGrid').innerHTML='<div class="loading">Buscando tus Google Sheets…</div>';
  const headers={Authorization:'Bearer '+driveAccessToken};
  const fields='files(id,name,webViewLink,modifiedTime,mimeType,iconLink,owners(displayName,emailAddress),shared,driveId,sharedWithMeTime),nextPageToken,incompleteSearch';
  async function listAll(params){
    let pageToken=''; const files=[]; let incomplete=false;
    do{
      const r=await fetch('https://www.googleapis.com/drive/v3/files?'+new URLSearchParams({...params,...(pageToken?{pageToken}:{})}),{headers});
      let data=null; try{data=await r.json()}catch(e){}
      if(r.status===401) return {response:r,data,authExpired:true};
      if(!r.ok) return {response:r,data,error:true};
      if(data?.files) files.push(...data.files);
      pageToken=data?.nextPageToken||'';
      incomplete=incomplete||!!data?.incompleteSearch;
    }while(pageToken);
    return {response:{status:200},data:{files,incompleteSearch:incomplete}};
  }
  const common={pageSize:'1000',orderBy:'modifiedTime desc',includeItemsFromAllDrives:'true',supportsAllDrives:'true',spaces:'drive',fields};
  const q="mimeType='application/vnd.google-apps.spreadsheet' and trashed=false";
  const results=[];
  // 1) Mi unidad + elementos directamente compartidos con el usuario.
  const accessible=await listAll({...common,q,corpora:'user'});
  if(accessible.authExpired){driveAccessToken=null;renderDriveState('<div class="warning-box">La autorización de Google ha caducado. Pulsa Conectar Google Drive de nuevo.</div>');return}
  if(accessible.error){console.error('Drive user search',accessible);}
  if(accessible.data?.files) results.push(...accessible.data.files);

  // 2) Elementos que Drive marca explícitamente como "Compartidos conmigo".
  const shared=await listAll({...common,q:'sharedWithMe and '+q});
  if(shared.authExpired){driveAccessToken=null;renderDriveState('<div class="warning-box">La autorización de Google ha caducado. Pulsa Conectar Google Drive de nuevo.</div>');return}
  if(shared.data?.files) results.push(...shared.data.files);

  // 3) Búsqueda explícita por permiso de lectura de la cuenta autorizada.
  //    Esto cubre archivos compartidos directamente aunque no aparezcan en sharedWithMe.
  let meEmail='';
  try{
    const ar=await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)',{headers});
    if(ar.ok){const ad=await ar.json();meEmail=ad?.user?.emailAddress||'';}
  }catch(e){}
  if(meEmail){
    const safeEmail=meEmail.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const byPermission=await listAll({...common,q:`'${safeEmail}' in readers and ${q}`});
    if(byPermission.authExpired){driveAccessToken=null;renderDriveState('<div class="warning-box">La autorización de Google ha caducado. Pulsa Conectar Google Drive de nuevo.</div>');return}
    if(byPermission.data?.files) results.push(...byPermission.data.files);
  }

  // 4) Unidades compartidas.
  const allDrives=await listAll({...common,q,corpora:'allDrives'});
  if(allDrives.authExpired){driveAccessToken=null;renderDriveState('<div class="warning-box">La autorización de Google ha caducado. Pulsa Conectar Google Drive de nuevo.</div>');return}
  if(allDrives.data?.files) results.push(...allDrives.data.files);

  const seen=new Set();
  allSheets=results.filter(s=>s&&!seen.has(s.id)&&seen.add(s.id)).sort((a,b)=>new Date(b.modifiedTime||0)-new Date(a.modifiedTime||0));
  renderSheets();
  renderDriveState('<div class="success-box">Google Drive conectado. '+allSheets.length+' hojas accesibles encontradas.</div>');
}

function renderSheets(){const q=($('sheetSearch')?.value||'').trim().toLowerCase();const list=allSheets.filter(s=>!q||s.name.toLowerCase().includes(q));if(!allSheets.length){$('sheetsGrid').innerHTML='<div class="empty-state"><div class="empty-icon">📊</div><h3>Aún no hay hojas cargadas</h3><p>Conecta Google Drive para ver tus Google Sheets.</p></div>';return}$('sheetsGrid').innerHTML=list.length?list.map(s=>{const owner=(s.owners&&s.owners[0]?.displayName)||'';const shared=!!s.shared||!s.owners||!s.owners.length;return `<a class="sheet-card" href="${esc(s.webViewLink||('https://docs.google.com/spreadsheets/d/'+s.id))}" target="_blank" rel="noopener"><div class="sheet-icon">📊</div><div class="sheet-info"><b>${esc(s.name)}</b><span>Modificado: ${new Date(s.modifiedTime).toLocaleDateString('es-ES')}</span>${shared?`<small>🤝 Compartido contigo${owner?' · '+esc(owner):''}</small>`:''}</div><span class="open-arrow">↗</span></a>`}).join(''):'<div class="empty-state"><div class="empty-icon">🔎</div><h3>No encontramos esa hoja</h3><p>Prueba con otro término de búsqueda.</p></div>'}

window.ensureCurrentUser = ensureCurrentUser;
