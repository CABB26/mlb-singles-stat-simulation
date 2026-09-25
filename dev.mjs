import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import worker from './src/worker.mjs';
const types = {html:'text/html',css:'text/css',mjs:'text/javascript',svg:'image/svg+xml'};
const assets = {async fetch(request) {
  const path = new URL(request.url).pathname;
  if (!['/','/index.html','/style.css','/app.mjs','/model.mjs','/favicon.svg'].includes(path)) return new Response('Not found',{status:404});
  try { return new Response(await readFile(fileURLToPath(new URL('./public' + (path === '/' ? '/index.html' : path),import.meta.url))), {headers:{'Content-Type':types[path === '/' ? 'html' : path.split('.').pop()]}}); } catch { return new Response('Not found',{status:404}); }
}};
http.createServer(async (req,res) => {
  try { const response = await worker.fetch(new Request('http://localhost:8787'+req.url,{method:req.method}),{ASSETS:assets},{waitUntil:()=>{}}); res.writeHead(response.status,Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer())); }
  catch {res.writeHead(500);res.end('Server error');}
}).listen(8787,'127.0.0.1',()=>console.log('HR Machine ready at http://localhost:8787'));
