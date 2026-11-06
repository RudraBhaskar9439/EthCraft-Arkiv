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
  const result=await build({entryPoints:['worker/index.js'],bundle:true,platform:'node',format:'esm',write:false,metafile:true,define:{PUBLIC_HTML:'"<main>test</main>"',PUBLIC_JS:'""',PUBLIC_CSS:'""'}})
  const file=join(directory,'worker.mjs');await import('node:fs/promises').then(fs=>fs.writeFile(file,result.outputFiles[0].text))
  const {handleRequest,default:worker}=await import(file)
  let calls=0
  const source={list:async filters=>{calls++;assert.equal(filters.provider,'0g');return {source:'live-arkiv',records:[],blockNumber:'100'}},get:async()=>{calls++;throw Error('expired')}}
  const request=(path,method='GET')=>new Request('https://public.example'+path,{method})
  assert.equal((await handleRequest(request('/api/tasks','POST'),source)).status,405)
  assert.equal((await handleRequest(request('/api/tasks?rpc=https://private.example'),source)).status,400)
  assert.equal((await handleRequest(request('/api/tasks?provider=admin'),source)).status,400)
  assert.equal((await handleRequest(request('/api/entity?key=invalid'),source)).status,400)
  assert.equal(calls,0)
  assert.equal((await handleRequest(request('/api/tasks?provider=0g'),source)).status,200);assert.equal(calls,1)
  const unavailable=await handleRequest(request('/api/tasks'),{list:async()=>{throw Error('offline')}})
  assert.equal(unavailable.status,503);assert.equal((await unavailable.json()).source,'unavailable')
  assert.equal((await worker.fetch(request('/api/manifest'),{unexpectedEnvironment:true},{})).status,200)
  for(const path of Object.keys(result.metafile.inputs))assert(!/src\/(publish|project|checkpoint-store|journal)\./.test(path),'Operator-only module entered the public Worker')
 }finally{await rm(directory,{recursive:true,force:true})}
})
