import {build} from 'esbuild'
import {readFile,mkdir,copyFile} from 'node:fs/promises'
const define=Object.fromEntries(await Promise.all([['PUBLIC_HTML','public/index.html'],['PUBLIC_JS','public/app.js'],['PUBLIC_CSS','public/style.css']].map(async([key,file])=>[key,JSON.stringify(await readFile(file,'utf8'))])))
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true})
await build({entryPoints:['worker/index.js'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,define})
await copyFile('.openai/hosting.json','dist/.openai/hosting.json')
console.log('Built read-only Arkiv Worker; the operator publisher stays outside the website.')
