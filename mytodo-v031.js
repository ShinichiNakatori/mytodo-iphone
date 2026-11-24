
(()=>{'use strict';
const KEY='mytodo-v01-data'; // 旧版互換
const PRIORITY={critical:{label:'最重要',rank:0},high:{label:'高',rank:1},normal:{label:'中',rank:2},low:{label:'低',rank:3}};const COLORS=['#64748b','#ef4444','#f59e0b','#eab308','#22a06b','#3b82f6','#a855f7'];const id=()=>crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random();
const seed=()=>({version:1,lists:[{id:'personal',name:'個人'},{id:'shopping',name:'買い物'}],tasks:[],orderAll:[],selectedList:'all',selectedTask:null});
const MAX_BYTES=2*1024*1024;
const MAX_TASKS=5000;
function validateData(value,allowLegacy=false){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('データ本体が不正です');
  if(!Array.isArray(value.lists)||!Array.isArray(value.tasks))throw Error('リストやToDoの形式が不正です');
  if(value.lists.length>200||value.tasks.length>MAX_TASKS)throw Error('データ件数が上限を超えています');
  const text=(x,max,label)=>{if(typeof x!=='string'||x.length>max)throw Error(label+'の形式が不正です');return x};
  const listIds=new Set(),taskIds=new Set();
  const lists=value.lists.map(l=>{if(!l||typeof l!=='object')throw Error('リストが不正です');const lid=text(l.id,100,'リストID');if(!lid||listIds.has(lid))throw Error('リストIDが重複しています');listIds.add(lid);return {id:lid,name:text(l.name,200,'リスト名')}});
  const datestring=(x)=>{if(x===undefined||x===null||x==='')return '';if(typeof x!=='string'||x.length>50||!Number.isFinite(Date.parse(x)))throw Error('日付が不正です');return x};
  const notes=(xs,history)=>{if(xs===undefined&&allowLegacy)return [];if(!Array.isArray(xs)||xs.length>500)throw Error('メモ件数または形式が不正です');const ids=new Set();return xs.map(n=>{if(!n||typeof n!=='object')throw Error('メモが不正です');const nid=text(n.id,100,'メモID');if(!nid||ids.has(nid))throw Error('メモIDが重複しています');ids.add(nid);return {...{id:nid,text:text(n.text,30000,'メモ本文'),createdAt:datestring(n.createdAt)||new Date().toISOString()},...(history?{}:{updatedAt:datestring(n.updatedAt)||datestring(n.createdAt)||new Date().toISOString()})}})};
  const tasks=value.tasks.map(t=>{if(!t||typeof t!=='object')throw Error('ToDoが不正です');const tid=text(t.id,100,'ToDo ID');if(!tid||taskIds.has(tid))throw Error('ToDo IDが重複しています');taskIds.add(tid);const lid=text(t.listId,100,'所属リスト');if(!listIds.has(lid))throw Error('存在しないリストへの参照があります');const order=Number(t.order||0);if(!Number.isFinite(order))throw Error('表示順が不正です');return {id:tid,listId:lid,title:text(t.title,1000,'ToDoタイトル'),done:!!t.done,order,priority:Object.hasOwn(PRIORITY,t.priority)?t.priority:'normal',color:COLORS.includes(t.color)?t.color:COLORS[0],dueAt:datestring(t.dueAt),remindAt:datestring(t.remindAt),remindedAt:datestring(t.remindedAt),notes:notes(t.notes,false),history:notes(t.history,true)}});
  const orderInput=Array.isArray(value.orderAll)?value.orderAll:allowLegacy?[]:null;if(orderInput===null||orderInput.length>MAX_TASKS)throw Error('全件表示順が不正です');
  const orderAll=[];for(const key of orderInput){if(typeof key!=='string'||!taskIds.has(key)||orderAll.includes(key))continue;orderAll.push(key)}for(const task of tasks)if(!orderAll.includes(task.id))orderAll.push(task.id);
  return {version:3,lists,tasks,orderAll,selectedList:typeof value.selectedList==='string'&&(value.selectedList==='all'||listIds.has(value.selectedList))?value.selectedList:'all',selectedTask:typeof value.selectedTask==='string'&&taskIds.has(value.selectedTask)?value.selectedTask:null};
}
function validateSize(s){if(new TextEncoder().encode(s).length>MAX_BYTES)throw Error('データ容量が2MBを超えています')}
const SNAPSHOT_KEY='mytodo-v031-protection';
function snapshot(reason,value){const raw=typeof value==='string'?value:JSON.stringify(value);validateSize(raw);const old=JSON.parse(localStorage.getItem(SNAPSHOT_KEY)||'[]');old.push({at:new Date().toISOString(),reason,body:raw});while(old.length>2||JSON.stringify(old).length>2000000)old.shift();localStorage.setItem(SNAPSHOT_KEY,JSON.stringify(old));return true}
function saveFile(name,data){const blob=new Blob([data],{type:'application/json'});const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),2000)}
let db;try{const raw=localStorage.getItem(KEY);db=raw?validateData(JSON.parse(raw),true):seed();}catch(e){
  const raw=localStorage.getItem(KEY);if(raw){try{localStorage.setItem('mytodo-v031-corrupt-'+Date.now(),raw)}catch{}}
  db=seed();alert('既存データが不正です。元のデータは消さず、可能な場合は退避しました。バックアップを確認してください。');
}
db.orderAll ||= []; db.selectedList ||= 'all';
const $=s=>document.querySelector(s), el=(tag,cl,txt)=>{const n=document.createElement(tag);if(cl)n.className=cl;if(txt!==undefined)n.textContent=txt;return n};
const save=()=>{try{const serialized=JSON.stringify(db);validateSize(serialized);localStorage.setItem(KEY,serialized);$('#saveStatus').textContent='端末内に保存済み · '+new Date().toLocaleTimeString('ja-JP');}catch(e){$('#saveStatus').textContent='保存に失敗しました';alert('保存できません。ブラウザの容量・プライベートモードをご確認ください。')}};
const taskById=id=>db.tasks.find(t=>t.id===id);
const normalize=()=>{const ids=db.tasks.map(t=>t.id);db.orderAll=[...new Set([...db.orderAll.filter(x=>ids.includes(x)),...ids])];db.tasks.forEach(t=>{t.notes ||= [];t.history ||= [];t.order ||=0;t.priority=PRIORITY[t.priority]?t.priority:'normal';t.color=COLORS.includes(t.color)?t.color:COLORS[0];t.dueAt ||= '';t.remindAt ||= '';t.remindedAt ||= ''; });};
function button(txt,fn,cls='btn tiny'){const b=el('button',cls,txt);b.type='button';b.addEventListener('click',fn);return b}
function display(){normalize();renderLists();renderTasks();renderDetail();save();if(typeof sync!=="undefined")checkLocalDelta()}
function renderLists(){const root=$('#lists');root.replaceChildren();const allCount=db.tasks.filter(t=>!t.done).length;const entries=[{id:'all',name:'すべて',count:allCount},...db.lists.map(l=>({...l,count:db.tasks.filter(t=>t.listId===l.id&&!t.done).length}))];entries.forEach(l=>{const b=button(l.name+'  ('+l.count+')',()=>{db.selectedList=l.id;display()},'listbutton'+(db.selectedList===l.id?' selected':''));root.append(b)});if(db.selectedList!=='all'){const list=db.lists.find(l=>l.id===db.selectedList);if(list){const actions=el('div','row section');actions.append(button('リスト名変更',()=>{const next=prompt('新しいリスト名',list.name);if(next?.trim()){list.name=next.trim();display()}}),button('リスト削除',()=>{const count=db.tasks.filter(t=>t.listId===list.id).length;if(count){alert('このリストにはToDoが残っています。先に別のリストへ移動してください。');return}if(confirm('空のリストを削除しますか？')){db.lists=db.lists.filter(x=>x.id!==list.id);db.selectedList='all';display()}},'btn tiny danger'));root.append(actions)}}}
function visibleTasks(){let ts=db.tasks.filter(t=>(db.selectedList==='all'||t.listId===db.selectedList)&&($('#showDone').checked||!t.done));const pf=$('#priorityFilter').value;if(pf!=='all')ts=ts.filter(t=>t.priority===pf);const search=$('#search').value.trim().toLowerCase();if(search)ts=ts.filter(t=>(t.title+' '+t.notes.map(n=>n.text).join(' ')+' '+t.history.map(n=>n.text).join(' ')).toLowerCase().includes(search));if(db.selectedList==='all')ts.sort((a,b)=>db.orderAll.indexOf(a.id)-db.orderAll.indexOf(b.id));else ts.sort((a,b)=>(a.order||0)-(b.order||0));const mode=$('#sortMode').value;if(mode==='priority')ts.sort((a,b)=>PRIORITY[a.priority].rank-PRIORITY[b.priority].rank);if(mode==='due')ts.sort((a,b)=>(a.dueAt||'9999').localeCompare(b.dueAt||'9999'));return ts}
function reorder(src,dst){
  const mode=$('#sortMode').value;
  if(mode==='due'||src===dst)return;
  const visible=visibleTasks(),source=taskById(src),target=taskById(dst);
  if(!source||!target)return;
  if(mode==='priority'){
    if(source.priority!==target.priority){$('#sortHelp').textContent='重要度順では同じ重要度の中だけ移動できます';return}
    // 同一重要度かつ現在表示中の項目だけを動かし、他の項目の位置は保持する
    const ordered=visible.filter(t=>t.priority===source.priority).map(t=>t.id);
    const si=ordered.indexOf(src),di=ordered.indexOf(dst);
    if(si<0||di<0)return;
    ordered.splice(si,1);ordered.splice(di,0,src);
    const selected=new Set(ordered);
    const replaceSlots=(allIds)=>{let k=0;return allIds.map(x=>selected.has(x)?ordered[k++]:x)};
    if(db.selectedList==='all'){
      db.orderAll=replaceSlots(db.orderAll);
    }else{
      const all=db.tasks.filter(t=>t.listId===db.selectedList)
        .sort((a,b)=>(a.order||0)-(b.order||0)).map(t=>t.id);
      replaceSlots(all).forEach((taskId,i)=>{taskById(taskId).order=(i+1)*100});
    }
    display();return;
  }
  // 自由な並び順：従来の動作を維持
  const ordered=visible.map(t=>t.id),si=ordered.indexOf(src),di=ordered.indexOf(dst);
  if(si<0||di<0)return;
  ordered.splice(si,1);ordered.splice(di,0,src);
  if(db.selectedList==='all'){
    const set=new Set(ordered);let idx=0;
    db.orderAll=db.orderAll.map(x=>set.has(x)?ordered[idx++]:x);
  }else{
    ordered.forEach((id,i)=>taskById(id).order=i*100);
    const group=db.tasks.filter(t=>t.listId===db.selectedList&&!ordered.includes(t.id));
    group.forEach((t,i)=>t.order=(ordered.length+i)*100);
  }
  display();
}
function renderTasks(){const name=db.selectedList==='all'?'すべてのToDo':db.lists.find(l=>l.id===db.selectedList)?.name||'ToDo';$('#viewTitle').textContent=name;const root=$('#tasks');root.replaceChildren();const ts=visibleTasks();$('#sortHelp').textContent=$('#sortMode').value==='priority'?'同じ重要度内で ≡ をドラッグして並べ替え':$('#sortMode').value==='due'?'期限順ではドラッグできません':'≡ をドラッグして並べ替え（スマホも対応）';if(!ts.length)root.append(el('div','empty','表示するToDoがありません'));ts.forEach(t=>{const r=el('div','item'+(t.id===db.selectedTask?' active':'')+(t.done?' done':''));r.dataset.id=t.id;const sw=el('div','swatch');sw.style.background=t.color;const g=el('button','grip','≡');g.type='button';g.title='ドラッグして並べ替え';g.setAttribute('aria-label','ドラッグして並べ替え');g.disabled=$('#sortMode').value==='due';g.addEventListener('pointerdown',ev=>startDrag(ev,t.id,r));const c=el('input');c.type='checkbox';c.checked=!!t.done;c.title='完了';c.addEventListener('change',()=>{t.done=c.checked;display()});const content=el('button','grow');content.style.cssText='text-align:left;border:0;background:none;cursor:pointer;min-width:0';const title=el('div','itemtitle',t.title),meta=el('div','muted',db.lists.find(l=>l.id===t.listId)?.name+' · メモ '+t.notes.length+'件 · 履歴 '+t.history.length+'件');meta.style.fontSize='11px';const badges=el('div','row');badges.style.cssText='flex-wrap:wrap;gap:5px;margin-top:4px';badges.append(el('span','tag '+t.priority,PRIORITY[t.priority].label));if(t.dueAt){const overdue=!t.done&&new Date(t.dueAt).getTime()<Date.now();badges.append(el('span',overdue?'overdue':'muted',(overdue?'期限超過 ':'期限 ')+new Date(t.dueAt).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})))}if(t.remindAt)badges.append(el('span','reminder-mark','🔔'));content.append(title,meta,badges);content.addEventListener('click',()=>{db.selectedTask=t.id;document.body.classList.add('mobile-detail-open');display();});r.append(sw,g,c,content);root.append(r)});}
let drag=null;
function startDrag(e,source,node){if(e.button!==0&&e.pointerType==='mouse')return;e.preventDefault();node.querySelector('.grip').setPointerCapture(e.pointerId);drag={source,node,pointer:e.pointerId,target:null};node.classList.add('dragging');const move=ev=>{if(!drag)return;document.querySelectorAll('.drop-target').forEach(x=>x.classList.remove('drop-target'));const target=document.elementFromPoint(ev.clientX,ev.clientY)?.closest('#tasks .item');if(target&&target.dataset.id!==source){drag.target=target.dataset.id;target.classList.add('drop-target')}else drag.target=null};const finish=()=>{node.classList.remove('dragging');document.querySelectorAll('.drop-target').forEach(x=>x.classList.remove('drop-target'));const dest=drag?.target;drag=null;g.removeEventListener('pointermove',move);g.removeEventListener('pointerup',finish);g.removeEventListener('pointercancel',finish);if(dest)reorder(source,dest)};const g=node.querySelector('.grip');g.addEventListener('pointermove',move);g.addEventListener('pointerup',finish);g.addEventListener('pointercancel',finish)}
function renderDetail(){const root=$('#detail');root.replaceChildren();const t=taskById(db.selectedTask);if(!t){root.append(el('div','empty','ToDoを選択してください'));return}const title=el('input');title.value=t.title;title.style.width='100%';title.addEventListener('change',()=>{if(title.value.trim())t.title=title.value.trim();display()});root.append(title);
const label=el('label','muted','所属リスト');label.style.cssText='display:block;margin-top:12px;font-size:12px';const sel=el('select');sel.style.width='100%';db.lists.forEach(l=>{const opt=el('option',null,l.name);opt.value=l.id;opt.selected=l.id===t.listId;sel.append(opt)});sel.addEventListener('change',()=>{t.listId=sel.value;t.order=nextOrder(sel.value);display()});root.append(label,sel);
const fields=el('div','fields');const field=(labelText,widget)=>{const wrap=el('label','field',labelText);wrap.append(widget);fields.append(wrap);return widget};const prior=el('select');Object.entries(PRIORITY).forEach(([value,info])=>{const opt=el('option',null,info.label);opt.value=value;opt.selected=value===t.priority;prior.append(opt)});prior.addEventListener('change',()=>{t.priority=prior.value;display()});field('重要度',prior);
const due=el('input');due.type='datetime-local';due.value=t.dueAt||'';due.addEventListener('change',()=>{t.dueAt=due.value;display()});field('期限（任意）',due);
const remind=el('input');remind.type='datetime-local';remind.value=t.remindAt||'';remind.addEventListener('change',()=>{t.remindAt=remind.value;t.remindedAt='';display();checkReminders()});field('リマインド日時（任意）',remind);
const clear=button('🔔 解除',()=>{t.remindAt='';t.remindedAt='';display()},'btn tiny');const clearBox=el('div','field','リマインド解除');clearBox.append(clear);fields.append(clearBox);root.append(fields);
const colorWrap=el('div','section');colorWrap.append(el('b',null,'色分け'));const choices=el('div','colorchoices');COLORS.forEach(color=>{const b=button(' ',()=>{t.color=color;display()},'colorchoice'+(t.color===color?' chosen':''));b.style.background=color;b.title='色 '+color;b.setAttribute('aria-label','色 '+color);choices.append(b)});colorWrap.append(choices);root.append(colorWrap);
const action=el('div','row between section');action.append(el('b',null,'メモ・履歴'),button('このToDoを削除',()=>{if(confirm('このToDoとメモ・履歴を削除しますか？')){db.tasks=db.tasks.filter(x=>x.id!==t.id);db.orderAll=db.orderAll.filter(x=>x!==t.id);db.selectedTask=null;display()}},'btn tiny danger'));root.append(action);
root.append(el('h3',null,'独立メモ'));const list=el('div','stack');list.style.marginBottom='8px';t.notes.forEach((n,i)=>{const box=el('div','note');const area=el('textarea');area.value=n.text;area.addEventListener('change',()=>{n.text=area.value;n.updatedAt=new Date().toISOString();save();checkLocalDelta()});const sub=el('div','row between');const time=el('small',null,'更新: '+new Date(n.updatedAt||n.createdAt).toLocaleString('ja-JP'));const controls=el('div','rightbuttons');controls.append(button('↑',()=>{if(i>0){[t.notes[i-1],t.notes[i]]=[t.notes[i],t.notes[i-1]];display()}},'btn tiny'),button('↓',()=>{if(i<t.notes.length-1){[t.notes[i+1],t.notes[i]]=[t.notes[i],t.notes[i+1]];display()}},'btn tiny'),button('削除',()=>{if(confirm('メモを削除しますか？')){t.notes.splice(i,1);display()}},'btn tiny danger'));sub.append(time,controls);box.append(area,sub);list.append(box)});root.append(list);const noteInput=el('textarea');noteInput.placeholder='独立メモを追加';root.append(noteInput,button('＋ メモを追加',()=>{if(!noteInput.value.trim())return;const now=new Date().toISOString();t.notes.push({id:id(),text:noteInput.value.trim(),createdAt:now,updatedAt:now});display()},'btn primary'));
const hsection=el('div','section');hsection.append(el('h3',null,'日付付き履歴（追記型）'));const history=[...t.history].sort((a,b)=>a.createdAt.localeCompare(b.createdAt));history.forEach(n=>{const box=el('div','note');const line=el('div','row between');line.append(el('small',null,new Date(n.createdAt).toLocaleString('ja-JP')),button('削除',()=>{if(confirm('履歴を削除しますか？')){t.history=t.history.filter(x=>x.id!==n.id);display()}},'btn tiny danger'));box.append(line,el('p',null,n.text));hsection.append(box)});const histInput=el('textarea');histInput.placeholder='作業経過を追記';histInput.style.marginTop='8px';hsection.append(histInput,button('＋ 日時付きで追記',()=>{if(!histInput.value.trim())return;t.history.push({id:id(),text:histInput.value.trim(),createdAt:new Date().toISOString()});display()},'btn primary'));root.append(hsection);
}
// iPhone/スマホでは詳細をモーダル表示し、一覧位置を維持する
function setupMobileDetail(){
  const panel=$('#detailPanel'),heading=panel.querySelector('h2');
  const close=button('× 閉じる',()=>{document.body.classList.remove('mobile-detail-open');},'btn tiny');
  close.id='closeMobileDetail';close.type='button';
  heading.append(close);
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&document.body.classList.contains('mobile-detail-open')){
      document.body.classList.remove('mobile-detail-open');
    }
  });
}
setupMobileDetail();
function nextOrder(listId){return 100+Math.max(0,...db.tasks.filter(t=>t.listId===listId).map(t=>Number(t.order)||0))}
$('#addList').onclick=()=>{const v=$('#listName').value.trim();if(!v)return;const i=id();db.lists.push({id:i,name:v});db.selectedList=i;$('#listName').value='';display()};$('#listName').addEventListener('keydown',e=>{if(e.key==='Enter')$('#addList').click()});
$('#addTask').onclick=()=>{const title=$('#taskName').value.trim();if(!title)return;if(!db.lists.length){alert('最初にリストを追加してください');return}const listId=db.selectedList==='all'?db.lists[0].id:db.selectedList;const t={id:id(),title,listId,done:false,order:nextOrder(listId),notes:[],history:[],priority:'normal',color:COLORS[0],dueAt:'',remindAt:'',remindedAt:''};db.tasks.push(t);db.orderAll.push(t.id);db.selectedTask=t.id;$('#taskName').value='';display()};$('#taskName').addEventListener('keydown',e=>{if(e.key==='Enter')$('#addTask').click()});$('#showDone').onchange=renderTasks;$('#search').oninput=renderTasks;$('#priorityFilter').onchange=renderTasks;$('#sortMode').onchange=()=>{$('#sortHelp').textContent=$('#sortMode').value==='manual'?'≡ をドラッグして並べ替え（スマホも対応）':'自動並べ替え中。ドラッグするには「自由な並び順」に戻してください。';renderTasks()};
$('#exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify({...db,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='MyToDo_backup_'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
$('#importBtn').onclick=()=>$('#importFile').click();$('#importFile').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>MAX_BYTES)throw Error('2MBを超えるファイルは読み込めません');const parsed=validateData(JSON.parse(await file.text()),true);if(confirm('現在のデータをバックアップの内容で置き換えますか？')){snapshot('復元前の端末データ',db);db=parsed;sync.ready=false;sync.base=null;sync.conflict=false;sync.pending=false;display();if(sync.token)info("復元したローカルデータがあります。同期を再開するには「クラウドへ保存」か「クラウドから読み込み」を選択してください。")}}catch(e){alert('復元できませんでした: '+e.message)}e.target.value=''};
// リマインドはアプリを開いているときのみ画面内通知。ブラウザを閉じている間は次回起動時に通知。
let toastTimer=null;function checkReminders(){const now=Date.now();const pending=db.tasks.filter(t=>!t.done&&t.remindAt&&!t.remindedAt&&new Date(t.remindAt).getTime()<=now&&Number.isFinite(new Date(t.remindAt).getTime()));if(!pending.length)return;const t=pending[0];t.remindedAt=new Date().toISOString();save();checkLocalDelta();const toast=$('#reminderToast');toast.replaceChildren();toast.append(el('strong',null,'🔔 リマインド：'+t.title));const open=button('開く',()=>{db.selectedTask=t.id;db.selectedList='all';toast.classList.remove('show');display()},'btn tiny');const close=button('閉じる',()=>toast.classList.remove('show'),'btn tiny');toast.append(open,close);toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),30000);if('Notification'in window&&Notification.permission==='granted'){try{new Notification('MyToDo リマインド',{body:t.title})}catch(e){}}}
$('#saveStatus').title='ブラウザ内に保存します。OneDrive同期は未実装です。';window.addEventListener('focus',checkReminders);document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkReminders()});setInterval(checkReminders,15000);

