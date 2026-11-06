import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash,randomUUID} from 'node:crypto'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {build} from 'esbuild'
import {stringToHex} from 'viem'
import {createTaskReader,validateProgress} from '../src/read.mjs'
import {projectProgress} from '../src/project.mjs'
import {makeWorkSpec,workDigest,validateWorkRecord,withWorkOrders} from '../src/work-orders.mjs'

test('work-order SDK schema validates exact recipes and publisher-bound mixed entity reads',async()=>{
 const server='a'.repeat(64),publisher='0x'+'11'.repeat(20),key='0x'+'22'.repeat(32)
 const regions=['CityAgent5','CityAgent4'].map((slotName,i)=>({slotName,sourceChest:[i*16,69,0],destinationChest:[i*16,69,2]}))
 const spec=makeWorkSpec({id:randomUUID(),kind:'craft_delivery',item:'stick',count:4,worker:'claude',regions})
 assert.equal(spec.input.count,2)
 const record={recordType:'work-order',server,order:spec.id,kind:spec.kind,item:spec.item,status:'open',stage:0,deadline:spec.deadline,data:{version:1,spec,specDigest:workDigest(spec),verifications:[],claim:null,fixture:true}}
 validateWorkRecord(record,server)
 assert.throws(()=>validateWorkRecord({...record,status:'completed'},server),/WORK_ORDER_STATE_INVALID/)
 assert.throws(()=>validateWorkRecord({...record,data:{...record.data,spec:{...spec,count:8}}},server),/WORK_ORDER_STAGE_INVALID/)
 const row={...Object.fromEntries(['server','kind','item','status'].map(k=>[k,{value:record[k]}])),orderId:{value:record.order},stage:{value:0n},deadline:{value:BigInt(record.deadline)},revision:{value:1n},data:{value:stringToHex(JSON.stringify(record.data))},$key:key,$owner:publisher,$expiresAt:200n}
 const reader=withWorkOrders({server,publisher,client:{getEntity:async()=>row},get:async()=>{const error=Error('other schema');error.name='SchemaMismatchError';throw error}},validateProgress)
 assert.equal((await reader.get(key)).data.spec.input.count,2)
 row.$owner='0x'+'33'.repeat(20);await assert.rejects(reader.get(key),/ARKIV_PUBLISHER_MISMATCH/)
})

test('typed public projection excludes private prompts and only accepts the configured publisher',async()=>{
 const server='a'.repeat(64),job={id:randomUUID(),status:'paused',goal:'PRIVATE PROMPT',ownerId:randomUUID(),history:[{step:{tool:'craft',item:'stick',count:4},result:{produced:4}}]}
 const record=projectProgress(job,'claude',server)
 assert(!JSON.stringify(record).includes(job.goal));assert(!JSON.stringify(record).includes(job.ownerId))
 assert.throws(()=>validateProgress({...record,facts:{...record.facts,permission:'spend'}},server),/ARKIV_PROGRESS_INVALID/)
 const owner='0x'+'11'.repeat(20),key='0x'+'22'.repeat(32),row={...Object.fromEntries(['server','task','job','provider','status'].map(k=>[k,{value:record[k]}])),facts:{value:stringToHex(JSON.stringify(record.facts))},revision:{value:1n},$key:key,$owner:owner,$expiresAt:200n}
 const reader=createTaskReader({server,publisher:owner,client:{getEntity:async()=>row}})
 assert.equal((await reader.get(key)).facts.actions[0].produced,4)
 row.$owner='0x'+'33'.repeat(20);await assert.rejects(reader.get(key),/ARKIV_PUBLISHER_MISMATCH/)
})
test('public Worker is read-only, validates filters and never substitutes a cached success',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'arkiv-worker-test-'))
 try{
  const result=await build({entryPoints:['worker/index.js'],bundle:true,platform:'node',format:'esm',write:false,metafile:true,define:{PUBLIC_HTML:'"<main>test</main>"',PUBLIC_JS:'""',PUBLIC_CSS:'""',PUBLIC_ORDERS:'""'}})
  const file=join(directory,'worker.mjs');await import('node:fs/promises').then(fs=>fs.writeFile(file,result.outputFiles[0].text))
  const {handleRequest,default:worker}=await import(file)
  let calls=0
  const source={list:async filters=>{calls++;assert.equal(filters.provider,'0g');return {source:'live-arkiv',records:[],blockNumber:'100'}},get:async()=>{calls++;throw Error('expired')}}
  const request=(path,method='GET')=>new Request('https://public.example'+path,{method})
  assert.equal((await handleRequest(request('/api/tasks','POST'),source)).status,405)
  assert.equal((await handleRequest(request('/api/tasks?rpc=https://private.example'),source)).status,400)
  assert.equal((await handleRequest(request('/api/tasks?provider=admin'),source)).status,400)
  assert.equal((await handleRequest(request('/api/orders?kind=admin'),source)).status,400)
  assert.equal((await handleRequest(request('/api/orders?rpc=private'),source)).status,400)
  assert.equal((await handleRequest(request('/api/orders','POST'),source)).status,405)
  assert.equal((await handleRequest(request('/api/entity?key=invalid'),source)).status,400)
  assert.equal(calls,0)
  assert.equal((await handleRequest(request('/api/tasks?provider=0g'),source)).status,200);assert.equal(calls,1)
  assert.equal((await handleRequest(request('/api/orders?kind=delivery'),{orders:{list:async filters=>{assert.equal(filters.kind,'delivery');return{source:'live-arkiv',records:[]}}}})).status,200)
  assert.equal((await handleRequest(request('/api/orders'),{orders:{list:async()=>{throw Error('offline')}}})).status,503)
  const unavailable=await handleRequest(request('/api/tasks'),{list:async()=>{throw Error('offline')}})
  assert.equal(unavailable.status,503);assert.equal((await unavailable.json()).source,'unavailable')
  assert.equal((await worker.fetch(request('/api/manifest'),{unexpectedEnvironment:true},{})).status,200)
  for(const path of Object.keys(result.metafile.inputs))assert(!/src\/(publish|project|checkpoint-store|journal)\./.test(path),'Operator-only module entered the public Worker')
 }finally{await rm(directory,{recursive:true,force:true})}
})
