/* Real loadout handlers and saved-state parsing, exercised with a DOM adapter.
   Browser layout and WebGL rendering are separate checks. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function element(tag='div'){
 const classes=new Set();return {tagName:tag.toUpperCase(),children:[],events:{},dataset:{},attributes:{},textContent:'',value:'',hidden:false,disabled:false,
  style:{setProperty(k,v){this[k]=v;}},classList:{toggle(k,on){on?classes.add(k):classes.delete(k);},contains:k=>classes.has(k)},
  setAttribute(k,v){this.attributes[k]=String(v);},getAttribute(k){return this.attributes[k];},append(...nodes){this.children.push(...nodes);},replaceChildren(...nodes){this.children=nodes;},
  querySelectorAll(selector){return this.children.flatMap(n=>[...(selector==='button'&&n.tagName==='BUTTON'?[n]:[]),...n.querySelectorAll(selector)]);},
  addEventListener(name,fn){(this.events[name]??=[]).push(fn);},fire(name,event={}){for(const fn of this.events[name]||[])fn({preventDefault(){},currentTarget:this,...event});},
  showModal(){this.open=true;},close(){this.open=false;},focus(){this.focused=true;}};
}
function fixture(raw='{}'){
 const ids=new Map(),el=id=>{if(!ids.has(id))ids.set(id,element());return ids.get(id);};let stored=raw,writes=0;
 const window=element(),context={console,window,document:{getElementById:el,createElement:element},localStorage:{getItem:()=>stored,setItem:(k,v)=>{stored=v;writes++;}},
  ROSTER:[{id:'zenflow',name:'ZenFlow'},{id:'eon',name:'Eon Core'}],MAPS:[{id:'cherry'}],selected:{id:'zenflow',name:'ZenFlow'},raceSetup:{step:'character'},SFX:{ui(){}},requestAnimationFrame:fn=>fn()};
 vm.createContext(context);const run=src=>vm.runInContext(src,context);
 const game=read('game.js');run(game.slice(0,game.indexOf('const input=')));run("game.state='roster'");run(read('power-icons.js'));run(read('addons.js'));run(read('addon-ui.js'));
 const open=()=>el('open-loadout').fire('click'),rows=()=>el('addon-list').querySelectorAll('button');
 const equip=id=>{const row=rows().find(n=>n.dataset.addon===id);assert.ok(row,'available choice '+id);row.fire('click');};
 return {el,run,open,rows,equip,window,context,stored:()=>stored,writes:()=>writes};
}
{
 const f=fixture();f.open();assert.equal(f.rows().length,25,'24 imported powers and an empty slot');assert.equal(f.el('loadout-dialog').open,true);assert.ok(f.rows().some(row=>row.focused),'catalog receives focus without opening the mobile keyboard');
 for(const row of f.rows())assert.match(row.style['--addon-color'],/^#[\da-f]{6}$/i,'valid catalog accent colour');
 f.equip('fire');assert.equal(f.el('equipped-addon').textContent,'Elemental Fire');assert.equal(JSON.parse(f.stored()).addons.zenflow,'fire');
 assert.equal(f.rows().filter(n=>n.getAttribute('aria-pressed')==='true').length,1,'one selected slot');
 f.context.selected={id:'eon',name:'Eon Core'};f.window.fire('racerselect');assert.equal(f.el('equipped-addon').textContent,'Choose from 24 bonus powers');f.open();f.equip('tide-ring');
 assert.deepEqual(JSON.parse(f.stored()).addons,{zenflow:'fire',eon:'tide-ring'},'equipment belongs to the selected division');
 const loaded=fixture(f.stored());assert.equal(loaded.el('equipped-addon').textContent,'Elemental Fire','equipment restores on reload');loaded.open();loaded.equip('');
 assert.equal(loaded.el('equipped-addon').textContent,'Choose from 24 bonus powers');assert.equal(JSON.parse(loaded.stored()).addons.zenflow,null,'empty slot persists');assert.equal(JSON.parse(loaded.stored()).addons.eon,'tide-ring','clearing one division preserves another');
 loaded.el('done-loadout').fire('click');assert.equal(loaded.el('loadout-dialog').open,false);assert.equal(loaded.el('open-loadout').focused,true);
 loaded.open();loaded.el('open-loadout').focused=false;loaded.el('loadout-dialog').fire('cancel');assert.equal(loaded.el('open-loadout').focused,true,'Escape cancellation restores trigger focus');
 console.log('PASS add-on selection: complete catalog, per-racer save/reload, optional empty slot and focus return');
}
{
 const f=fixture();f.open();for(const [query,id] of [['  fIrE  ','fire'],['ring gate','tide-ring'],['charged surge','electric-boost']]){f.el('addon-search').value=query;f.el('addon-search').fire('input');assert.ok(f.rows().some(n=>n.dataset.addon===id),'search matches name, type and description: '+query);}
 f.el('addon-search').value='nonexistent power';f.el('addon-search').fire('input');assert.equal(f.rows().length,0);assert.match(f.el('addon-list').children[0].textContent,/No matching powers/);
 f.el('addon-search').value='';f.el('addon-search').fire('input');f.run("game.state='race'");const before=f.writes();f.equip('fire');assert.equal(f.writes(),before,'race input cannot change equipment');
 f.el('loadout-dialog').close();f.open();assert.equal(f.el('loadout-dialog').open,false,'race cannot open loadout');f.run("game.state='roster'");f.context.raceSetup.step='map';f.open();assert.equal(f.el('loadout-dialog').open,true,'map step keeps equipment reachable');f.equip('fire');assert.equal(JSON.parse(f.stored()).addons.zenflow,'fire');
 console.log('PASS add-on search, empty results and setup/race guards');
}
for(const raw of ['{','null','[]','42','"bad"','{"addons":null}','{"addons":[]}','{"addons":"bad"}','{"addons":{"zenflow":"unknown"}}','{"addons":{"zenflow":{}}}']){
 const f=fixture(raw);assert.equal(f.el('equipped-addon').textContent,'Choose from 24 bonus powers');f.open();f.equip('ward');assert.equal(JSON.parse(f.stored()).addons.zenflow,'ward','malformed data remains recoverable: '+raw);
}
console.log('PASS malformed saved state: invalid JSON, primitives, arrays, unknown IDs and non-string selections');
{
 const html=read('index.html');assert.match(html,/<dialog\b[^>]*id="loadout-dialog"[^>]*aria-labelledby="loadout-title"/,'native modal provides browser focus containment');
 for(const id of ['open-loadout','close-loadout','done-loadout'])assert.match(html,new RegExp('<button\\b[^>]*id="'+id+'"[^>]*type="button"'),'keyboard-operable native button '+id);
 assert.match(html,/<input\b[^>]*id="addon-search"[^>]*type="search"/,'native search input is keyboard focusable');
}
{
 const f=fixture();f.context.r={addonId:'fire',addonCooldown:2.2,spin:0,vault:0,finished:false};f.run("game.state='race';updateAddonHUD(r)");assert.equal(f.el('addonHUD').hidden,false);assert.equal(f.el('addonHUD').disabled,true);assert.match(f.el('addonLabel').textContent,/3s/);
 f.context.r.addonCooldown=0;f.run('updateAddonHUD(r)');assert.equal(f.el('addonHUD').disabled,false);assert.equal(f.el('tA').classList.contains('ready'),true);
 for(const blocked of [{vault:1},{spin:1},{finished:true}]){Object.assign(f.context.r,{vault:0,spin:0,finished:false},blocked);f.run('updateAddonHUD(r)');assert.equal(f.el('addonHUD').disabled,true,'racer status gates HUD');assert.equal(f.el('tA').disabled,true);}
 f.context.r.addonId='missing';f.run('updateAddonHUD(r)');assert.equal(f.el('addonHUD').hidden,false);assert.equal(f.el('tA').hidden,false);assert.equal(f.el('tA').disabled,true);assert.match(f.el('tA').innerHTML,/EMPTY/);
 console.log('PASS add-on HUD: cooldown rounding, ready state, incapacitation and empty slot');
}

{
 const f=fixture();f.open();
 const row=id=>f.rows().find(n=>n.dataset.addon===id);
 const find=(node,cls)=>node.className===cls?node:node.children.reduce((hit,child)=>hit||find(child,cls),null);
 const chip=(id,cls)=>find(row(id),cls);
 // Every catalog entry carries its own visible call to action and a behaviour
 // glyph, and the row stays a single button so keyboard activation still works.
 for(const node of f.rows())assert.equal(node.children.filter(n=>n.tagName==='BUTTON').length,0,'no control nested inside a row button');
 assert.equal(chip('fire','addon-action').textContent,'EQUIP');
 assert.equal(chip('','addon-action').textContent,'EQUIPPED ✓','an empty slot is the equipped choice until a power is added');
 assert.match(row('fire').children[0].innerHTML,/^<svg viewBox="0 0 24 24"/,'each row leads with its behaviour glyph');
 f.equip('fire');
 assert.equal(chip('fire','addon-action').textContent,'EQUIPPED ✓','the equipped row reports its own state');
 assert.equal(chip('','addon-action').textContent,'CLEAR SLOT','the empty slot reads as a clear once a power is equipped');
 assert.equal(chip('ward','addon-action').textContent,'EQUIP','every other row returns to the equip call');
 assert.match(chip('ward','addon-cooldown').textContent,/^21s COOLDOWN$/);
 f.equip('ward');
 assert.equal(chip('fire','addon-action').textContent,'EQUIP','swapping releases the previous row');
 assert.equal(chip('ward','addon-action').textContent,'EQUIPPED ✓');
 console.log('PASS catalog rows: per-power equip button, behaviour glyph and live equipped state');
}

{
 const f=fixture();f.open();const ids=f.rows().map(row=>row.dataset.addon).filter(Boolean);
 for(const id of ids){f.equip(id);assert.equal(JSON.parse(f.stored()).addons.zenflow,id);assert.equal(f.run('addonDefinition(saved.addons.zenflow).id'),id);}
 f.context.raceSetup.step='map';f.el('loadout-dialog').close();f.open();f.equip('cyber');assert.equal(JSON.parse(f.stored()).addons.zenflow,'cyber','last-minute circuit-step change reaches saved racer slot');
 console.log('PASS all 24 powers can be equipped and resolved, including after circuit selection');
}

{
 const f=fixture();let casts=0;f.context.useAddon=()=>{casts++;};f.run("game.state='race';game.player={}");
 f.el('addonHUD').fire('click',{detail:0});assert.equal(casts,1,'assistive / keyboard click casts without pointerdown');
 f.el('addonHUD').fire('click',{detail:1});assert.equal(casts,1,'pointer click does not duplicate held-input cast');
 f.run("game.state='paused'");f.el('addonHUD').fire('click',{detail:0});assert.equal(casts,1,'paused race cannot cast');
 console.log('PASS native keyboard/assistive activation and duplicate-pointer prevention');
}
