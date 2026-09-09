/* The glyph set is the shared vocabulary between the roster card, the loadout
   catalog and the in-race dock. A missing or duplicated mark silently degrades
   all three surfaces, so coverage and distinctness are asserted here. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const icons=require(path.join(root,'power-icons.js'));

const addonSource=read('addons.js');
const addonContext={};vm.createContext(addonContext);
vm.runInContext(addonSource.slice(addonSource.indexOf('const ADDONS='),addonSource.indexOf('const addonEntities'))+';globalThis.catalog=ADDONS;',addonContext);
const catalog=addonContext.catalog;
const abilityIds=[...read('abilities.js').matchAll(/^ (\w+):\{name:/gm)].map(m=>m[1]);

assert.equal(abilityIds.length,20,'every division still declares a signature power');
for(const id of abilityIds)assert.ok(icons.ABILITY_GLYPHS[id],'signature glyph for '+id);
assert.deepEqual(Object.keys(icons.ABILITY_GLYPHS).filter(id=>!abilityIds.includes(id)),[],'no orphan signature glyph');
assert.equal(new Set(Object.values(icons.ABILITY_GLYPHS)).size,20,'each division reads as its own mark');

const types=[...new Set(catalog.map(a=>a.type))];
for(const type of types)assert.ok(icons.ADDON_TYPE_GLYPHS[type],'add-on glyph for behaviour '+type);
assert.deepEqual(Object.keys(icons.ADDON_TYPE_GLYPHS).filter(t=>!types.includes(t)),[],'no orphan add-on glyph');
assert.equal(new Set(Object.values(icons.ADDON_TYPE_GLYPHS)).size,types.length,'each behaviour reads as its own mark');

for(const addon of catalog){
 const svg=icons.addonIconSVG(addon);
 assert.match(svg,/^<svg viewBox="0 0 24 24"[^>]*stroke="currentColor"/,'inherits the host colour: '+addon.id);
 assert.match(svg,/aria-hidden="true"/,'decorative beside its own text label: '+addon.id);
}
assert.match(icons.addonIconSVG({id:'',type:'SLOT'}),/stroke-dasharray/,'the empty slot has a mark of its own');
assert.match(icons.abilityIconSVG('zenflow','Time Dilation'),/role="img" aria-label="Time Dilation"/,'a labelled glyph is exposed as an image');
assert.match(icons.abilityIconSVG('not-a-division'),/<circle/,'an unknown division still renders a mark');
console.log('PASS power glyphs: 20 distinct signatures, '+types.length+' distinct add-on behaviours, no orphans');
