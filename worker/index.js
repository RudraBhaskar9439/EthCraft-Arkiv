import {createTaskReader,validateProgress} from '../src/read.mjs'
import {withWorkOrders} from '../src/work-orders.mjs'
import deployment from '../deployment.json' with {type:'json'}

const reader=withWorkOrders(createTaskReader(deployment),validateProgress)
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'"}
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{...headers,'Content-Type':'application/json'}})
const assets={'/':['text/html; charset=utf-8',PUBLIC_HTML],'/app.js':['text/javascript; charset=utf-8',PUBLIC_JS],'/style.css':['text/css; charset=utf-8',PUBLIC_CSS],'/orders.js':['text/javascript; charset=utf-8',PUBLIC_ORDERS]}

export async function handleRequest(request,source=reader){
  const url=new URL(request.url)
  if(request.method!=='GET'&&request.method!=='HEAD')return json({error:'READ_ONLY_DEMO'},405)
  if(url.href.length>2048)return json({error:'REQUEST_TOO_LONG'},414)
  if(assets[url.pathname]){const [type,body]=assets[url.pathname];return new Response(request.method==='HEAD'?null:body,{headers:{...headers,'Content-Type':type}})}
  if(url.pathname==='/api/manifest')return json(deployment)
 if(url.pathname==='/api/orders'){
  if([...url.searchParams.keys()].some(k=>!['kind','item'].includes(k)||url.searchParams.getAll(k).length!==1))return json({error:'INVALID_FILTER'},400)
  const filters=Object.fromEntries(url.searchParams)
  if(filters.kind!==undefined&&!['delivery','craft_delivery'].includes(filters.kind)||filters.item!==undefined&&!/^[a-z][a-z0-9_]{0,63}$/.test(filters.item))return json({error:'INVALID_FILTER'},400)
  try{return json(await source.orders.list(filters))}catch{return json({error:'ARKIV_LIVE_READ_UNAVAILABLE',source:'unavailable'},503)}
 }
  if(url.pathname==='/api/tasks'){
    const params=url.searchParams
    if([...params.keys()].some(k=>!['provider','status','offset'].includes(k)||params.getAll(k).length!==1))return json({error:'INVALID_FILTER'},400)
    const filters=Object.fromEntries(params);if(filters.offset!==undefined)filters.offset=Number(filters.offset)
    if(filters.provider!==undefined&&!['claude','0g'].includes(filters.provider)||filters.status!==undefined&&!['running','paused','blocked','ready_for_review','handed_off'].includes(filters.status)||filters.offset!==undefined&&(!Number.isSafeInteger(filters.offset)||filters.offset<0||filters.offset>10000))return json({error:'INVALID_FILTER'},400)
    try{return json(await source.list(filters))}catch{return json({error:'ARKIV_LIVE_READ_UNAVAILABLE',source:'unavailable'},503)}
  }
  if(url.pathname==='/api/entity'){
    if([...url.searchParams.keys()].some(k=>k!=='key')||url.searchParams.getAll('key').length!==1||!/^0x[0-9a-f]{64}$/i.test(url.searchParams.get('key')))return json({error:'INVALID_ENTITY_KEY'},400)
    try{return json({record:await source.get(url.searchParams.get('key')),source:'live-arkiv'})}catch{return json({error:'ARKIV_ENTITY_UNAVAILABLE'},404)}
  }
  return json({error:'NOT_FOUND'},404)
}
export default {fetch(request){return handleRequest(request)}}
