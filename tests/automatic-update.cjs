const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const events={},swEvents={},regEvents={};let interval,posted=0,reloads=0;
 const registration={waiting:{postMessage:m=>{assert.equal(m.type,'ACTIVATE_UPDATE');posted++;}},addEventListener:(k,v)=>regEvents[k]=v};
 const context={game:{state:'race'},sceneCut:{busy:false},navigator:{serviceWorker:{controller:{},register:async()=>registration,addEventListener:(k,v)=>swEvents[k]=v}},location:{protocol:'https:',hostname:'race.example',reload:()=>reloads++},window:{addEventListener:(k,v)=>events[k]=v},document:{hidden:false,getElementById:()=>null,createElement:()=>{throw Error('No update button should be created');}},setInterval:fn=>interval=fn};
 vm.runInNewContext(fs.readFileSync('pwa.js','utf8'),context);await events.load();
 for(const state of ['race','countdown','finish','paused','results','boot']){context.game.state=state;interval();assert.equal(posted,0,state);}
 context.game.state='roster';context.sceneCut.busy=true;interval();assert.equal(posted,0);
 context.sceneCut.busy=false;context.document.hidden=true;interval();assert.equal(posted,0);
 context.document.hidden=false;interval();assert.equal(posted,1);interval();assert.equal(posted,1);context.game.state='countdown';swEvents.controllerchange();assert.equal(reloads,0,'starting while activation settles must not interrupt race');context.game.state='roster';interval();assert.equal(reloads,1);interval();assert.equal(reloads,1);
 console.log('PASS automatic menu updates: no prompt, no race interruption, hidden/transition guards, single activation');
})().catch(e=>{console.error(e);process.exitCode=1;});
