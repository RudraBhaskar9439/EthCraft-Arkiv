// Operator-only testnet writer. Never imported by the website.
import {readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {randomUUID} from 'node:crypto'
import {privateKeyToAccount} from 'viem/accounts'
import {http} from 'viem'
import {TaskPublisher,loadPublisherState} from '../src/publish.mjs'
import {createTaskReader} from '../src/read.mjs'
import {projectProgress} from '../src/project.mjs'
import {acquireLocalLease} from '../src/journal.mjs'
if(!process.env.ARKIV_PRIVATE_KEY)throw Error('Set ARKIV_PRIVATE_KEY in your local environment, never in a browser or source file.')
const account=privateKeyToAccount(process.env.ARKIV_PRIVATE_KEY),config=JSON.parse(await readFile(new URL('../deployment.json',import.meta.url),'utf8'))
const reader=createTaskReader({...config,publisher:account.address,accessKey:process.env.ARKIV_ACCESS_KEY||''})
const file=resolve('.local/publications.json'),release=await acquireLocalLease('ethcraft-arkiv-publisher:'+file)
try{
 const publisher=new TaskPublisher({reader,account,file,state:await loadPublisherState(file,config.server,account.address),transport:http(reader.client.chain.rpcUrls.default.http[0],{retryCount:0,timeout:20000})})
 const job={id:randomUUID(),status:'paused',qualificationFixture:true,history:[{step:{tool:'craft',item:'stick',count:4},result:{produced:4}}]}
 const result=await publisher.publish(projectProgress(job,'claude',config.server))
 console.log(JSON.stringify({publisher:account.address,entityKey:result.entityKey,transactionHash:result.transactionHash,note:'Controlled data fixture; no game action occurred. Query with ARKIV_PUBLISHER set to this wallet.'},null,2))
}finally{await release()}
