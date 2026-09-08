/* Exercise the real menu handlers with a small DOM adapter; no renderer required. */
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function node(){const classes=new Set();return {disabled:false,hidden:false,inert:false,dataset:{},textContent:'',events:{},classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle:(x,on)=>on?classes.add(x):classes.delete(x)},setAttribute(k,v){this[k]=v;},addEventListener(k,fn){this.events[k]=fn;},focus(){},querySelector(){return null;},querySelectorAll(){return [];}};}
const ids=new Map(),el=id=>{if(!ids.has(id))ids.set(id,node());return ids.get(id);};
const buttons=['cherry','stormforge','canopy'].map(id=>Object.assign(node(),{dataset:{map:id},textContent:id}));
const roster=el('roster'),title=el('title-screen'),body=node();
const pieces={'.track-panel':node(),'.director-panel':node(),'.selector-heading':node()};
roster.querySelector=s=>pieces[s];title.querySelector=()=>el('title-status');title.querySelectorAll=()=>[el('title-start'),el('title-settings')];
const listeners={},setup={step:'title',racerConfirmed:false,mapConfirmed:false};
const c={console,ROSTER:[],MAPS:[],raceSetup:setup,selected:{name:'ZenFlow'},chosenMapId:'cherry',miniBounds:null,audioInit(){},SFX:{ui(){}},MutationObserver:class{observe(){}},window:{addEventListener:(n,f)=>listeners[n]=f},document:{body,getElementById:el,querySelectorAll:s=>s==='[data-map]'?buttons:[],querySelector:s=>s==='[data-map]'?buttons[0]:buttons.find(b=>s.includes(b.dataset.map))},transitionScene:(label,fn)=>{fn();return true;},chooseMap:id=>{c.chosenMapId=id;return true;},selectMap:()=>true};
vm.createContext(c);
const source=fs.readFileSync(path.join(__dirname,'../menu.js'),'utf8');
vm.runInContext(source.slice(source.indexOf('// The main menu overlays')),c);
el('title-start').onclick();assert.equal(setup.step,'character');assert.equal(pieces['.track-panel'].hidden,true);assert.equal(el('go').disabled,true);assert.equal(setup.racerConfirmed,false);
buttons[1].events.click();assert.equal(setup.mapConfirmed,false,'map cannot be selected before racer confirmation');
el('confirm-racer').onclick();assert.equal(setup.step,'map');assert.equal(setup.racerConfirmed,true);assert.equal(el('grid').hidden,true);assert.equal(el('go').disabled,true);
buttons[0].events.click();assert.equal(setup.mapConfirmed,true,'choosing even the saved/default map is explicit');assert.equal(el('go').disabled,false);assert.equal(buttons[0]['aria-pressed'],'true');
el('back-racer').onclick();assert.equal(setup.racerConfirmed,false);assert.equal(setup.mapConfirmed,false);assert.equal(el('go').disabled,true);assert.ok(buttons.every(b=>b['aria-pressed']==='false'));
el('confirm-racer').onclick();buttons[2].events.click();assert.equal(c.chosenMapId,'canopy');assert.equal(el('go').disabled,false);
el('title-return').onclick();assert.equal(setup.step,'title');assert.equal(setup.racerConfirmed,false);assert.equal(setup.mapConfirmed,false);
el('title-start').onclick();assert.equal(setup.step,'character');assert.equal(el('go').disabled,true);
console.log('PASS actual menu handlers: ordered setup, default-map confirmation, change racer, title return, stale confirmation reset');
