const assert=require('node:assert/strict');
const E=require('../economy.js');
const ids=['ward','fire','wind'];
let s=E.migrate({selected:'zenflow',addons:{zenflow:'fire'},'cherry-zenflow-1':90},ids);
assert.equal(s.wallet,0);assert.ok(s.ownedAddons.includes('fire'));assert.equal(s['cherry-zenflow-1'],90);
for(const bad of [null,[],42,{wallet:-5,ownedAddons:{},careerStats:null},{wallet:Infinity}])assert.equal(E.migrate(bad,ids).wallet,0);
assert.equal(E.migrate({...s,wallet:123},ids).wallet,123);
let race={id:'one',finished:true,laps:3,completedLaps:3,position:1,difficulty:1,tokens:19,hits:0,time:100,bestLap:30,map:'cherry',division:'zenflow',personalBest:true};
s=E.begin(s,'one');let result=E.settle(s,race);assert.ok(result.reward.total>0);s=result.save;
assert.equal(E.settle(s,race).reward,null);assert.equal(E.settle(E.begin(s,'two'),race).reward,null);
assert.equal(E.settle(E.begin(s,'three'),{...race,id:'three',finished:false}).reward,null);
assert.equal(E.settle(E.begin(s,'three'),{...race,id:'three',completedLaps:2}).reward,null);
assert.equal(E.settle(E.begin(s,'three'),{...race,id:'three',time:NaN}).reward,null);
const rich={...s,wallet:10000};let bought=E.purchase(rich,'addon','wind',ids);assert.equal(bought.wallet,10000-E.addonPrice('wind',ids));assert.ok(bought.ownedAddons.includes('wind'));
assert.equal(E.purchase(bought,'addon','wind',ids).wallet,bought.wallet);assert.equal(E.purchase({...s,wallet:0},'addon','wind',ids).wallet,0);
for(const category of Object.keys(E.BUILDS)){const b=E.purchase(rich,'kart',category,ids);assert.equal(b.kartUpgrades[category],true);}
assert.equal(E.reward({...race,tokens:Infinity},s).tokens,0);
assert.ok(E.reward({...race,tokens:99999},s).total<=600);
console.log('PASS economy migration, persistence, reward bounds, incomplete race, restart/replay rejection, purchases and six builds');

assert.equal(E.reward({...race,difficulty:2,tokens:60},E.migrate({},ids)).total,423);
assert.equal(E.reward({...race,position:12,difficulty:0,tokens:0,hits:3,personalBest:false},s).total,25);