// ----- OneDrive同期ベータ: OAuth 2.0 Authorization Code + PKCE (SPA) -----
const OAUTH_BASE='https://login.microsoftonline.com/consumers/oauth2/v2.0';
const GRAPH='https://graph.microsoft.com/v1.0';
const SCOPE='Files.ReadWrite.AppFolder User.Read';
const SYNCNAME='mytodo-v03.json';
const URI=location.origin+location.pathname;
const sync={token:null,expires:0,account:null,accountConfirmed:false,ready:false,busy:false,folderId:null,fileId:null,etag:null,base:null,conflict:false,pending:false,lastCheck:0,known:false};
const redirectLabel=$('#redirectUri');redirectLabel.textContent=URI;
$('#clientId').value=localStorage.getItem('mytodo-v03-client-id')||'';
const uuidOk=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const dataForCloud=()=>({version:3,lists:db.lists,tasks:db.tasks,orderAll:db.orderAll});
const fingerprint=()=>JSON.stringify(dataForCloud());
const info=(message,isError=false)=>{const e=$('#syncInfo');e.textContent=message;e.style.color=isError?'#b91c1c':'#475569';};
function buttons(){const authenticated=!!sync.token&&Date.now()<sync.expires-60000;$('#cloudReadBtn').disabled=!authenticated||sync.busy;$('#cloudWriteBtn').disabled=!authenticated||sync.busy;$('#signinBtn').disabled=sync.busy;}
function changed(){return sync.base!==null&&fingerprint()!==sync.base}
let deferSave=null;
function changedLocally(){if(!sync.ready||sync.conflict||!sync.token)return;sync.pending=true;clearTimeout(deferSave);deferSave=setTimeout(()=>{if(sync.pending&&!sync.busy)cloudSave(false).catch(e=>info('保存停止: '+e.message,true))},1800)}
const originalSave=save;
// 元のsave()は全操作で呼ばれるため、差分がある場合だけ同期を予約する。
// save関数自体はconstなので再代入せず、display()内の呼出し後に変更判定する。
function checkLocalDelta(){if(sync.ready&&changed())changedLocally()}
function base64url(bytes){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
async function sha256(s){return new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))}
function randomString(){return base64url(crypto.getRandomValues(new Uint8Array(32)))}
async function beginLogin(){
  if(!/^https:$/.test(location.protocol)&&location.hostname!=='localhost'&&location.hostname!=='127.0.0.1')throw Error('OAuth認証にはHTTPS公開またはlocalhostが必要です。file://で開くことはできません。');
  const client=$('#clientId').value.trim();if(!uuidOk(client))throw Error('正しいクライアントIDを入力してください。');
  localStorage.setItem('mytodo-v03-client-id',client);
  const verifier=randomString(),state=randomString();
  sessionStorage.setItem('mytodo-v03-oauth',JSON.stringify({verifier,state,client,uri:URI}));
  const challenge=base64url(await sha256(verifier));
  const u=new URL(OAUTH_BASE+'/authorize');
  Object.entries({client_id:client,response_type:'code',redirect_uri:URI,response_mode:'query',scope:'openid profile '+SCOPE,code_challenge:challenge,code_challenge_method:'S256',state,prompt:'select_account'}).forEach(([k,v])=>u.searchParams.set(k,v));
  location.assign(u.href)
}
async function receiveLogin(){
  const url=new URL(location.href),code=url.searchParams.get('code'),error=url.searchParams.get('error');
  if(!code&&!error)return;
  history.replaceState(null,'',URI+location.hash);
  const raw=sessionStorage.getItem('mytodo-v03-oauth');sessionStorage.removeItem('mytodo-v03-oauth');
  if(error)throw Error('Microsoft認証: '+(url.searchParams.get('error_description')||error));
  if(!raw)throw Error('認証セッションが見つかりません。同じタブで再試行してください。');
  const request=JSON.parse(raw);
  if(request.state!==url.searchParams.get('state')||request.uri!==URI)throw Error('認証状態の不一致です。再試行してください。');
  $('#clientId').value=request.client;
  const body=new URLSearchParams({client_id:request.client,scope:'openid profile '+SCOPE,code,redirect_uri:URI,grant_type:'authorization_code',code_verifier:request.verifier});
  const res=await fetch(OAUTH_BASE+'/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  const data=await res.json();if(!res.ok||!data.access_token)throw Error(data.error_description||'トークン交換失敗');
  sync.token=data.access_token;sync.expires=Date.now()+1000*(data.expires_in||3600);
  const user=await requestGraph('/me?$select=userPrincipalName,mail,displayName');
  const mail=user.data.mail||user.data.userPrincipalName||'';
  if(!mail||typeof mail!=='string')throw Error('アカウントを確認できません。User.Readを許可してください。');
  sync.account=mail;$('#accountInfo').textContent='認証アカウント：'+mail;
  sync.accountConfirmed=confirm('個人用OneDriveに接続します。\nアカウント：'+mail+'\n\n想定している個人用アカウントですか？');
  if(!sync.accountConfirmed){sync.token=null;sync.account=null;buttons();throw Error('アカウント確認をキャンセルしました。');}
  info('認証成功。クラウドを調べています。');buttons();await inspectCloud(true);
}
async function requestGraph(path,options={}){
  if(!sync.token||Date.now()>sync.expires-60000)throw Error('ログインの有効期限が切れました。「サインイン」で再認証してください。');
  if(!sync.accountConfirmed&&!path.startsWith('/me?'))throw Error('アカウント確認が必要です');
  const headers={Authorization:'Bearer '+sync.token,...(options.headers||{})};
  const res=await fetch(GRAPH+path,{...options,headers,cache:'no-store'});
  if(res.status===404)return {missing:true};
  if(!res.ok){let msg='HTTP '+res.status;try{const j=await res.json();msg+=' '+(j.error?.message||'')}catch{}throw Error(msg)}
  const ct=res.headers.get('content-type')||'';
  return {data:ct.includes('json')?await res.json():await res.text(),etag:res.headers.get('etag')};
}
async function folder(){if(sync.folderId)return sync.folderId;
  const r=await requestGraph('/me/drive/special/approot');
  if(r.missing)throw Error('アプリ専用フォルダーにアクセスできません。Files.ReadWrite.AppFolder権限を確認してください。');
  sync.folderId=r.data.id;return sync.folderId;
}
async function metadata(){const fid=await folder();const r=await requestGraph('/me/drive/items/'+encodeURIComponent(fid)+':/'+SYNCNAME);
  if(r.missing)return null;return {id:r.data.id,etag:r.data.eTag||r.data.etag};
}
async function remoteContent(meta){const r=await requestGraph('/me/drive/items/'+encodeURIComponent(meta.id)+'/content');
  if(r.missing)throw Error('クラウドデータが見つかりません。');
  const raw=typeof r.data==='string'?r.data:JSON.stringify(r.data);validateSize(raw);return validateData(JSON.parse(raw),true);
}
async function inspectCloud(initial=false){if(sync.busy)return;sync.busy=true;buttons();try{
  const meta=await metadata();sync.known=!!meta;sync.fileId=meta?.id||null;sync.etag=meta?.etag||null;
  sync.ready=false;sync.base=null;sync.conflict=false;
  info(meta?'クラウドに既存データがあります。①「クラウドから読み込み」か②「クラウドへ保存」（上書き）を選択してください。':'クラウドにデータはまだありません。「クラウドへ保存」を選択してください。');
}catch(e){info('接続確認失敗: '+e.message,true)}finally{sync.busy=false;buttons()}}
async function cloudRead(ask=true){if(sync.busy)return;sync.busy=true;buttons();try{
  const meta=await metadata();if(!meta)throw Error('クラウドデータがまだありません。先に保存してください。');
  if(ask&&!confirm('クラウドのデータを読み込みます。現在の端末データは置き換えられます。必要なら先にバックアップしてください。続けますか？'))return;
  const remote=await remoteContent(meta);snapshot('クラウド読み込み前の端末データ',db);
  db={...db,...remote,selectedList:'all',selectedTask:null};normalize();
  sync.fileId=meta.id;sync.etag=meta.etag;sync.ready=true;sync.conflict=false;sync.pending=false;
  display();sync.base=fingerprint();sync.lastCheck=Date.now();info('☁ クラウドから読み込み済み。自動同期中。');
}catch(e){info('読み込み失敗: '+e.message,true)}finally{sync.busy=false;buttons()}}
async function cloudSave(ask=true){if(sync.busy)return;sync.busy=true;buttons();try{
  const meta=await metadata();
  if(!sync.ready){
    if(meta&&ask&&!confirm('クラウドの既存データを端末の内容で上書きします。上書き前のクラウドデータを端末内に保護します。続けますか？'))return;
    if(meta){const old=await remoteContent(meta);snapshot('クラウド上書き前の保護',old)}
    if(meta&&!ask)throw Error('初回同期方法を選択してください。');
  }else if((meta?.etag||null)!==(sync.etag||null)){
    sync.conflict=true;sync.ready=false;info('⚠ 他端末による変更を検出。自動保存を停止しました。バックアップ後、読み込みまたはクラウド上書きを選択してください。',true);return;
  }
  if(meta===null&&sync.ready){sync.conflict=true;sync.ready=false;throw Error('クラウドファイルが削除されています。自動保存を停止しました。')}
  const fid=await folder();const path=meta?('/me/drive/items/'+encodeURIComponent(meta.id)+'/content'):('/me/drive/items/'+encodeURIComponent(fid)+':/'+SYNCNAME+':/content');
  const headers={'Content-Type':'text/plain'};if(meta?.etag)headers['If-Match']=meta.etag;else headers['If-None-Match']='*';
  const payload=fingerprint();validateSize(payload);const res=await requestGraph(path,{method:'PUT',headers,body:payload});
  if(res.missing)throw Error('保存先が見つかりません。');
  sync.fileId=res.data.id;sync.etag=res.data.eTag||res.data.etag||null;sync.base=payload;sync.ready=true;sync.conflict=false;sync.pending=false;sync.lastCheck=Date.now();
  info('☁ OneDriveに保存しました · '+new Date().toLocaleTimeString('ja-JP'));
  if(fingerprint()!==payload)changedLocally();
}catch(e){sync.ready=false;sync.conflict=true;info('⚠ 保存を停止しました: '+e.message+'（データは端末内に残っています）',true)}finally{sync.busy=false;buttons()}}
async function pollCloud(){if(!sync.ready||sync.busy||!sync.token||document.hidden)return;
  if(Date.now()-sync.lastCheck<25000)return;sync.busy=true;buttons();try{
    const meta=await metadata();sync.lastCheck=Date.now();
    if(!meta||meta.etag!==sync.etag){
      if(changed()||sync.pending){sync.ready=false;sync.conflict=true;info('⚠ 同時変更を検出。自動同期を停止しました。端末データをバックアップしてから、どちらを残すか選んでください。',true)}
      else if(meta){const remote=await remoteContent(meta);snapshot('別端末更新の取り込み前',db);db={...db,...remote,selectedList:db.selectedList,selectedTask:db.selectedTask};normalize();display();sync.base=fingerprint();sync.etag=meta.etag;sync.fileId=meta.id;info('☁ 別端末の変更を取り込みました · '+new Date().toLocaleTimeString('ja-JP'))}
      else{sync.ready=false;info('⚠ クラウドファイルが消えたため同期を停止しました。',true)}
    }
  }catch(e){info('同期確認エラー: '+e.message+'（端末には保存されています）',true)}finally{sync.busy=false;buttons()}}
$('#backupSnapshotsBtn').onclick=()=>{try{const arr=JSON.parse(localStorage.getItem(SNAPSHOT_KEY)||'[]');if(!arr.length){alert('保護バックアップはまだありません');return}saveFile('MyToDo_protection_'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(arr,null,2))}catch(e){alert('保護バックアップの出力失敗：'+e.message)}};
$('#signinBtn').onclick=()=>beginLogin().catch(e=>info(e.message,true));
$('#signoutBtn').onclick=()=>{sync.token=null;sync.account=null;sync.accountConfirmed=false;$('#accountInfo').textContent='認証アカウント：未確認';sync.ready=false;sync.base=null;sync.conflict=false;clearTimeout(deferSave);sync.pending=false;buttons();info('接続解除しました。ローカルデータは保持されています。')};
$('#cloudReadBtn').onclick=()=>cloudRead(true);
$('#cloudWriteBtn').onclick=()=>cloudSave(true);
setInterval(pollCloud,30000);
window.addEventListener('focus',pollCloud);
receiveLogin().catch(e=>info('認証失敗: '+e.message,true));

display();checkReminders();})();
