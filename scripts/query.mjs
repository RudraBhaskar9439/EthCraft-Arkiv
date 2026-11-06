import {readFile} from 'node:fs/promises'
import {createTaskReader,validateProgress} from '../src/read.mjs'
import {withWorkOrders} from '../src/work-orders.mjs'
const config=JSON.parse(await readFile(new URL('../deployment.json',import.meta.url),'utf8'))
if(process.env.ARKIV_PUBLISHER)config.publisher=process.env.ARKIV_PUBLISHER
const reader=withWorkOrders(createTaskReader({...config,accessKey:process.env.ARKIV_ACCESS_KEY||''}),validateProgress)
const key=process.argv[2]
console.log(JSON.stringify(key==='--orders'?await reader.orders.list():key?await reader.get(key):await reader.list(),null,2))
