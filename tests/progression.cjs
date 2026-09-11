const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),Economy=require('../economy.js');
let stored='{}',fail=false,queue=Promise.resolve();const ids=['ward','fire'];
const c={Economy,ADDONS:ids.map(id=>({id})),SAVE_KEY:'test',saved:Economy.migrate({},ids),navigator:{locks:{request:(key,fn)=>{const p=queue.then(fn);queue=p.catch(()=>{});return p;}}},localStorage:{getItem:()=>stored,setItem:(k,v)=>{if(fail)throw Error('quota');stored=v;}},document:{getElementById:()=>null}};
vm.createContext(c);vm.runInContext(fs.readFileSync('progression.js','utf8'),c);
const tx=fn=>c.economyTransaction(fn);
(async()=>{
 await tx(s=>({...s,wallet:400}));await Promise.all([tx(s=>Economy.purchase(s,'addon','fire',ids)),tx(s=>Economy.purchase(s,'addon','fire',ids))]);
 assert.equal(JSON.parse(stored).wallet,185,'double purchase charges once');
 await tx(s=>Economy.begin(s,'one'));
 const r={id:'one',finished:true,laps:3,completedLaps:3,position:1,difficulty:1,tokens:12,hits:0,time:100,bestLap:30,map:'cherry',division:'zenflow'};
 let paid=0;await Promise.all([1,2].map(()=>tx(s=>{const result=Economy.settle(s,r);if(result.reward)paid++;return result.save;})));
 assert.equal(paid,1);assert.equal(JSON.parse(stored).careerStats.races,1);
 const before=stored;fail=true;await assert.rejects(tx(s=>({...s,wallet:9999})),/quota/);assert.equal(stored,before);assert.equal(c.saved.wallet,JSON.parse(before).wallet);fail=false;
 stored='{broken';await tx(s=>s);assert.equal(JSON.parse(stored).wallet,0);
 await tx(s=>Economy.begin(s,'old'));await tx(s=>Economy.begin(s,'new'));let payout;await tx(s=>{const result=Economy.settle(s,{...r,id:'old'});payout=result.reward;return result.save;});assert.equal(payout,null);
 console.log('PASS serialized economic transactions: double-click, replay, restart, quota failure, corruption and durable receipts');
})().catch(e=>{console.error(e);process.exitCode=1;});
