const byId=id=>document.getElementById(id)
const tasks=byId('tasks'),network=byId('network'),refresh=byId('refresh'),older=byId('older'),provider=byId('provider'),fixtures=byId('fixtures')
let nextOffset=null,records=[]
const text=(tag,value,className)=>{const e=document.createElement(tag);e.textContent=value;if(className)e.className=className;return e}
const link=(label,url)=>{const e=text('a',label);e.href=url;e.target='_blank';e.rel='noopener noreferrer';return e}
function card(record){
  const e=document.createElement('article'),top=text('div','','cardtop')
  top.append(text('span',record.provider==='claude'?'Agent · Claude-capable':'0G worker','worker'),text('span',record.status.replaceAll('_',' '),'status'));e.append(top)
  if(record.facts.fixture)e.append(text('p','CONTROLLED DATA FIXTURE · No game actions','fixture'))
  e.append(text('h2',record.facts.completedSteps+' observed '+(record.facts.completedSteps===1?'step':'steps')),text('p','Job '+record.job,'job'))
  const list=document.createElement('ul')
  for(const fact of record.facts.actions){const parts=[fact.tool,fact.item?.replace('minecraft:','').replaceAll('_',' ')];for(const k of ['produced','collected','moved','verifiedBlocks'])if(fact[k]!==undefined)parts.push(k+': '+fact[k]);if(fact.position)parts.push('at '+fact.position.join(', '));list.append(text('li',parts.filter(Boolean).join(' · ')))}
  if(!list.children.length)list.append(text('li','No completed action facts yet.'))
  e.append(list)
  if(record.facts.pendingEffect)e.append(text('p','Effect uncertain: handoff is blocked until reconciliation.','warning'))
  const details=text('div','','details');details.append(text('p',record.facts.receipts+' local effect receipts · Revision '+record.revision),text('p','Publisher '+record.owner),text('p','Expires at block '+record.expiresAtBlock))
  if(record.facts.predecessor){const button=text('button','Read previous worker’s progress','outline');button.type='button';button.addEventListener('click',()=>readEntity(record.facts.predecessor));details.append(button)}
  const raw=document.createElement('details');raw.append(text('summary','View exact Arkiv record'),text('pre',JSON.stringify(record,null,2)));details.append(raw)
  details.append(link('Open entity in explorer ↗','https://rabdi.explorer.arkiv.network/entity/'+record.entityKey));e.append(details);return e
}
function render(){
  const visible=records.filter(r=>fixtures.checked||!r.facts.fixture)
  tasks.replaceChildren(...visible.map(card))
  if(!visible.length)tasks.append(text('p','No matching live records on this page. Expired records are not replaced with a saved success. You can include controlled test records or read older history.','empty'))
  byId('jobs').textContent=visible.length;byId('steps').textContent=visible.reduce((n,r)=>n+r.facts.completedSteps,0);byId('handoffs').textContent=visible.filter(r=>r.facts.predecessor).length
}
async function load(next=false){
  refresh.disabled=true;older.disabled=true;provider.disabled=true;network.textContent='Reading Rabdi…'
  try{
    const query=new URLSearchParams({offset:String(next?nextOffset:0)});if(provider.value)query.set('provider',provider.value)
    const response=await fetch('/api/tasks?'+query,{cache:'no-store'}),result=await response.json()
    if(!response.ok)throw Error(result.error||'ARKIV_UNAVAILABLE')
    records=result.records;nextOffset=result.nextOffset;render()
    network.textContent='Live Arkiv read · block '+result.blockNumber+' · '+new Date().toLocaleTimeString()+(result.rejected?' · '+result.rejected+' incompatible records omitted':'')
    older.hidden=nextOffset===null
  }catch{records=[];tasks.replaceChildren(text('p','Arkiv could not be reached. Retry the live read. No cached or simulated result is shown as current.','empty'));network.textContent='Live read unavailable';for(const id of ['jobs','steps','handoffs'])byId(id).textContent='—';older.hidden=true}
  finally{refresh.disabled=false;older.disabled=false;provider.disabled=false}
}
async function readEntity(key){
  const result=byId('entityResult');result.replaceChildren(text('p','Reading this entity from Arkiv…','small'))
  try{const response=await fetch('/api/entity?key='+encodeURIComponent(key),{cache:'no-store'}),data=await response.json();if(!response.ok)throw Error(data.error);result.replaceChildren(card(data.record));byId('entity').value=key;result.scrollIntoView({behavior:'smooth',block:'start'})}
  catch{result.replaceChildren(text('p','This entity is unavailable, expired, from another publisher/namespace, or does not match the supported schema.','empty'))}
}
refresh.addEventListener('click',()=>load());provider.addEventListener('change',()=>load());fixtures.addEventListener('change',render);older.addEventListener('click',()=>load(true));byId('lookup').addEventListener('submit',event=>{event.preventDefault();void readEntity(byId('entity').value.trim())});void load()
