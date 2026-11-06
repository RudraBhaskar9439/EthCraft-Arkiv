import {readFile} from 'node:fs/promises'
import {createTaskReader} from '../src/read.mjs'
const config=JSON.parse(await readFile(new URL('../deployment.json',import.meta.url),'utf8'))
if(process.env.ARKIV_PUBLISHER)config.publisher=process.env.ARKIV_PUBLISHER
const reader=createTaskReader({...config,accessKey:process.env.ARKIV_ACCESS_KEY||''})
const key=process.argv[2]
console.log(JSON.stringify(key?await reader.get(key):await reader.list(),null,2))
