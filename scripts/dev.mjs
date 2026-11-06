import {createServer} from 'node:http'
import worker from '../dist/server/index.js'
const port=Number(process.env.PORT||8805)
createServer(async(req,res)=>{try{const response=await worker.fetch(new Request('http://127.0.0.1:'+port+req.url,{method:req.method,headers:req.headers}));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))}catch{res.writeHead(500).end('Preview unavailable')}}).listen(port,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+port))
