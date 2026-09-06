import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(), out=path.join(root,'dist');
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
const omit=new Set(['dist','node_modules','scripts','tests','.git','.vercel','package.json','package-lock.json','vercel.json','README.md']);
for(const entry of await readdir(root,{withFileTypes:true})){
 if(omit.has(entry.name)||entry.name.startsWith('.')) continue;
 await cp(path.join(root,entry.name),path.join(out,entry.name),{recursive:true});
}
console.log('Static game built in dist/');
