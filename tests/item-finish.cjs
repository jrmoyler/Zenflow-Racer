/* Real Three geometry/resource coverage; pixel appearance requires browser review. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const THREE=require('../vendor/three.min.js');
const c={THREE,lerp:(a,b,t)=>a+(b-a)*t};vm.createContext(c);
vm.runInContext(fs.readFileSync(require.resolve('../vehicles.js'),'utf8').split('// ---------- Item / token pickups')[0],c);
vm.runInContext(fs.readFileSync(require.resolve('../item-models.js'),'utf8'),c);
for(const key of ['mine','missile','shield','pulse','triple','burst']){
 const g=vm.runInContext(`buildInventoryModel('${key}')`,c),geos=new Set(),mats=new Set();let instances=0;
 g.updateMatrixWorld(true);g.traverse(o=>{if(o.geometry){geos.add(o.geometry);assert.ok(o.geometry.attributes.position.array.every(Number.isFinite));assert.ok(o.matrixWorld.elements.every(Number.isFinite));}if(o.material)mats.add(o.material);if(o.isInstancedMesh){instances++;const matrix=new THREE.Matrix4();for(let i=0;i<o.count;i++){o.getMatrixAt(i,matrix);assert.ok(matrix.elements.every(Number.isFinite));}}});
 assert.ok(instances>0,key+' uses instanced manufacturing details');
 assert.equal(g.userData.itemFinish,'machined-metal-ceramic');
 const bounds=new THREE.Box3().setFromObject(g);assert.ok(bounds.getSize(new THREE.Vector3()).length()<4,key+' keeps collision-sized silhouette');
 let released=0;for(const resource of [...geos,...mats]){resource.addEventListener('dispose',()=>released++);resource.dispose();}assert.equal(released,geos.size+mats.size);
 console.log('PASS manufactured item geometry, instance transforms, silhouette and resources:',key);
}
