// Builds www/kb.json from kb/*.md (topic files) and kb/extra/** (any .md/.txt you add).
const fs=require('fs'),path=require('path');
const dir=path.join(__dirname,'..','kb'),outFile=path.join(__dirname,'..','www','kb.json');
function build(){const out=[];
 const walk=d=>{for(const f of fs.readdirSync(d).sort()){const p=path.join(d,f);if(fs.statSync(p).isDirectory()){walk(p);continue}
  if(!/\.(md|txt)$/i.test(f))continue;const t=fs.readFileSync(p,'utf8').replace(/\r/g,''),src=path.relative(dir,p).replace(/\\/g,'/');
  if(/^##\s/m.test(t)){t.split(/^##\s+/m).slice(1).forEach(b=>{const L=b.split('\n'),title=L.shift().trim();let tags='';if(/^tags:/i.test(L[0]||''))tags=L.shift().replace(/^tags:\s*/i,'').trim();const text=L.join('\n').trim();if(text)out.push({src,title,tags,text})})}
  else{let buf='';const flush=()=>{if(buf.trim())out.push({src,title:f.replace(/\.\w+$/,'').replace(/[-_]+/g,' '),tags:'',text:buf.trim()});buf=''};
   t.split(/\n\s*\n/).forEach(par=>{if((buf+par).length>800)flush();buf+=par+'\n\n'});flush()}}};
 walk(dir);out.forEach((c,i)=>c.id=i);fs.writeFileSync(outFile,JSON.stringify(out));return out}
module.exports={build};if(require.main===module){const k=build();console.log('Knowledge base built:',k.length,'topics ->',outFile)}
