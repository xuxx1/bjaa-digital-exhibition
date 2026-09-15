const state = { summary: null, section: 'dashboard', records: [], currentId: null, currentRecord: null };
const sectionOrder = ['current','reviews','previews','artworks','artists','news','lectures','activities','virtual-scenes','virtual-artworks'];
const sectionGroups = [{label:'展览管理',items:['current','reviews','previews']},{label:'馆藏内容',items:['artworks','artists']},{label:'公共内容',items:['news','lectures','activities']},{label:'数字展览',items:['virtual-scenes','virtual-artworks']}];
const icons = {'current':'01','reviews':'02','previews':'03','artworks':'04','artists':'05','news':'06','lectures':'07','activities':'08','virtual-scenes':'09','virtual-artworks':'10'};
const $ = selector => document.querySelector(selector);

async function api(url, options={}) {
  const response = await fetch(url, {headers:{'Content-Type':'application/json'}, ...options});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '请求失败');
  return data;
}
function escapeHtml(value='') { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function toast(message) { const el=$('#toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove('show'),2200); }

async function loadSummary() {
  state.summary = await api('/api/summary');
  renderNavigation();
  renderDashboard();
}
function renderNavigation() {
  const counts=state.summary.counts, labels=state.summary.sections;
  let html=`<button class="nav-item ${state.section==='dashboard'?'active':''}" data-section="dashboard"><span class="nav-icon">00</span><span>内容总览</span></button>`;
  sectionGroups.forEach(group=>{ html+=`<span class="nav-group-label">${group.label}</span>`; group.items.forEach(key=>{ html+=`<button class="nav-item ${state.section===key?'active':''}" data-section="${key}"><span class="nav-icon">${icons[key]}</span><span>${labels[key]}</span><span class="nav-count">${counts[key]}</span></button>`; }); });
  $('#navigation').innerHTML=html;
  document.querySelectorAll('.nav-item').forEach(button=>button.addEventListener('click',()=>switchSection(button.dataset.section)));
}
function renderDashboard() {
  const c=state.summary.counts;
  const metrics=[['当前及回顾展览',c.current+c.reviews,'EXHIBITIONS'],['馆藏作品',c.artworks,'ARTWORKS'],['新闻与公共项目',c.news+c.lectures+c.activities,'PROGRAMS'],['数字展厅场景',c['virtual-scenes'],'PANORAMAS']];
  $('#metricGrid').innerHTML=metrics.map(([label,count,en])=>`<article class="metric-card"><span>${label}</span><strong>${count}</strong><small>${en}</small></article>`).join('');
  const quick=['current','reviews','artworks','news'];
  $('#quickGrid').innerHTML=quick.map(key=>`<button class="quick-card" data-section="${key}"><b>${icons[key]}</b><div><strong>${state.summary.sections[key]}</strong><small>${c[key]} 条内容</small></div></button>`).join('');
  document.querySelectorAll('.quick-card').forEach(button=>button.addEventListener('click',()=>switchSection(button.dataset.section)));
  const recent=state.summary.recent;
  $('#activityList').innerHTML=recent.length?recent.map(item=>`<div class="activity-item"><b>${escapeHtml(item.action)}</b><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(state.summary.sections[item.section]||'全部内容')}</small></div><small>${escapeHtml(item.createdAt.slice(5,16).replace('T',' '))}</small></div>`).join(''):'<div class="empty-state"><p>保存内容后，操作记录会显示在这里。</p></div>';
}
async function switchSection(section) {
  state.section=section; $('#searchInput').value=''; renderNavigation();
  if(section==='dashboard') { $('#pageTitle').textContent='内容总览'; $('#dashboardView').hidden=false; $('#listView').hidden=true; $('#addButton').hidden=true; return; }
  $('#dashboardView').hidden=true; $('#listView').hidden=false; await loadRecords();
}
async function loadRecords(query='') {
  const data=await api(`/api/records?section=${encodeURIComponent(state.section)}&q=${encodeURIComponent(query)}`);
  state.records=data.records; $('#pageTitle').textContent=data.label; $('#addButton').hidden=!data.canAdd; $('#recordCount').textContent=`${data.records.length} 条内容`;
  $('#recordGrid').innerHTML=data.records.map(item=>`<button class="record-card" data-id="${item.id}"><div class="record-image">${item.image?`<img loading="lazy" src="/media?path=${encodeURIComponent(item.image)}" alt="">`:'内容'}</div><div class="record-body"><span class="record-source">${escapeHtml(item.source)}</span><strong class="record-title">${escapeHtml(item.title)}</strong><span class="record-subtitle">${escapeHtml(item.subtitle)}</span></div></button>`).join('');
  $('#emptyState').hidden=Boolean(data.records.length); document.querySelectorAll('.record-card').forEach(card=>card.addEventListener('click',()=>openEditor(card.dataset.id)));
}
async function openEditor(id) {
  const data=await api(`/api/record?id=${encodeURIComponent(id)}`); state.currentId=id; state.currentRecord=data.record;
  const listing=state.records.find(item=>item.id===id); $('#editorTitle').textContent=listing?.title||'编辑内容'; $('#editorSource').textContent=data.source;
  if(listing?.image){ $('#editorImage').src=`/media?path=${encodeURIComponent(listing.image)}`; $('#editorMedia').hidden=false; } else $('#editorMedia').hidden=true;
  renderForm(data.record); $('#drawerMask').hidden=false; $('#editorDrawer').classList.add('open'); $('#editorDrawer').setAttribute('aria-hidden','false');
}
function renderForm(record) {
  $('#editorForm').innerHTML=Object.entries(record).map(([key,value])=>{
    const label=`<label class="field-label"><span>${escapeHtml(fieldLabel(key))}</span><code>${escapeHtml(key)}</code></label>`;
    if(typeof value==='boolean') return `<div class="field-row" data-field="${escapeHtml(key)}">${label}<label class="bool-row"><input type="checkbox" ${value?'checked':''}><span>${value?'是':'否'}</span></label></div>`;
    if(Array.isArray(value)||value&&typeof value==='object') return `<div class="field-row" data-field="${escapeHtml(key)}" data-json="true">${label}<textarea class="field-input json">${escapeHtml(JSON.stringify(value,null,2))}</textarea></div>`;
    const long=String(value??'').length>80||['intro','content','summary','source'].includes(key);
    return `<div class="field-row" data-field="${escapeHtml(key)}">${label}${long?`<textarea class="field-input textarea">${escapeHtml(value??'')}</textarea>`:`<input class="field-input" value="${escapeHtml(value??'')}">`}</div>`;
  }).join('');
  document.querySelectorAll('.bool-row input').forEach(input=>input.addEventListener('change',()=>input.nextElementSibling.textContent=input.checked?'是':'否'));
}
function fieldLabel(key){ return ({title:'标题',name:'名称',type:'类型',date:'日期',time:'时间',location:'地点',organizer:'主办单位',intro:'完整介绍',summary:'摘要',artist:'作者',size:'尺寸',material:'材质',year:'年代',content:'正文内容',works:'展览作品',images:'图片',local_images:'本地图片',local_image:'本地图片',cover_image:'封面图片',source:'来源',reservable:'允许预约',statusText:'状态文字',scene:'场景编号',preview:'场景预览'})[key]||key; }
function collectForm() {
  const record={}; document.querySelectorAll('#editorForm .field-row').forEach(row=>{ const key=row.dataset.field; const checkbox=row.querySelector('input[type=checkbox]'); const control=row.querySelector('input,textarea'); if(checkbox) record[key]=checkbox.checked; else if(row.dataset.json) { try{record[key]=JSON.parse(control.value)}catch{throw new Error(`${fieldLabel(key)}不是有效 JSON`)} } else record[key]=control.value; }); return record;
}
function closeEditor(){ $('#editorDrawer').classList.remove('open'); $('#editorDrawer').setAttribute('aria-hidden','true'); setTimeout(()=>$('#drawerMask').hidden=true,240); }
async function saveRecord(){ try{ const record=collectForm(); await api('/api/record',{method:'PUT',body:JSON.stringify({id:state.currentId,record})}); closeEditor(); toast('内容已保存，并完成自动备份'); await loadSummary(); await loadRecords($('#searchInput').value); }catch(error){toast(error.message)} }
async function deleteRecord(){ if(!confirm('确定删除这条内容吗？原文件会自动备份。'))return; try{await api(`/api/record?id=${encodeURIComponent(state.currentId)}`,{method:'DELETE'}); closeEditor(); toast('内容已删除'); await loadSummary(); await loadRecords();}catch(error){toast(error.message)} }
async function addRecord(){ try{const data=await api('/api/records',{method:'POST',body:JSON.stringify({section:state.section})}); toast('已创建一条新内容'); await loadSummary(); await loadRecords(); await openEditor(data.id);}catch(error){toast(error.message)} }
async function exportData(){ try{const data=await api('/api/export',{method:'POST',body:'{}'}); toast(`数据包已生成：${data.path}`); await loadSummary();}catch(error){toast(error.message)} }

let searchTimer; $('#searchInput').addEventListener('input',event=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>state.section!=='dashboard'&&loadRecords(event.target.value),250)});
$('#addButton').addEventListener('click',addRecord); $('#exportButton').addEventListener('click',exportData); $('#saveButton').addEventListener('click',saveRecord); $('#deleteButton').addEventListener('click',deleteRecord); $('#closeEditor').addEventListener('click',closeEditor); $('#cancelButton').addEventListener('click',closeEditor); $('#drawerMask').addEventListener('click',closeEditor);
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeEditor();if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'&&state.currentId){event.preventDefault();saveRecord();}});
loadSummary().catch(error=>toast(error.message));
