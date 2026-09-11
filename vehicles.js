// ---------- Kart factory ----------
function mergeKartGeometry(parts){
  const result=new THREE.BufferGeometry();
  const flat=parts.map(g=>g.index?g.toNonIndexed():g.clone());
  for(const key of ['position','normal','uv']){
    const length=flat.reduce((n,g)=>n+(g.attributes[key]?.array.length||0),0);
    if(!length||flat.some(g=>!g.attributes[key]))continue;
    const values=new Float32Array(length);let offset=0;
    flat.forEach(g=>{values.set(g.attributes[key].array,offset);offset+=g.attributes[key].array.length;});
    result.setAttribute(key,new THREE.BufferAttribute(values,key==='uv'?2:3));
  }
  flat.forEach(g=>g.dispose());result.computeBoundingSphere();return result;
}
// Rig nodes that must stay individually addressable for animation, FX and Blender clips.
const KART_RIG_NAMES=new Set(['body','pilot','torso','head','head-mesh','hair','arm-l','arm-r','arm-l-mesh','arm-r-mesh','steering-wheel','steering-wheel-rim','exhaust-l','exhaust-r','wheel-fl','wheel-fr','wheel-rl','wheel-rr','spin','wheel-light-ring','underbody-flow-ring','aegis-shield','halo','star']);
function batchKartBody(group){
  const batches=new Map();
  for(const mesh of group.children){
    // Rig parts, transparent effects and dynamically animated materials must remain addressable.
    if(!mesh.isMesh||KART_RIG_NAMES.has(mesh.name)||mesh.material.transparent||(mesh.material.emissiveIntensity>0&&mesh.material.emissive?.getHex()!==0))continue;
    const key=mesh.material;const batch=batches.get(key)||[];batch.push(mesh);batches.set(key,batch);
  }
  for(const [material,meshes] of batches){
    if(meshes.length<2)continue;
    const parts=meshes.map(mesh=>{mesh.updateMatrix();return mesh.geometry.clone().applyMatrix4(mesh.matrix);});
    const merged=new THREE.Mesh(mergeKartGeometry(parts),material);merged.name='coachwork-batch';merged.castShadow=true;merged.receiveShadow=true;
    parts.forEach(g=>g.dispose());const shared=new Set(Object.values(KART_GEO));meshes.forEach(mesh=>{group.remove(mesh);if(!shared.has(mesh.geometry))mesh.geometry.dispose();});group.add(merged);
  }
}
function disposeKart(root){
  if(!root)return;
  if(typeof clearKartBuildVisuals==='function')clearKartBuildVisuals(root);
  const sharedGeometry=new Set(Object.values(KART_GEO));
  const sharedTextures=new Set(Object.values(TEX));
  const geometries=new Set(),materials=new Set(),textures=new Set();
  root.traverse(obj=>{if(obj.geometry&&!obj.geometry.userData?.blenderShared&&!sharedGeometry.has(obj.geometry))geometries.add(obj.geometry);
    if(obj.material)(Array.isArray(obj.material)?obj.material:[obj.material]).forEach(m=>materials.add(m));});
  materials.forEach(m=>{Object.values(m).forEach(v=>{if(v?.isTexture&&!sharedTextures.has(v))textures.add(v);});m.dispose();});
  geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());if(root.parent)root.parent.remove(root);
}
const KART_GEO={};
// Pilot rig pivots in pilot-local space: neck for the head, shoulders for the arms.
const PILOT_NECK=[0,1.2,0],PILOT_SHOULDER=[.34,.9,.02];
// Reference reconstruction: rounded section surfaces retain an open cockpit.
function sectionSurface(rows,segments=48){
  const positions=[],uv=[],indices=[];
  rows.forEach((row,j)=>{for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2,front=Math.max(0,-Math.cos(a)),w=row[1]*(1-front*.12);positions.push(Math.sin(a)*w,row[0],Math.cos(a)*row[2]+(row[3]||0));uv.push(i/segments,j/(rows.length-1));}});
  for(let j=0;j<rows.length-1;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+segments+1;indices.push(a,b,a+1,b,b+1,a+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
// Smooth authored sections without changing their endpoints or silhouette extents.
function smoothKartSections(rows,steps=4){
  const out=[];
  for(let j=0;j<rows.length-1;j++)for(let k=0;k<steps;k++){
    const t=k/steps,a=rows[Math.max(0,j-1)],b=rows[j],c=rows[j+1],d=rows[Math.min(rows.length-1,j+2)];
    out.push(b.map((v,i)=>{if(i===0)return lerp(v,c[i],t);const v0=(c[i]-(a[i]||0))*.5,v1=((d[i]||0)-v)*.5;
      const n=(2*t*t*t-3*t*t+1)*v+(t*t*t-2*t*t+t)*v0+(-2*t*t*t+3*t*t)*c[i]+(t*t*t-t*t)*v1;
      return Math.max(Math.min(v,c[i]),Math.min(Math.max(v,c[i]),n));}));
  }out.push(rows[rows.length-1]);return out;
}
function bodyLoft(rows,segments=32){
  rows=smoothKartSections(rows,3);
  const p=[],uv=[],idx=[];rows.forEach((r,j)=>{for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2;p.push(Math.sin(a)*r[1],r[0],Math.cos(a)*r[2]+(r[3]||0));uv.push(i/segments,j/(rows.length-1));}});
  for(let j=0;j<rows.length-1;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+segments+1;idx.push(a,a+1,b,b,a+1,b+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
function limbSurface(points,radii){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),N=22,R=12,frames=curve.computeFrenetFrames(N,false),pos=[],uv=[],ix=[];
  for(let i=0;i<=N;i++){const t=i/N,c=curve.getPointAt(t),q=t*(radii.length-1),k=Math.min(radii.length-2,Math.floor(q)),r=lerp(radii[k],radii[k+1],q-k);for(let j=0;j<=R;j++){const a=j/R*Math.PI*2,v=c.clone().addScaledVector(frames.normals[i],Math.cos(a)*r).addScaledVector(frames.binormals[i],Math.sin(a)*r);pos.push(v.x,v.y,v.z);uv.push(j/R,t);}}
  for(let i=0;i<N;i++)for(let j=0;j<R;j++){const a=i*(R+1)+j,b=a+R+1;ix.push(a,a+1,b,b,a+1,b+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g;
}
function kartGeos(){
  const shell=sectionSurface([[.48,.92,1.8,0],[.65,1.03,1.93,0],[.82,1.08,1.97,0],[.91,1.02,1.91,0],[.95,.93,1.75,.08],[1.01,.74,1.26,.25],[1.02,.65,.94,.36],[.93,.61,.9,.36],[.60,.56,.82,.36]]);
  const lower=sectionSurface([[.22,.72,1.55,0],[.28,.9,1.79,0],[.43,1.01,1.88,0],[.59,1.03,1.89,0],[.68,.98,1.83,0]]);
  const band=sectionSurface([[.66,1.028,1.925,0],[.70,1.047,1.94,0],[.745,1.057,1.945,0],[.772,1.035,1.918,0]]);
  const floor=bodyLoft([[.32,0,0,.3],[.34,.6,.91,.3],[.48,.6,.91,.3],[.5,0,0,.3]]);
  const tyre=new THREE.LatheGeometry([new THREE.Vector2(.30,-.24),new THREE.Vector2(.46,-.24),new THREE.Vector2(.55,-.20),new THREE.Vector2(.595,-.12),new THREE.Vector2(.61,0),new THREE.Vector2(.595,.12),new THREE.Vector2(.55,.20),new THREE.Vector2(.46,.24),new THREE.Vector2(.30,.24)],40);tyre.rotateZ(Math.PI/2);
  const rim=new THREE.TorusGeometry(.47,.034,10,40);rim.rotateY(Math.PI/2);
  const hub=new THREE.CylinderGeometry(.32,.32,.47,32);hub.rotateZ(Math.PI/2);
  const wheelBand=new THREE.LatheGeometry([new THREE.Vector2(.555,-.14),new THREE.Vector2(.608,-.08),new THREE.Vector2(.614,.08),new THREE.Vector2(.555,.14)],40);wheelBand.rotateZ(Math.PI/2);
  // The pilot is split at the neck and shoulders so each part can pivot: torso+legs, head, two arms (+hands).
  const torsoLoft=bodyLoft([[0,.19,.17,.02],[.12,.29,.22,.02],[.33,.27,.19,0],[.52,.31,.2,0],[.75,.4,.235,.01],[.9,.41,.22,.025],[1.0,.33,.17,.02],[1.065,.2,.145,.02],[1.12,.115,.11,.02],[1.27,.12,.11,0]],40);
  const headLoft=bodyLoft([[1.18,.075,.075,0],[1.22,.12,.11,-.012],[1.28,.15,.13,-.025],[1.39,.185,.15,-.013],[1.50,.20,.16,0],[1.62,.18,.153,.015],[1.7,.125,.11,.02],[1.735,.01,.01,.02]],36);
  const arms=[];const legs=[];const hands=[];
  for(const s of [-1,1]){
    arms.push(limbSurface([[s*.32,.91,.025],[s*.43,.85,-.015],[s*.46,.66,-.17],[s*.44,.53,-.29],[s*.35,.56,-.48],[s*.28,.47,-.68]],[.14,.155,.11,.095,.07,.065]));
    legs.push(limbSurface([[s*.19,.06,.01],[s*.22,-.05,-.2],[s*.27,-.10,-.43],[s*.28,-.12,-.57],[s*.27,-.35,-.75],[s*.24,-.53,-.91]],[.16,.17,.15,.14,.1,.075]));
    hands.push(limbSurface([[s*.28,.47,-.66],[s*.275,.49,-.71],[s*.255,.47,-.76]],[.065,.085,.035]));
  }
  const chest=[]; // Tailored suit has a continuous surface, no exposed muscle lobes.
  const torso=mergeKartGeometry([torsoLoft,...legs,...chest]);[torsoLoft,...legs,...chest].forEach(g=>g.dispose());
  const head=mergeKartGeometry([headLoft]).translate(-PILOT_NECK[0],-PILOT_NECK[1],-PILOT_NECK[2]);headLoft.dispose();
  const armL=mergeKartGeometry([arms[0],hands[0]]).translate(PILOT_SHOULDER[0],-PILOT_SHOULDER[1],-PILOT_SHOULDER[2]);
  const armR=mergeKartGeometry([arms[1],hands[1]]).translate(-PILOT_SHOULDER[0],-PILOT_SHOULDER[1],-PILOT_SHOULDER[2]);[...arms,...hands].forEach(g=>g.dispose());
  const locks=[];for(let i=0;i<9;i++){const x=(i-4)*.048;locks.push(limbSurface([[x*.6,1.72,.035],[x,1.64,.16],[x*1.2,1.44,.21],[x*1.2,1.19,.22],[x*1.3,1.03,.19]],[.035,.047,.045,.038,.012]));}
  const hair=mergeKartGeometry(locks).translate(-PILOT_NECK[0],-PILOT_NECK[1],-PILOT_NECK[2]);locks.forEach(g=>g.dispose());
  Object.assign(KART_GEO,{shell,lower,band,floor,tyre,rim,hub,wheelBand,torso,head,armL,armR,hair});
}
// Longitudinal coachwork: each station defines z, half-width, vertical center and depth.
// Unlike primitive boxes, these smooth closed lofts have authored taper and camber.
function coachwork(stations,facets=24){
  stations=smoothKartSections(stations,4);
  const p=[],uv=[],idx=[];
  stations.forEach((r,j)=>{for(let i=0;i<=facets;i++){const a=i/facets*Math.PI*2;p.push(Math.sin(a)*r[1],r[2]+Math.cos(a)*r[3],r[0]);uv.push(i/facets,j/(stations.length-1));}});
  for(let j=0;j<stations.length-1;j++)for(let i=0;i<facets;i++){const a=j*(facets+1)+i,b=a+facets+1;idx.push(a,b,a+1,b,b+1,a+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
function kartRibbon(points,width=.16,thickness=.045){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),frames=curve.computeFrenetFrames(40,false),p=[],uv=[],ix=[];
  for(let i=0;i<=40;i++){const c=curve.getPointAt(i/40);for(let j=0;j<=12;j++){const a=j/12*Math.PI*2,v=c.clone().addScaledVector(frames.normals[i],Math.cos(a)*width).addScaledVector(frames.binormals[i],Math.sin(a)*thickness);p.push(v.x,v.y,v.z);uv.push(j/12,i/40);}}
  for(let i=0;i<40;i++)for(let j=0;j<12;j++){const a=i*13+j,b=a+13;ix.push(a,b,a+1,b,b+1,a+1);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g;
}
// A cambered polygon with actual thickness for sharply swept automotive panels.
// Unlike a tubular loft, this retains the designed leading edge and planar facets.
function sculptedPanel(points,thickness=.055){
  const contour=points.map(p=>new THREE.Vector2(p[0],p[2]));
  const triangles=THREE.ShapeUtils.triangulateShape(contour,[]),v=[],idx=[],n=points.length;
  for(const sign of [1,-1])for(const p of points)v.push(p[0],p[1]+sign*thickness/2,p[2]);
  for(const [a,b,c] of triangles){idx.push(a,c,b,a+n,b+n,c+n);}
  for(let i=0;i<n;i++){const j=(i+1)%n;idx.push(i,j,i+n,j,j+n,i+n);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
function buildDivisionCoachwork(div,root,add,m){
  const {white,dark,panel,glow,metal}=m,id=div.id;
  const hull=(rows,mat=white,x=0,name='sculpted-coachwork')=>{const o=add(coachwork(rows),mat,root,name);o.position.x=x;return o;};
  const ribbon=(points,mat=white,w=.14,t=.055,name='swept-ribbon')=>add(kartRibbon(points,w,t),mat,root,name);
  const pipe=(points,mat=dark,r=.04)=>add(limbSurface(points,[r,r,r]),mat,root,'suspension-link');
  const ring=(r,t,mat,x,y,z,name='intake-ring')=>{const o=add(new THREE.TorusGeometry(r,t,10,32),mat,root,name);o.position.set(x,y,z);return o;};
  const plate=(points,mat=white,name='cambered-body-panel',thickness=.055)=>add(sculptedPanel(points,thickness),mat,root,name);
  const nose=(length=2.15,width=.65,height=.92)=>{
    if(id==='signal'||id==='vector'||id==='obsidian'){
      const o=plate([[0,.30,-length],[width,.67,-1.27],[width*.76,height,-.45],[0,height+.07,-.62],[-width*.76,height,-.45],[-width,.67,-1.27]],white,'wedge-bonnet');
      plate([[0,.34,-length+.13],[width*.72,.72,-1.2],[.29,height+.065,-.61],[0,height+.10,-.73],[-.29,height+.065,-.61],[-width*.72,.72,-1.2]],panel,'arrow-bonnet-inlay',.026);return o;
    }
    return hull([[-length,.015,.5,.025],[-length+.28,width*.5,.58,.13],[-1.3,width,.73,.23],[-.7,width*.77,height,.22],[-.4,.43,.91,.07]],white);
  };
  const wing=(z,y,span=1.35)=>{for(const s of [-1,1]){ribbon([[s*.1,y,z],[s*.65,y+.03,z-.08],[s*span,y+.06,z]],white,.21,.055,'aerofoil');ribbon([[s*span,y,z+.13],[s*span,y+.3,z],[s*span,y+.36,z-.23]],panel,.14,.045,'wing-endplate');}};
  const cockpit=hull([[-.8,.5,.63,.13],[-.4,.69,.62,.2],[.7,.71,.62,.22],[1.5,.65,.61,.2],[1.8,.08,.58,.06]],dark);cockpit.name='open-cockpit-monocoque';
  for(const s of [-1,1])ribbon([[s*.43,.88,-.65],[s*.72,1.02,-.12],[s*.76,1.08,.7],[s*.6,1.13,1.3],[0,1.1,1.48]],white,.13,.075,'cockpit-shoulder');
  hull([[.55,.35,.63,.04],[.7,.46,.92,.27],[.95,.44,1.18,.38],[1.12,.28,1.16,.35],[1.2,.05,1.03,.1]],dark).name='contoured-seat';
  // Functional crossarms visibly connect the four independent wheel assemblies.
  for(const s of [-1,1])for(const z of [-1.25,1.28])for(const y of [.35,.66])pipe([[s*.45,y,z+.18],[s*.87,y-.03,z],[s*1.23,.6,z]],metal,.035);
  const fenders=(broad=false)=>{for(const s of [-1,1])for(const z of [-1.25,1.28])ribbon([[s*1.04,.56,z-.64],[s*1.04,1.04,z-.47],[s*1.04,1.2,z],[s*1.04,1.04,z+.47],[s*1.04,.6,z+.62]],white,broad?.15:.075,.045,'wheel-arch');};
  if(id==='collective'){
    hull([[-2,.05,.64,.08],[-1.92,.55,.75,.35],[-1.55,.65,.88,.36],[-.65,.51,1.03,.15],[-.48,.4,1,.03]],panel);fenders(true);
    const grille=ring(.46,.065,metal,0,.72,-1.97,'bronze-tourer-grille');grille.scale.set(.88,1.15,1);
    hull([[-2.01,.01,.73,.02],[-2,.38,.73,.46],[-1.96,.38,.73,.46]],dark);
    for(let i=-3;i<=3;i++)pipe([[i*.095,.38,-2.015],[i*.095,.73,-2.02],[i*.095,1.05,-2.005]],metal,.018);
    for(const s of [-1,1]){ribbon([[s*.12,1.19,-1.62],[s*.26,1.18,-1.2],[s*.38,1.12,-.7]],metal,.025,.02);ribbon([[s*.58,.54,-1.95],[s*.82,.56,-1.78],[s*.99,.64,-1.63]],glow,.035,.025);ribbon([[s*.83,.32,-1.5],[s*.95,.3,0],[s*.84,.35,1.5]],metal,.09,.04);}
  }else if(id==='nexus'){
    hull([[-2.04,.45,.84,.45],[-1.88,.56,.86,.55],[-1.25,.5,.85,.45],[-.6,.4,.88,.21]],white);
    ring(.43,.075,metal,0,.84,-2.055,'turbine-lip');ring(.33,.035,glow,0,.84,-2.075,'turbine-ignition');
    const core=add(new THREE.CylinderGeometry(.33,.2,.32,32),dark,root,'turbine-throat');core.rotation.x=Math.PI/2;core.position.set(0,.84,-1.97);
    for(let i=0;i<12;i++){const a=i/12*Math.PI*2;ribbon([[Math.cos(a)*.11,.84+Math.sin(a)*.11,-2.13],[Math.cos(a+.22)*.3,.84+Math.sin(a+.22)*.3,-2.06]],metal,.04,.015,'turbine-vane');}
    for(const s of [-1,1]){hull([[-1.8,.01,.3,.02],[-1.25,.26,.39,.16],[.35,.23,.53,.23],[1.55,.06,.68,.1]],white,s*.85);ring(.27,.075,metal,s*.5,1.3,1.4,'rear-turbine');}fenders();
  }else if(id==='kinetic'){
    nose(2.18,.34,.88);wing(-1.93,.29,1.38);wing(1.42,1.64,1.08);
    for(const s of [-1,1]){pipe([[s*.64,.6,.95],[s*.64,1.1,1.33],[s*.64,1.64,1.42]],metal,.035);hull([[-.3,.04,.45,.03],[0,.22,.57,.16],[.85,.2,.63,.21],[1.3,.02,.58,.03]],panel,s*.79);}
  }else if(id==='loom'||id==='helix'){
    nose(2.05,.46,.85);
    for(const s of [-1,1])for(let j=0;j<3;j++){
      ribbon([[s*.12,.45,-2.1+j*.12],[s*(.9+j*.09),.55+j*.17,-1.15],[s*.45,1.1+j*.08,-.15],[s*(.7+j*.07),1.1+j*.17,.8],[s*.24,1.65+j*.09,1.5],[s*.74,.57,1.7]],j===1?panel:white,.13,.055,'interlaced-body-ribbon');
      if(id==='helix')ribbon([[s*.12,.49,-2.12],[s*.75,.7,-1.15],[s*.61,.85,.12],[s*.87,1.2,1.2],[s*.3,1.68,1.6]],metal,.06,.035,'copper-helix');
    }fenders();
  }else if(id==='aether'){
    hull([[-2.1,.03,.6,.03],[-1.98,.52,.68,.39],[-1.25,.75,.78,.4],[-.55,.53,.9,.14]],white);ring(.29,.075,metal,0,.65,-2.07,'communication-dish');ring(.18,.055,glow,0,.65,-2.1);fenders(true);
    const orbit=ring(.88,.035,metal,0,1.28,1.34,'orbital-antenna');orbit.rotation.y=.15;
    for(const s of [-1,1]){pipe([[s*.7,.75,1.25],[s*.9,1.45,1.35],[s*.92,2.02,1.35]],metal,.025);ring(.1,.035,glow,s*.92,2.02,1.35,'antenna-node');}
  }else if(id==='animus'){
    nose(1.92,.43,.99);fenders();
    for(const s of [-1,1]){hull([[-1.7,.02,.3,.02],[-1.44,.25,.38,.16],[-.6,.19,.48,.12],[.5,.2,.67,.12],[1.4,.01,.9,.02]],white,s*.82);
      for(let i=0;i<5;i++){const spring=ring(.09,.024,metal,s*.91,.46+i*.095,-1.18,'suspension-coil');spring.rotation.x=Math.PI/2;}
      ribbon([[s*.15,.44,-1.94],[s*.37,.65,-1.5],[s*.38,.98,-.72]],glow,.025,.02,'robot-sensor-strip');}
    pipe([[.5,.7,1.12],[.68,1.65,1.35],[.65,2.05,1.3]],metal,.05);
    const drone=hull([[1.0,.05,2.05,.04],[1.1,.32,2.14,.24],[1.45,.32,2.14,.24],[1.58,.03,2.12,.03]],white,.65,'companion-drone');ring(.12,.04,glow,.65,2.15,1.02,'drone-optic');
  }else if(id==='ledger'){
    // Closed crystal planes keep the nose short; grille and flank cells are actual geometry.
    plate([[0,.52,-2.08],[.60,.59,-1.78],[.63,.88,-1.16],[.38,1.08,-.5],[0,1.15,-.71],[-.38,1.08,-.5],[-.63,.88,-1.16],[-.60,.59,-1.78]],white,'ledger-crystal-nose',.12);fenders();
    const hex=(x,y,z,r,side=false)=>{const g=new THREE.TorusGeometry(r,.016,4,6);const cell=add(g,panel,root,side?'ledger-honeycomb-flank':'ledger-hex-grille');cell.position.set(x,y,z);if(side)cell.rotation.y=Math.PI/2;return cell;};
    const grilleShape=new THREE.Shape();[[-.54,.51],[-.54,.89],[-.28,1.015],[.37,1.015],[.56,.88],[.56,.51],[.29,.435],[-.29,.435]].forEach(([x,y],i)=>i?grilleShape.lineTo(x,y):grilleShape.moveTo(x,y));grilleShape.closePath();
    const grilleBacking=add(new THREE.ExtrudeGeometry(grilleShape,{depth:.07,bevelEnabled:true,bevelSize:.008,bevelThickness:.008,bevelSegments:2}),dark,root,'ledger-recessed-grille-backing');grilleBacking.position.z=-2.004;
    ribbon([[-.55,.51,-2.04],[-.55,.90,-2.04],[-.28,1.03,-2.04],[.37,1.03,-2.04],[.58,.89,-2.04],[.58,.51,-2.04],[.29,.42,-2.04],[-.29,.42,-2.04],[-.55,.51,-2.04]],white,.024,.027,'ledger-grille-bezel');
    for(let row=0;row<3;row++)for(let col=0;col<5;col++)hex((col-2)*.17+(row%2)*.085,.57+row*.145,-2.02,.09);
    for(const side of [-1,1]){
      hull([[-.7,.05,.64,.08],[-.3,.14,.68,.19],[.65,.14,.68,.19],[1.1,.03,.63,.04]],white,side*.85,'ledger-white-sidepod');
      for(let row=0;row<2;row++)for(let col=0;col<4;col++)hex(side*.996,.65+row*.15,-.30+col*.20,.09,true);
      ribbon([[side*.5,.67,-1.98],[side*.65,.93,-1.3],[side*.42,1.14,-.57]],glow,.025,.018,'headlight-signature');
      plate([[side*.2,.8,1.1],[side*.65,1.15,1.31],[side*.64,.81,1.76],[side*.18,.68,1.89]],white,'ledger-faceted-rear-cowl');
    }
  }else if(id==='terra'){
    hull([[-2.08,.48,.71,.28],[-1.89,.64,.78,.35],[-1.15,.66,.85,.35],[-.48,.44,.98,.11]],white,0,'terra-pylon-nose');fenders(true);
    for(const side of [-1,1]){
      ribbon([[side*.9,.40,-1.9],[side*.99,.4,-.55],[side*.99,.43,.8],[side*.85,.43,1.76]],panel,.12,.085,'terra-structural-rail');
      ribbon([[side*.75,.5,-1.8],[side*.86,1.25,-1.27],[side*.77,.6,-.58]],white,.17,.13,'terra-overpass-arch');
      ribbon([[side*.75,.51,.69],[side*.86,1.28,1.25],[side*.75,.53,1.85]],white,.17,.13,'terra-rear-overpass-arch');
      for(const z of [-1.55,-1.05])ribbon([[side*.12,1.08,z],[side*.49,1.09,z],[side*.62,.96,z]],dark,.017,.012,'terra-panel-seam');
      ribbon([[side*.12,.75,-2.1],[side*.36,.75,-2.1],[side*.54,.78,-2.04]],glow,.065,.026,'terra-block-headlight');
    }
  }else if(id==='obsidian'){
    nose(2.45,.52,1.0);
    for(const side of [-1,1]){
      plate([[side*.06,.32,-2.46],[side*1.42,.4,-1.52],[side*1.1,.63,-.76],[side*.51,.57,-1.25]],white,'obsidian-knife-canard');
      plate([[side*.52,.78,-.68],[side*.96,.91,-.38],[side*.99,.88,.71],[side*.69,1.04,.89]],dark,'obsidian-carbon-shoulder');
      plate([[side*.67,.74,.73],[side*1.13,1.57,1.93],[side*.95,1.57,1.63],[side*.55,.87,1.02]],white,'obsidian-razor-tail');
      ribbon([[side*.14,.63,-2.04],[side*.51,.74,-1.59],[side*.73,.83,-1.02]],glow,.026,.017,'obsidian-slit-headlight');
      ribbon([[side*.46,.95,-1.12],[0,.77,-1.67],[side*.40,.85,-1.20]],panel,.065,.03,'obsidian-nose-chevron');
    }
  }else if(id==='civic'){
    hull([[-2.1,.03,.72,.04],[-1.94,.42,.72,.32],[-1.48,.66,.80,.39],[-.83,.58,.98,.24],[-.43,.43,1,.06]],white,0,'civic-oval-nose');fenders(true);
    const lamp=ring(.18,.05,glow,0,.76,-2.1,'civic-single-oval-lamp');lamp.scale.x=1.5;
    const hoop=ring(.65,.058,white,0,1.49,1.48,'civic-halo-hoop');ring(.65,.022,glow,0,1.49,1.418,'civic-halo-light');
    for(const side of [-1,1]){hull([[-1.75,.01,.48,.02],[-1.2,.24,.62,.20],[.8,.23,.71,.25],[1.7,.02,.63,.03]],white,side*.88,'civic-pill-flank');const lamp=ring(.10,.037,glow,side*.67,.79,-1.76,'civic-round-headlamp');lamp.scale.x=1.4;}
  }else if(id==='cognara'){
    hull([[-2.12,.04,.58,.05],[-1.91,.50,.68,.25],[-1.24,.65,.85,.34],[-.51,.43,1.03,.11]],white,0,'cognara-lab-shell');fenders(true);
    for(const side of [-1,1]){ring(.17,.045,metal,side*.33,.77,-1.99,'cognara-sensor-housing');ring(.112,.043,glow,side*.33,.77,-2.015,'cognara-sensor-core');}
    ribbon([[0,.72,-2.1],[.23,1.04,-1.64],[-.24,1.20,-1.15],[.11,1.19,-.64],[.64,1.13,-.13],[.73,1.15,.65]],panel,.068,.033,'cognara-neural-ribbon');
    for(const side of [-1,1])hull([[.65,.03,.75,.04],[.9,.22,1.04,.30],[1.47,.22,.97,.26],[1.7,.02,.69,.03]],white,side*.63,'cognara-rear-pod');
  }else if(id==='gaia'){
    nose(2.1,.50,.88);
    for(const side of [-1,1]){
      for(const z of [-1.23,1.26])plate([[side*.82,.77,z-.65],[side*1.14,1.30,z-.14],[side*1.20,1.25,z+.15],[side*.94,.70,z+.62],[side*.83,.94,z+.08]],white,'gaia-leaf-fender',.065);
      ribbon([[side*.09,.48,-2.12],[side*.83,.71,-1.22],[side*.43,1.15,-.36],[side*.83,1.18,.73],[side*.24,1.48,1.61]],panel,.075,.04,'gaia-vine-wrap');
      hull([[1.08,.03,.87,.04],[1.27,.22,1.25,.40],[1.55,.15,1.39,.31],[1.86,.01,1.06,.02]],white,side*.33,'gaia-seed-pod');
    }
    const trace=panel.clone();trace.color.set(div.acc2);trace.emissive.set(div.acc2);
    ribbon([[.14,.56,-2.0],[.76,.80,-1.22],[.45,1.19,-.4],[.75,1.22,.72]],trace,.012,.013,'gaia-circuit-blue-trace');
  }else if(id==='nomad'){
    hull([[-2.05,.12,.69,.10],[-1.77,.53,.84,.31],[-1.04,.56,.96,.28],[-.44,.41,1.1,.08]],white,0,'nomad-raised-bonnet');
    for(const side of [-1,1]){
      for(const z of [-1.25,1.28]){ribbon([[side*1.04,.77,z-.60],[side*1.04,1.32,z],[side*1.04,.78,z+.60]],white,.15,.075,'nomad-raised-arch');for(let i=0;i<5;i++){const coil=ring(.095,.02,metal,side*.89,.55+i*.105,z,'nomad-coil-spring');coil.rotation.x=Math.PI/2;}}
      hull([[-.45,.04,.66,.06],[-.26,.23,.73,.23],[.57,.23,.73,.23],[.76,.03,.7,.04]],white,side*.98,'nomad-side-case');
      ribbon([[side*.66,1.01,-1.7],[side*.61,1.19,-.71],[side*.80,1.12,.3],[side*.71,1.20,1.11]],panel,.065,.035,'nomad-horizon-stripe');
      for(const z of [-.14,.42])ribbon([[side*.90,.95,z],[side*1.15,.95,z],[side*1.18,.60,z]],metal,.025,.02,'nomad-case-strap');
      ribbon([[side*.1,.79,-2.05],[side*.39,.86,-1.95],[side*.51,.93,-1.7]],glow,.036,.02,'nomad-headlight');
    }
    for(const x of [-.48,0,.48])pipe([[x,1.16,1.15],[x,1.34,1.43],[x,1.25,1.81]],metal,.033);
  }else if(id==='eon'){
    hull([[-2.1,.035,.63,.04],[-1.92,.44,.75,.30],[-1.35,.59,.84,.33],[-.52,.43,.99,.12]],white,0,'eon-medical-tourer');fenders(true);
    for(const side of [-1,1]){const infinity=ring(.135,.03,glow,side*.115,.78,-2.02,'eon-infinity-ring');infinity.scale.x=1.16;hull([[.70,.035,.77,.04],[.98,.24,.88,.19],[1.55,.24,.78,.21],[1.81,.025,.65,.03]],white,side*.60,'eon-smooth-rear-cowl');}
    ribbon([[0,.91,-1.95],[0,1.13,-1.4],[0,1.21,-.92],[0,1.13,-.44]],glow,.035,.025,'eon-spine-light');
  }else{
    const sharp=id==='signal'||id==='vector';nose(sharp?2.55:2.15, id==='juris'?.73:.57,1.02);
    for(const s of [-1,1]){
      if(!sharp)hull([[-2.05,.015,.35,.015],[-1.45,.22,.5,.13],[-.5,.22,.75,.17],[.6,.19,.72,.15],[1.6,.03,.63,.04]],white,s*.77);
      ribbon([[s*.06,.53,sharp?-2.48:-2.07],[s*.52,.68,-1.56],[s*.83,.84,-.75],[s*.85,.61,.45]],glow,.025,.023,'headlight-signature');
      if(sharp){
        plate([[s*.65,.62,.4],[s*1.28,1.48,1.97],[s*.97,1.50,1.70],[s*.54,.87,.75]],white,'swept-tail-fin');
        plate([[s*.02,.3,-2.6],[s*1.48,.39,-1.46],[s*1.1,.62,-.74],[s*.50,.60,-1.27]],white,'split-front-canard');
        plate([[s*.12,.335,-2.38],[s*1.33,.425,-1.45],[s*.91,.62,-.96],[s*.57,.635,-1.30]],panel,'canard-inset',.018);
        ribbon([[s*.03,.32,-2.57],[s*1.43,.425,-1.45],[s*1.05,.65,-.77]],glow,.017,.014,'canard-edge-light');
      }
      if(id==='juris'){hull([[-1.8,.1,.38,.1],[-1.3,.35,.78,.37],[-.75,.29,.92,.3],[-.45,.03,.7,.04]],dark,s*.92);ribbon([[s*.94,.38,-1.75],[s*1.18,.85,-1.27],[s*.98,1.18,-.7]],metal,.055,.04,'armor-gold-seam');hull([[.85,.06,.7,.05],[1.1,.25,1.06,.37],[1.65,.2,.99,.3],[1.8,.03,.7,.04]],dark,s*.68);}
      if(id==='hybrid')ribbon([[s*1.23,.5,-1.9],[s*1.23,1.16,-1.3],[s*1.23,1.1,-.9]],metal,.045,.025,'orange-outrigger');
    }
    if(id==='zenflow'||id==='hybrid'){
      for(const s of [-1,1]){
        const rows=smoothKartSections([[-2.12,.14,.025,.45,.025],[-1.76,.50,.17,.66,.08],[-1.19,.73,.22,.83,.14],[-.61,.72,.19,1.0,.11],[-.31,.58,.035,1.01,.035]],5);
        const verts=[],indices=[],seg=20;
        for(const [z,c,w,y,h] of rows)for(let k=0;k<=seg;k++){const a=k/seg*Math.PI*2;verts.push(s*(c+Math.sin(a)*w),y+Math.cos(a)*h,z);}
        for(let j=0;j<rows.length-1;j++)for(let k=0;k<seg;k++){const a=j*(seg+1)+k,b=a+seg+1;if(s>0)indices.push(a,b,a+1,a+1,b,b+1);else indices.push(a,a+1,b,a+1,b+1,b);}
        const fairing=new THREE.BufferGeometry();fairing.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));fairing.setIndex(indices);fairing.computeVertexNormals();add(fairing,white,root,'sculpted-split-fairing');
        plate([[s*.19,.49,-2.02],[s*.77,.585,-1.74],[s*.91,.76,-1.25],[s*.80,.89,-.88],[s*.62,.75,-1.37]],dark,'recessed-headlamp-well');
        ribbon([[s*.23,.52,-1.96],[s*.72,.61,-1.73],[s*.88,.77,-1.24],[s*.8,.88,-.91]],glow,.037,.027,'swept-headlamp');
        ribbon([[s*.52,1.11,-.42],[s*.94,.86,-.9],[s*1.06,.67,-1.46]],id==='hybrid'?metal:panel,.029,.02,'fender-crown-inlay');
      }
    }
    if(!sharp&&id!=='zenflow'&&id!=='hybrid')fenders(id==='juris');if(id==='vector')wing(1.36,1.42,1.32);
  }
  if(id==='juris'){
    const shield=new THREE.Shape();shield.moveTo(0,-.25);shield.lineTo(-.17,-.04);shield.lineTo(-.19,.20);shield.lineTo(.19,.20);shield.lineTo(.17,-.04);shield.closePath();
    const badge=add(new THREE.ExtrudeGeometry(shield,{depth:.04,bevelEnabled:true,bevelThickness:.015,bevelSize:.015,bevelSegments:2}),metal,root,'juris-nose-shield');badge.position.set(0,.66,-2.13);
  }
  if(id==='animus'){
    for(const s of [-1,1])for(let j=0;j<3;j++)pipe([[s*.66,.45+j*.09,-.40],[s*.97,.47+j*.09,-.12],[s*.98,.48+j*.09,.58]],metal,.023);
    for(const s of [-1,1])plate([[s*.02,.27,-2.03],[s*.48,.32,-1.82],[s*.81,.43,-1.3],[s*.37,.55,-1.46]],white,'armored-front-jaw');
  }
  if(id==='loom'||id==='helix'){
    for(const s of [-1,1])ribbon([[s*.88,.52,-1.67],[-s*.2,.31,-2.1],[-s*.88,.69,-1.57],[-s*.55,1.1,-.7]],id==='loom'?panel:metal,.10,.04,'crossed-nose-ribbon');
  }
  // Inferred rear surfaces follow each division's visible front design language.
  for(const side of [-1,1]){
    ribbon([[side*.12,.70,1.77],[side*.53,.82,1.66],[side*.85,.76,1.37]],glow,.023,.018,'rear-light-signature');
    for(let j=0;j<3;j++)plate([[side*(.12+j*.18),.2,1.41],[side*(.12+j*.18),.2,1.99],[side*(.16+j*.18),.36,1.84],[side*(.16+j*.18),.37,1.5]],dark,'diffuser-fin',.027);
  }
  return {hull,ribbon};
}

// Rig contract (Blender clip pipeline and FX build against these names):
//   root `${name} Reference Chassis` > body > [coachwork, cockpit-well, pilot > (torso, head > head-mesh[+hair], arm-l, arm-r, halo, star),
//   steering-wheel > steering-wheel-rim, steering-column, exhaust-l, exhaust-r]; root > wheel-fl/fr/rl/rr > (spin > tyre/hub/band, wheel-light-ring);
//   root > underbody-flow-ring, aegis-shield.
const KART_WHEEL_REST=[[-1.23,.6,-1.25],[1.23,.6,-1.25],[-1.23,.6,1.28],[1.23,.6,1.28]];
// Finished racing equipment follows the neck/shoulder rigs, including fallback builds.
function dressRacePilot(div,pilot,head,arms,add,{white,dark,panel,metal}){
  const index=ROSTER.findIndex(d=>d.id===div.id);
  const visor=new THREE.MeshPhysicalMaterial({color:['#153544','#362c18','#192d44','#402712'][index%4],metalness:.72,roughness:.13,clearcoat:1,envMapIntensity:1.8});
  const rubber=new THREE.MeshStandardMaterial({color:0x10151d,roughness:.82,metalness:.02});
  const ell=(name,parent,mat,p,s)=>{const o=add(new THREE.SphereGeometry(1,24,16),mat,parent,name);o.position.set(...p);o.scale.set(...s);return o;};
  const tube=(name,parent,mat,pts,r)=>add(limbSurface(pts,pts.map(()=>r)),mat,parent,name);
  // A complete shell and curved reflective visor replace a featureless metallic face.
  ell('helmet-shell',head,white,[0,.285,.005],[.246,.305,.243]);
  ell('helmet-visor-gasket',head,rubber,[0,.295,-.175],[.226,.132,.102]);
  ell('helmet-mirrored-visor',head,visor,[0,.308,-.215],[.207,.104,.07]);
  ell('helmet-chin-guard',head,panel,[0,.11,-.143],[.214,.085,.145]);
  tube('helmet-crown-stripe',head,panel,[[0,.57,.08],[0,.584,-.02],[0,.54,-.14],[0,.47,-.21]],.025+(index%3)*.008);
  for(const s of[-1,1]){
    ell('helmet-ear-lock',head,metal,[s*.241,.29,.005],[.019,.065,.062]);
    tube('helmet-cheek-rail',head,panel,[[s*.2,.16,-.17],[s*.235,.22,-.035],[s*.21,.37,.12]],.022);
    tube('shoulder-harness',pilot,rubber,[[s*.20,.99,-.145],[s*.23,.84,-.268],[s*.19,.60,-.243],[s*.12,.3,-.21]],.033);
    tube('harness-stitched-edge',pilot,white,[[s*.22,.96,-.171],[s*.25,.82,-.272],[s*.21,.60,-.251]],.006);
    const shoulder=arms[s<0?0:1];
    ell('suit-shoulder-pad',shoulder,panel,[s*.035,-.015,0],[.165,.125,.166]);
    ell('racing-glove',shoulder,rubber,[s*(-.065),-.425,-.715],[.087,.08,.099]);
    ell('glove-knuckle-plate',shoulder,white,[s*(-.065),-.375,-.72],[.073,.025,.073]);
    ell('racing-boot',pilot,rubber,[s*.245,-.48,-.92],[.115,.115,.205]);
    tube('suit-side-piping',pilot,panel,[[s*.30,.77,.08],[s*.275,.47,.05],[s*.285,.17,0]],.013);
  }
  const collar=add(new THREE.TorusGeometry(.135,.032,8,28),rubber,pilot,'suit-raised-collar');collar.position.y=1.11;collar.rotation.x=Math.PI/2;
  ell('harness-buckle',pilot,metal,[0,.32,-.237],[.064,.055,.02]);
  tube('suit-front-zip',pilot,metal,[[0,.96,-.196],[0,.8,-.267],[0,.55,-.221],[0,.36,-.223]],.008);
  // Division silhouettes: aero blades, sensor pods, crown vents and swept stabilizers.
  if(index%4===0)for(const s of[-1,1])tube('helmet-aero-blade',head,panel,[[s*.15,.45,.1],[s*.17,.52,.23],[s*.17,.30,.28]],.03);
  else if(index%4===1)for(const s of[-1,1])ell('helmet-comms-pod',head,panel,[s*.264,.30,.07],[.04,.09,.09]);
  else if(index%4===2)for(const s of[-1,0,1])tube('helmet-top-vent',head,panel,[[s*.095,.555,-.01],[s*.095,.57,.12],[s*.095,.43,.23]],.018);
  else {tube('helmet-rear-spoiler',head,panel,[[-.24,.44,.21],[0,.49,.27],[.24,.44,.21]],.035);}
}

function buildKart(div){
  if(typeof createLoadedKart==='function'){const model=createLoadedKart(div);if(model)return model;}
  const root=new THREE.Group();root.name=div.name+' Reference Chassis';
  const {white,dark,panel,glow,skin,metal,tyre}=kartMaterials(div);
  const add=(g,m,parent=root,name='')=>{const o=new THREE.Mesh(g,m);o.name=name;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
  const body=new THREE.Group();body.name='body';root.add(body);
  buildDivisionCoachwork(div,body,add,{white,dark,panel,glow,metal});add(KART_GEO.floor,dark,body,'cockpit-well');
  // Pilot: torso+legs, head on a neck pivot, arms on shoulder pivots. All parts share the skin material.
  const pilot=new THREE.Group();pilot.name='pilot';pilot.position.set(0,1,.37);body.add(pilot);
  add(KART_GEO.torso,skin,pilot,'torso');
  const head=new THREE.Group();head.name='head';head.position.set(...PILOT_NECK);pilot.add(head);add(KART_GEO.head,skin,head,'head-mesh');
  const arms=[-1,1].map(s=>{const arm=new THREE.Group();arm.name=s<0?'arm-l':'arm-r';arm.position.set(s*PILOT_SHOULDER[0],PILOT_SHOULDER[1],PILOT_SHOULDER[2]);pilot.add(arm);add(s<0?KART_GEO.armL:KART_GEO.armR,skin,arm,arm.name+'-mesh');return arm;});
  if(div.id==='kinetic'||div.id==='loom')pilot.scale.set(.9,1,.94);
  dressRacePilot(div,pilot,head,arms,add,{white,dark,panel,metal});
  // Steering wheel is connected to the footwell, with hands meeting its upper grips; the group turns about its own tilted axis via rotation.z.
  const steeringWheel=new THREE.Group();steeringWheel.name='steering-wheel';steeringWheel.position.set(0,1.45,-.34);steeringWheel.rotation.x=-.7;body.add(steeringWheel);
  add(new THREE.TorusGeometry(.25,.041,12,40),dark,steeringWheel,'steering-wheel-rim');
  const wheelHub=add(new THREE.BoxGeometry(.23,.10,.065),metal,steeringWheel,'steering-hub');wheelHub.position.z=.018;
  for(const side of[-1,1]){
    const spoke=add(new THREE.BoxGeometry(.14,.045,.04),metal,steeringWheel,'steering-spoke');spoke.position.set(side*.16,-.015,0);spoke.rotation.z=side*.22;
    const paddle=add(new THREE.BoxGeometry(.065,.18,.018),metal,steeringWheel,'shift-paddle');paddle.position.set(side*.16,.015,-.055);
    const button=add(new THREE.SphereGeometry(.021,10,8),panel,steeringWheel,'wheel-thumb-button');button.position.set(side*.083,.021,.061);
  }
  const display=add(new THREE.BoxGeometry(.095,.035,.008),panel,steeringWheel,'wheel-telemetry-display');display.position.set(0,.01,.056);
  const marker=add(new THREE.BoxGeometry(.03,.042,.04),white,steeringWheel,'wheel-center-marker');marker.position.y=.25;
  add(limbSurface([[0,.64,-.58],[0,1.15,-.46],[0,1.44,-.34]],[.03,.03,.03]),dark,body,'steering-column');
  const wheels=[];
  KART_WHEEL_REST.forEach((p,i)=>{
    const pivot=new THREE.Group(),spin=new THREE.Group();pivot.name=['wheel-fl','wheel-fr','wheel-rl','wheel-rr'][i];spin.name='spin';pivot.position.set(...p);root.add(pivot);pivot.add(spin);
    add(KART_GEO.tyre,['kinetic','animus','nomad','terra'].includes(div.id)?tyre:white,spin,'rounded-wheel-shell');add(KART_GEO.hub,panel,spin,'recessed-colored-hub');add(KART_GEO.wheelBand,panel,spin,'translucent-tire-band');
    if(div.id==='nomad')for(let j=0;j<18;j++){const a=j/18*Math.PI*2;const block=add(new THREE.BoxGeometry(.39,.045,.095),tyre,spin,'nomad-tread-block');block.position.set(0,Math.cos(a)*.557,Math.sin(a)*.557);block.rotation.x=a;}
    const luminous=glow.clone();const ring=add(KART_GEO.rim,luminous,pivot,'wheel-light-ring');ring.position.x=i%2?.255:-.255;
    wheels.push({pivot,spin,glow:ring,side:i%2?1:-1,rest:new THREE.Vector3(...p)});
  });
  const exhaust=[-.48,.48].map(x=>{const e=add(new THREE.TorusGeometry(.11,.045,8,20),glow.clone(),body,x<0?'exhaust-l':'exhaust-r');e.position.set(x,.37,1.89);return e;});
  const under=add(new THREE.TorusGeometry(1,.035,8,48),glow.clone(),root,'underbody-flow-ring');under.rotation.x=Math.PI/2;under.scale.set(.85,1.6,1);under.position.y=.19;
  const shield=add(new THREE.SphereGeometry(2.15,24,16),new THREE.MeshPhysicalMaterial({color:0x00d9b5,emissive:0x00d9b5,emissiveIntensity:.35,transparent:true,opacity:.16,roughness:.15,side:THREE.DoubleSide}),root,'aegis-shield');shield.position.y=.9;shield.visible=false;
  const halo=new THREE.Group(),star=new THREE.Group();halo.name='halo';star.name='star';halo.visible=star.visible=false;pilot.add(halo,star);
  root.userData={wheels,body,pilot,head,arms,steeringWheel,exhaust,under,shield,halo,star,glow,chassis:div.id,clipState:null,clipNodes:null,anim:null};
  // Object3D.clone() JSON-copies userData; keep the rig references out of that copy (kartProjection ghosts only need the id).
  Object.defineProperty(root.userData,'toJSON',{value:()=>({chassis:div.id}),enumerable:false});
  // A shared alpha footprint grounds karts even when phone shadow maps are off.
  if(TEX.contactShadow){
    if(!KART_GEO.contactFootprint)KART_GEO.contactFootprint=new THREE.PlaneGeometry(3.9,5.4);
    const contact=add(KART_GEO.contactFootprint,new THREE.MeshBasicMaterial({map:TEX.contactShadow,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}),root,'contact-shadow');contact.rotation.x=-Math.PI/2;contact.position.y=.035;contact.castShadow=contact.receiveShadow=false;
  }
  // Articulated shoulder caps, white/copper collar details and wheel spokes.
  for(let i=0;i<2;i++){
    const cap=add(new THREE.TorusGeometry(.132,.018,6,20),['hybrid','helix'].includes(div.id)?metal:panel,arms[i],'shoulder-seam');cap.rotation.y=Math.PI/2;cap.position.x=i===0?-.03:.03;
  }
  for(const w of wheels){const spokes=[];for(let j=0;j<5;j++){const a=j/5*Math.PI*2;const g=new THREE.BoxGeometry(.035,.055,.27);g.translate(0,0,.18);g.rotateX(a);g.translate(w.side*.249,0,0);spokes.push(g);}const g=mergeKartGeometry(spokes);spokes.forEach(p=>p.dispose());add(g,metal,w.spin,'machined-wheel-spokes');}
  batchKartBody(body);finishKartCockpit(root);resolveKartRig(root);return root;
}

// Contact constraints run AFTER the authored clips: shoulders remain attached to the
// suit while the original Blender sleeve surface bends to the moving steering grips.
// Each instance owns only its two deforming meshes; shared GLB templates stay immutable.
function prepareKartContactRig(root){
  const ud=root.userData;if(ud.contactRig||!ud.arms||!THREE.Vector3)return;
  const arms=ud.arms.map((arm,i)=>{
    const mesh=arm.getObjectByName(arm.name+'-mesh');
    if(!mesh||!mesh.geometry.attributes.position)return null;
    mesh.geometry=mesh.geometry.clone();delete mesh.geometry.userData.blenderShared;
    const g=mesh.geometry;
    // Optimized GLBs may interleave attributes. Give mutable streams their own
    // buffers before editing; touching an interleaved array corrupts UVs/normals.
    for(const key of ['position','normal']){const source=g.attributes[key];if(!source)continue;
      const values=new Float32Array(source.count*3);for(let j=0;j<source.count;j++){values[j*3]=source.getX(j);values[j*3+1]=source.getY(j);values[j*3+2]=source.getZ(j);}
      g.setAttribute(key,new THREE.BufferAttribute(values,3));
    }
    const p=g.attributes.position,n=g.attributes.normal;
    const glove=arm.getObjectByName('racing-glove');
    const wrist=glove?glove.position.clone():new THREE.Vector3(i?-.065:.065,-.425,-.715);
    const accessories=arm.children.filter(o=>/racing-glove|glove-knuckle/.test(o.name)).map(node=>({node,rest:node.position.clone()}));
    const weights=new Float32Array(p.count),derivatives=new Float32Array(p.count);
    for(let j=0;j<p.count;j++){const t=Math.max(0,Math.min(1,(-p.getZ(j)-.12)/.56));weights[j]=t*t*(3-2*t);derivatives[j]=-6*t*(1-t)/.56;}
    p.setUsage(THREE.DynamicDrawUsage);if(n)n.setUsage(THREE.DynamicDrawUsage);
    // Deformation stays within the cockpit; conservative bounds avoid per-frame scans.
    g.computeBoundingSphere();g.boundingSphere.radius+=.8;
    return {arm,mesh,wrist,accessories,rest:new Float32Array(p.array),normal:n?new Float32Array(n.array):null,weights,derivatives,delta:new THREE.Vector3(),grip:new THREE.Vector3(i?.244:-.244,.052,.018)};
  });
  ud.contactRig={arms};
}
function constrainKartHands(root,state){
  const ud=root.userData,rig=ud.contactRig;if(!rig||!ud.steeringWheel)return;
  root.updateMatrixWorld(true);
  for(let i=0;i<rig.arms.length;i++){
    const a=rig.arms[i];if(!a)continue;
    // Celebration deliberately releases the right hand; spinout releases both.
    const release=state==='spinout'||state==='victory'&&i===1;
    a.delta.copy(a.grip);ud.steeringWheel.localToWorld(a.delta);a.arm.worldToLocal(a.delta);a.delta.sub(a.wrist);
    if(release)a.delta.set(0,0,0);
    const p=a.mesh.geometry.attributes.position,n=a.mesh.geometry.attributes.normal,d=a.delta;
    for(let j=0;j<p.count;j++){
      const k=j*3,w=a.weights[j];p.array[k]=a.rest[k]+d.x*w;p.array[k+1]=a.rest[k+1]+d.y*w;p.array[k+2]=a.rest[k+2]+d.z*w;
      if(n&&a.normal){const nx=a.normal[k],ny=a.normal[k+1],nz=a.normal[k+2],dw=a.derivatives[j];
        const z=nz-dw*(d.x*nx+d.y*ny+d.z*nz)/Math.max(.15,1+d.z*dw),len=Math.hypot(nx,ny,z)||1;
        n.array[k]=nx/len;n.array[k+1]=ny/len;n.array[k+2]=z/len;}
    }
    p.needsUpdate=true;if(n)n.needsUpdate=true;
    for(const part of a.accessories)part.node.position.copy(part.rest).add(d);
  }
}
// Seat shell, cushion and pedal plates provide visible mechanical points of contact.
// Per-rider local proportions, applied to the complete helmet assembly so visor,
// chin guard and fasteners remain connected. Neck/shoulder/wheel pivots are fixed.
const RIDER_FIT={
 zenflow:[1,.98,1.06,1],collective:[1.08,.94,1,1.12],hybrid:[.94,1.08,1.03,.92],nexus:[1.04,1.06,.94,1.04],
 kinetic:[.94,.94,1.13,.9],juris:[1.12,1.02,.96,1.17],signal:[.91,.97,1.15,.93],loom:[.95,1.12,.96,.96],
 vector:[1.02,.92,1.14,1.08],aether:[1.06,1.08,1.02,1.02],animus:[1.13,.94,1.05,1.2],helix:[.94,1.03,.96,.91],
 ledger:[1.04,1.1,.95,1.07],terra:[1.14,.91,1.08,1.22],obsidian:[1.08,.95,1.12,1.18],civic:[1.01,1.09,1.03,.97],
 cognara:[.92,1.14,1.04,.94],gaia:[1.05,1.04,1.09,1.03],nomad:[1.07,.99,1.13,1.09],eon:[.96,1.13,.98,.95]
};
// Explicit profiles replace ordinal/modulo accessories. Coordinates remain in the
// seated pilot's local frame; neck, shoulder and wheel-contact anchors never move.
const RIDER_IDENTITY={
 zenflow:   {family:'stream',width:1.02,depth:1.08,chest:1.03,mantle:.12,crown:.07},
 collective:{family:'tourer',width:1.16,depth:1.02,chest:1.17,mantle:.20,crown:.04},
 hybrid:    {family:'stream',width:.97,depth:1.12,chest:.98,mantle:.10,crown:.11},
 nexus:     {family:'sensor',width:1.10,depth:1.00,chest:1.08,mantle:.17,crown:.14},
 kinetic:   {family:'sprint',width:.98,depth:1.18,chest:.96,mantle:.09,crown:.04},
 juris:     {family:'guard',width:1.18,depth:1.03,chest:1.20,mantle:.24,crown:.10},
 signal:    {family:'sprint',width:.94,depth:1.22,chest:.93,mantle:.08,crown:.12},
 loom:      {family:'sensor',width:1.00,depth:1.05,chest:1.00,mantle:.13,crown:.18},
 vector:    {family:'sprint',width:1.08,depth:1.21,chest:1.10,mantle:.15,crown:.06},
 aether:    {family:'tourer',width:1.13,depth:1.09,chest:1.06,mantle:.19,crown:.13},
 animus:    {family:'guard',width:1.24,depth:1.08,chest:1.24,mantle:.27,crown:.06},
 helix:     {family:'stream',width:.96,depth:1.03,chest:.97,mantle:.11,crown:.04},
 ledger:    {family:'guard',width:1.08,depth:.98,chest:1.09,mantle:.17,crown:.17},
 terra:     {family:'guard',width:1.26,depth:1.13,chest:1.26,mantle:.29,crown:.03},
 obsidian:  {family:'sprint',width:1.12,depth:1.23,chest:1.16,mantle:.21,crown:.13},
 civic:     {family:'tourer',width:1.06,depth:1.05,chest:1.02,mantle:.15,crown:.08},
 cognara:   {family:'sensor',width:.96,depth:1.09,chest:.96,mantle:.11,crown:.21},
 gaia:      {family:'stream',width:1.11,depth:1.10,chest:1.11,mantle:.18,crown:.09},
 nomad:     {family:'tourer',width:1.19,depth:1.17,chest:1.15,mantle:.23,crown:.16},
 eon:       {family:'sensor',width:1.02,depth:1.02,chest:1.01,mantle:.14,crown:.24}
};
function finishRiderIdentity(root){
 const ud=root.userData,profile=RIDER_IDENTITY[ud.chassis];
 // The marker survives glTF export/import, preventing a second sculpt on baked GLBs.
 if(!profile||ud.zf_rider_identity_baked||root.getObjectByName('division-rider-identity'))return;
 const div=ROSTER.find(d=>d.id===ud.chassis),head=ud.head,pilot=ud.pilot;
 const marker=new THREE.Group();marker.name='division-rider-identity';pilot.add(marker);
 marker.userData={division:ud.chassis,family:profile.family};
 const paint=new THREE.MeshPhysicalMaterial({color:div.acc,metalness:.38,roughness:.28,clearcoat:.7,clearcoatRoughness:.24});
 const trim=root.getObjectByName('helmet-crown-stripe').material;
 const dark=new THREE.MeshStandardMaterial({color:0x151e29,metalness:.12,roughness:.66});
 const add=(parent,name,g,m)=>{const mesh=new THREE.Mesh(g,m);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;};
 const sculpt=(mesh,fn)=>{
   const old=mesh.geometry,g=old.clone();delete g.userData.blenderShared;
   const source=old.attributes.position,positions=new Float32Array(source.count*3);
   for(let i=0;i<source.count;i++)positions.set(fn(source.getX(i),source.getY(i),source.getZ(i)),i*3);
   g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.deleteAttribute('normal');g.computeVertexNormals();g.computeBoundingSphere();mesh.geometry=g;
   if(!old.userData.blenderShared&&!Object.values(KART_GEO).includes(old))old.dispose();
 };
 // A single connected surface changes the upper-body envelope. Legs, hips and the
 // neck termination are held fixed to retain the original seated rig contract.
 const torso=root.getObjectByName('torso');
 sculpt(torso,(x,y,z)=>{const t=Math.sin(Math.PI*clamp((y-.27)/.98,0,1));return [x*(1+(profile.chest-1)*t),y,z*(1+.14*t)];});
 torso.material=paint;
 for(const arm of ud.arms){const sleeve=arm.getObjectByName(arm.name+'-mesh');if(sleeve)sleeve.material=paint;}
 // A continuous tapered neck seal overlaps the suit and helmet base. The former
 // exposed torus read as a separate spacer, making the helmet appear to float.
 const collar=pilot.getObjectByName('suit-raised-collar');
 if(collar){const old=collar.geometry;collar.geometry=bodyLoft([[1.045,.17,.14,.015],[1.105,.145,.125,.012],[1.19,.13,.115,.006],[1.265,.135,.12,0]],24);collar.position.set(0,0,0);collar.rotation.set(0,0,0);collar.scale.set(1,1,1);collar.material=dark;if(!old.userData.blenderShared&&!Object.values(KART_GEO).includes(old))old.dispose();}
 // Move every helmet fitting with the envelope, so visor, jaw and locks stay joined.
 for(const part of head.children){part.scale.x*=profile.width;part.scale.z*=profile.depth;part.position.x*=profile.width;part.position.z*=profile.depth;}
 const shell=head.getObjectByName('helmet-shell');shell.material=paint;
 // Broad jaws for defensive drivers, an elongated rear for sprint drivers, and
 // elevated crowns for sensor drivers alter silhouette even in neutral material.
 sculpt(shell,(x,y,z)=>{
   const rear=clamp(z,0,1),top=clamp(y,0,1);
   if(profile.family==='guard')return [x*(1+.10*(1-Math.abs(y))),y*.95,z];
   if(profile.family==='sprint')return [x,y*(1-.12*rear),z+rear*rear*.28];
   if(profile.family==='sensor')return [x*(1-.07*top),y+top*top*.13,z];
   if(profile.family==='tourer')return [x,y*.96,z+.08*rear];
   return [x,y,z+.10*rear*top];
 });
 // Close-fitting shoulder yoke. This is fitted equipment, not floating badges;
 // its lower surfaces overlap the suit and its cap follows each shoulder joint.
 for(const side of [-1,1]){
   const arm=ud.arms[side<0?0:1],cap=arm.getObjectByName('suit-shoulder-pad');
   if(cap){cap.scale.x*=1+profile.mantle;cap.scale.y*=1+profile.mantle*.65;cap.material=paint;}
   const w=.25+profile.mantle*.23;
   add(marker,'division-shoulder-yoke',limbSurface([[side*.10,1.04,.035],[side*w,1.015,.065],[side*(w+.09),.92,.075]],[.065,.075+profile.mantle*.10,.06]),paint);
   // Upper chest panels form an engineered suit front, with smooth tapered edges.
   add(marker,'division-chest-seam',limbSurface([[side*.075,1.00,-.17],[side*.20,.84,-.277],[side*.15,.56,-.255]],[.018,.025,.014]),trim);
 }
 const crown=new THREE.Group();crown.name='division-helmet-crown';head.add(crown);
 if(profile.family==='guard'){
   add(crown,'reinforced-brow',limbSurface([[-.22,.41,-.21],[0,.435,-.255],[.22,.41,-.21]],[.03,.045,.03]),trim);
 }else if(profile.family==='sensor'){
   for(const side of [-1,1])add(crown,'crown-sensor-rail',limbSurface([[side*.14,.46,.08],[side*.12,.57+profile.crown,.06],[side*.10,.52,.19]],[.034,.028,.032]),paint);
 }else if(profile.family==='sprint'){
   add(crown,'integrated-aero-keel',kartRibbon([[0,.51,.03],[0,.50,.22],[0,.35,.34+profile.crown]],.07,.024),paint);
 }else if(profile.family==='tourer'){
   add(crown,'touring-neck-roll',limbSurface([[-.20,.12,.05],[0,.10,.20],[.20,.12,.05]],[.054,.06,.054]),dark);
 }else{
   for(const side of [-1,1])add(crown,'stream-crown-channel',limbSurface([[side*.12,.47,-.11],[side*.12,.58,.06],[side*.10,.39,.26]],[.019,.025,.015]),trim);
 }
 batchKartBody(marker);batchKartBody(crown);
 ud.zf_rider_identity_baked=true;
}
function finishRiderFit(root){
 const fit=RIDER_FIT[root.userData.chassis];if(!fit||root.userData.riderFit)return;root.userData.riderFit=true;
 // Exported identity models already contain this fit, including visor transforms.
 if(root.getObjectByName('division-rider-identity'))return;
 const scale=new THREE.Vector3(fit[0],fit[1],fit[2]);
 for(const child of root.userData.head.children){child.scale.multiply(scale);child.position.multiply(scale);}
 root.traverse(o=>{if(o.name==='suit-shoulder-pad')o.scale.x*=fit[3];});
 finishRiderIdentity(root);
}
// Runtime finishing pass over the shipped rig. Only sculpted surfaces own new
// vertex buffers; unchanged wheel geometry remains shared by the GLB cache.
function refineRacingEquipment(root){
  const ud=root.userData;if(ud.racingEquipment)return;
  // Rehydrate animation handles from baked GLBs instead of adding another copy
  // of the finishing geometry or deforming the already authored suit twice.
  const bakedVents=root.getObjectByName('active-cooling-vanes');
  if(bakedVents&&root.getObjectByName('division-rider-identity')){
    ud.racingEquipment={wheelHardware:ud.wheels.map(w=>w.spin.getObjectByName('brake-and-spoke-hardware')).filter(Boolean),vents:bakedVents,restY:bakedVents.position.y};
    return;
  }
  const index=Math.max(0,ROSTER.findIndex(d=>d.id===ud.chassis));
  const trim=root.getObjectByName('helmet-crown-stripe').material;
  const rubber=new THREE.MeshStandardMaterial({color:0x151a20,roughness:.86,metalness:.02});
  const alloy=new THREE.MeshStandardMaterial({color:0x8b949e,roughness:.32,metalness:.85});
  const sculpt=(mesh,edit)=>{
    if(!mesh)return;
    const source=mesh.geometry,g=source.clone();delete g.userData.blenderShared;
    const attr=source.attributes.position,values=new Float32Array(attr.count*3);
    for(let i=0;i<attr.count;i++)values.set(edit(attr.getX(i),attr.getY(i),attr.getZ(i)),i*3);
    g.setAttribute('position',new THREE.BufferAttribute(values,3));g.deleteAttribute('normal');g.computeVertexNormals();g.computeBoundingSphere();
    mesh.geometry=g;
    if(!source.userData.blenderShared&&!Object.values(KART_GEO).includes(source))source.dispose();
  };
  // Flatten the helmet's cheeks and rear crown without changing neck articulation.
  sculpt(root.getObjectByName('helmet-shell'),(x,y,z)=>[x*(1-.055*Math.max(0,-z)),y,z*(1-.04*Math.max(0,-y))]);
  // Broaden the upper suit while preserving the hips, legs and shoulder pivots.
  sculpt(root.getObjectByName('torso'),(x,y,z)=>{
    const t=clamp((y-.35)/.40,0,1);return [x*(1+.10*t),y,z*(1+.12*t)];
  });
  const collar=root.getObjectByName('suit-raised-collar');
  if(collar&&!root.getObjectByName('division-rider-identity')){const old=collar.geometry;collar.geometry=new THREE.TorusGeometry(.135,.06,10,32);collar.position.set(0,1.235,0);collar.rotation.set(Math.PI/2,0,0);collar.scale.set(1,1,1);collar.material=rubber;if(!old.userData.blenderShared&&!Object.values(KART_GEO).includes(old))old.dispose();}
  const add=(parent,name,g,m,x=0,y=0,z=0)=>{const o=new THREE.Mesh(g,m);o.name=name;o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;};
  const suit=new THREE.Group();suit.name='tailored-suit-inserts';ud.pilot.add(suit);
  for(const side of [-1,1]){
    add(suit,'chest-insert',limbSurface([[side*.07,.95,-.19],[side*.14,.85,-.26],[side*.13,.65,-.24]],[.025,.045,.025]),trim);
    for(let i=0;i<3;i++)add(suit,'chest-vent',limbSurface([[side*.26,.76-i*.055,-.18],[side*.31,.74-i*.055,-.14]],[.012,.012]),rubber);
  }
  batchKartBody(suit);
  const wheelHardware=[];
  for(const w of ud.wheels){
    for(const name of ['rounded-wheel-shell','translucent-tire-band']){const shell=w.spin.getObjectByName(name);if(shell)shell.material=rubber;}
    const hardware=new THREE.Group();hardware.name='brake-and-spoke-hardware';w.spin.add(hardware);
    const rotor=new THREE.CylinderGeometry(.275,.275,.025,32);rotor.rotateZ(Math.PI/2);
    add(hardware,'ventilated-brake-rotor',rotor,alloy,w.side*.258);
    for(let j=0;j<6;j++){
      const a=j/6*Math.PI*2,indexed=a+.10*(index%3);
      const spoke=new THREE.BoxGeometry(.027,.045,.21);spoke.translate(0,0,.155);spoke.rotateX(indexed);spoke.translate(w.side*.282,0,0);
      add(hardware,'forged-wheel-spoke',spoke,alloy);
    }
    batchKartBody(hardware);hardware.children.forEach(o=>o.name='brake-rotor-and-spokes');wheelHardware.push(hardware);
    add(w.pivot,'brake-caliper',new THREE.BoxGeometry(.085,.22,.11),trim,w.side*.265,.16,.15);
  }
  const vents=new THREE.Group();vents.name='active-cooling-vanes';ud.body.add(vents);
  for(const side of [-1,1])for(let i=0;i<3;i++){
    const vane=add(vents,'cooling-vane',new THREE.BoxGeometry(.20,.025,.11),alloy,side*.70,.94,.82+i*.145);vane.rotation.z=side*.12;
  }
  // Material batches keep this finishing pass within a small draw-call budget.
  batchKartBody(vents);
  ud.racingEquipment={wheelHardware,vents,restY:vents.position.y};
}

function finishKartCockpit(root){
  const ud=root.userData;if(ud.cockpitFinished)return;ud.cockpitFinished=true;refineRacingEquipment(root);finishRiderFit(root);
  if(!root.getObjectByName('cockpit-contact-hardware')){
  const fabric=new THREE.MeshStandardMaterial({color:0x192029,roughness:.91,metalness:0});
  const trim=new THREE.MeshStandardMaterial({color:0x434b54,roughness:.34,metalness:.7});
  const cockpit=new THREE.Group();cockpit.name='cockpit-contact-hardware';ud.body.add(cockpit);
  const add=(name,g,m,x,y,z)=>{const o=new THREE.Mesh(g,m);o.name=name;o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;cockpit.add(o);return o;};
  const cushion=add('seat-cushion',new THREE.SphereGeometry(1,20,12),fabric,0,.96,.40);cushion.scale.set(.37,.095,.39);
  const back=add('seat-back-shell',new THREE.SphereGeometry(1,20,12),fabric,0,1.47,.67);back.scale.set(.41,.58,.105);back.rotation.x=-.12;
  for(const side of[-1,1]){
    const bolster=add('seat-side-bolster',new THREE.SphereGeometry(1,16,10),fabric,side*.36,1.23,.50);bolster.scale.set(.07,.28,.25);
    const pedal=add('pedal-plate',new THREE.BoxGeometry(.19,.025,.24),trim,side*.245,.41,-.65);pedal.rotation.x=-.28;
  }
  // All six static pieces share two material batches: two draws per racer.
  batchKartBody(cockpit);
  for(const mesh of cockpit.children)mesh.name=mesh.material===fabric?'seat-back-shell':'pedal-plate';
  }
  // Shipping GLBs do not carry the procedural fallback's shadow footprint.
  // Share its texture so tyres remain grounded on low-shadow mobile presets too.
  if(typeof TEX!=='undefined'&&TEX.contactShadow&&!root.getObjectByName('contact-shadow')){
    if(!KART_GEO.contactFootprint)KART_GEO.contactFootprint=new THREE.PlaneGeometry(3.9,5.4);
    const contact=new THREE.Mesh(KART_GEO.contactFootprint,new THREE.MeshBasicMaterial({map:TEX.contactShadow,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));
    contact.name='contact-shadow';contact.rotation.x=-Math.PI/2;contact.position.y=.035;root.add(contact);
  }
  prepareKartContactRig(root);
}

// ---------- Kart rig animation ----------
function animateRacingEquipment(ud,time,boost=0){
  const gear=ud.racingEquipment;if(!gear)return;
  gear.vents.rotation.x=Math.sin(time*1.4)*.012+Math.min(1,Math.max(0,boost))*.08;
}

// Procedural suspension/body/pilot motion, layered with additive Blender clips from KART_CLIPS.
// Everything here is allocation-free per call and runs both in the browser and under the
// headless test stubs (only Vector3-like {x,y,z} transforms and plain math are required).
const KART_STATES=['idle','drive','drift','boost','spinout','hit','victory','defeat'];
const KART_SHOWROOM_CAMERA=[5.5,2.9,-7.3];
const ease=(cur,target,dt,rate)=>cur+(target-cur)*(1-Math.exp(-dt*rate));
function kartHash(n){n=Math.imul(n|0,374761393);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295*2-1;}
// Smooth road profile per wheel: value noise over travelled metres (period ~.7 m).
function roadNoise(metres,seed){const x=metres/.7,i=Math.floor(x),f=x-i,s=f*f*(3-2*f);return lerp(kartHash(i+seed*7919),kartHash(i+1+seed*7919),s);}
function kartAnimState(ud){
  if(ud.anim)return ud.anim;
  const weights={},times={};for(const s of KART_STATES){weights[s]=0;times[s]=0;}
  ud.clipState={weights,times,active:'idle'};
  return ud.anim={t:Math.max(0,ROSTER.findIndex(d=>d.id===ud.chassis))*.37,prevSpeed:0,accel:0,lat:0,sway:0,wheel:0,heave:0,heaveV:0,roll:0,pitch:0,stretch:0,flinch:0,hopPrev:0,hitPrev:0,overspin:0,headYaw:0,headPitch:0,look:0,susp:[0,0,0,0],suspV:[0,0,0,0],fold:[0,0,0,0]};
}
// Resolve clip target nodes by name once per kart and remember their rest transforms.
function resolveKartRig(root){
  const ud=root.userData,nodes={},rest=ud.clipRest||[];// rest poses recorded once; a re-resolve mid-animation never bakes a pose
  if(typeof root.traverse==='function')root.traverse(o=>{if(o.name&&!nodes[o.name])nodes[o.name]=o;});
  const clips=typeof KART_CLIPS!=='undefined'&&KART_CLIPS&&KART_CLIPS.clips||{};
  for(const name in clips)for(const target in clips[name].tracks||{}){const node=nodes[target];if(!node||rest.some(r=>r.node===node))continue;
    const p=node.position,r=node.rotation,s=node.scale;rest.push({node,p:[p.x,p.y,p.z],r:[r.x,r.y,r.z],s:[s.x,s.y,s.z]});}
  ud.clipNodes=nodes;ud.clipRest=rest;kartAnimState(ud);return nodes;
}
function resetClipNodes(ud){
  const rest=ud.clipRest;if(!rest)return;
  for(let i=0;i<rest.length;i++){const {node,p,r,s}=rest[i];node.position.set(p[0],p[1],p[2]);node.rotation.set(r[0],r[1],r[2]);node.scale.set(s[0],s[1],s[2]);}
}
// Linear key interpolation: keys are [[t,x,y,z],...] sorted by t; the value is added (weighted) to target.
function clipAdd(keys,t,w,target){
  const n=keys.length;if(!n)return;
  let x,y,z;
  if(n===1||t<=keys[0][0]){const k0=keys[0];x=k0[1];y=k0[2];z=k0[3];}
  else if(t>=keys[n-1][0]){const kn=keys[n-1];x=kn[1];y=kn[2];z=kn[3];}
  else{let lo=0,hi=n-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(keys[mid][0]<=t)lo=mid;else hi=mid;}
    const a=keys[lo],b=keys[hi],f=(t-a[0])/Math.max(1e-6,b[0]-a[0]);x=a[1]+(b[1]-a[1])*f;y=a[2]+(b[2]-a[2])*f;z=a[3]+(b[3]-a[3])*f;}
  target.x+=x*w;target.y+=y*w;target.z+=z*w;
}
// Evaluate one KART_CLIPS clip at `time` and apply it additively (scaled by weight) to the rig.
// Clip shape: {duration,loop,tracks:{nodeName:{position:[[t,x,y,z]..],rotation:[[t,x,y,z]..],scale:[[t,x,y,z]..]}}}
// where every value is a delta from rest (Euler XYZ radians; scale delta added to 1). Unknown nodes are ignored.
function sampleKartClip(clipName,time,weight,ud){
  const clips=typeof KART_CLIPS!=='undefined'&&KART_CLIPS&&KART_CLIPS.clips;const clip=clips&&clips[clipName];
  if(!clip||!(weight>1e-4)||!clip.tracks)return false;
  const nodes=ud.clipNodes||{};const dur=clip.duration||0;
  let t=time;if(dur>0)t=clip.loop===false?Math.min(t,dur):((t%dur)+dur)%dur;
  const names=clip.trackNames||(clip.trackNames=Object.keys(clip.tracks));
  for(let i=0;i<names.length;i++){const node=nodes[names[i]];if(!node)continue;const tr=clip.tracks[names[i]];
    if(tr.position)clipAdd(tr.position,t,weight,node.position);if(tr.rotation)clipAdd(tr.rotation,t,weight,node.rotation);if(tr.scale)clipAdd(tr.scale,t,weight,node.scale);}
  return true;
}
// Crossfade state weights (~.15 s) and layer every active clip on top of the procedural pose.
function applyKartClips(ud,target,dt){
  const cs=ud.clipState,k=1-Math.exp(-Math.max(0,dt)/.09);cs.active=target;
  for(let i=0;i<KART_STATES.length;i++){const s=KART_STATES[i],on=s===target?1:0,w=cs.weights[s];
    if(on&&w<=0)cs.times[s]=0;const nw=w+(on-w)*k;cs.weights[s]=nw<1e-3&&!on?0:nw;if(cs.weights[s]>0){cs.times[s]+=dt;sampleKartClip(s,cs.times[s],cs.weights[s],ud);}}
}
function kartWheelSprings(ud,a,dt,metres,speed,lat,accelN,rearSquat,frontDive,kick){
  const h=Math.min(dt,.033),k=640,c=2*Math.sqrt(k),sf=clamp(speed/18,0,1);
  for(let i=0;i<4;i++){const w=ud.wheels[i];if(!w)continue;const side=w.side,rear=i>=2;
    const bump=roadNoise(metres+i*.41,i)*.035*sf,tuck=Math.max(0,-lat*side)*.025,squat=rear?Math.max(0,accelN)*.03+rearSquat:Math.max(0,-accelN)*.03+frontDive;
    const target=bump+tuck+squat;let v=a.suspV[i]+kick,x=a.susp[i];
    v+=(k*(target-x)-c*v)*h;x+=v*h;x=clamp(x,-.06,.08);a.suspV[i]=v;a.susp[i]=x;
    const rest=w.rest;w.pivot.position.y=(rest?rest.y:.6)+x;}
}
// Body group orbits a pivot at cockpit height (h) instead of the ground contact so roll and pitch read as sprung mass motion.
function kartBodyPose(body,pitch,yaw,roll,heave,stretch){
  const h=.55,sa=Math.sin(pitch),ca=Math.cos(pitch),sb=Math.sin(yaw),cb=Math.cos(yaw),sc=Math.sin(roll),cc=Math.cos(roll);
  body.rotation.set(pitch,yaw,roll);
  body.position.set(h*sc*cb,h-h*(cc*ca-sc*sb*sa)+heave,-h*(cc*sa+sc*sb*ca));
  body.scale.set(1-stretch*.01,1-stretch*.02,1+stretch*.03);
}
function animateKart(r,dt,ag=0){
  const ud=r.mesh.userData,a=kartAnimState(ud);if(!ud.clipNodes)resolveKartRig(r.mesh);a.t+=dt;
  resetClipNodes(ud); // clip-targeted nodes back to rest before procedural motion, so additive layers never accumulate
  const speed=r.speed,drift=r.drifting?r.driftDir||0:0,spinning=r.spin>0,wheelspin=r.wheelspin>0,boosting=r.boost>0,braking=!!r.brake&&speed>1;
  const finished=!!r.finished,victory=finished&&r.rank===1,defeat=finished&&!victory,hitting=r.hitCd>0&&!spinning;
  // --- root: track placement, drift yaw, hop (unchanged presentation contract)
  r.wheelRot+=speed*dt/.61;
  const spinYaw=spinning?(1-r.spin/1.1)*Math.PI*4:0;
  const driftYaw=r.drifting?r.driftDir*.55+r.steer*.15:r.steer*.12;
  r.visualYaw=lerp(r.visualYaw,driftYaw,1-Math.exp(-dt*8));
  if(r.hop>0)r.hop-=dt;const hopH=r.hop>0?Math.sin((r.hop/.28)*Math.PI)*.5:0;
  orientOnTrack(r.mesh,r.u,r.lat,0.02+hopH,r.visualYaw+spinYaw+r.theta*.6);
  // --- loads: lateral from steer/drift, longitudinal from the speed delta
  const sf=clamp(Math.abs(speed)/22,0,1);
  const rawAccel=dt>1e-6?clamp((speed-a.prevSpeed)/dt,-40,40):0;a.prevSpeed=speed;a.accel=ease(a.accel,rawAccel,dt,6);
  const accelN=clamp(a.accel/22,-1,1);
  a.lat=ease(a.lat,clamp(r.steer*sf+drift*.75,-1.6,1.6),dt,7);r.lean=-a.lat*.07;
  // --- events: hop landing, hit start
  let kick=0;if(a.hopPrev>0&&r.hop<=0){kick+=1.4;a.heaveV-=.9;}if(a.hitPrev<=0&&r.hitCd>0){kick+=1.1;a.heaveV-=.7;a.flinch=1;}
  a.hopPrev=r.hop;a.hitPrev=r.hitCd;a.flinch*=Math.exp(-dt*5);
  // --- suspension (per-wheel critically damped springs + sprung-mass heave spring)
  const metres=(r.distance!==undefined?r.distance:r.u)*(typeof track!=='undefined'?track.len:1000);
  kartWheelSprings(ud,a,dt,metres,speed,a.lat,accelN,(wheelspin?.03:0)+(boosting?.015:0),braking?.02:0,kick);
  {const h=Math.min(dt,.033);a.heaveV+=(-420*a.heave-41*a.heaveV)*h;a.heave+=a.heaveV*h;a.heave=clamp(a.heave,-.12,.08);}
  // --- body: roll/pitch/sway/stretch
  const idle=Math.abs(speed)<1&&!boosting;
  const wobble=spinning?Math.sin(a.t*18)*.045*Math.min(1,r.spin):0,shudder=wheelspin?Math.sin(a.t*52)*.012:0;
  a.roll=ease(a.roll,a.lat*.06,dt,8);a.pitch=ease(a.pitch,accelN*.035+(boosting?.025:0)+(wheelspin?.035:0)-(braking?.03:0)-a.flinch*.03,dt,8);
  a.sway=ease(a.sway,drift?Math.sin(a.t*2.7)*.03*drift:0,dt,5);a.stretch=ease(a.stretch,boosting?1:0,dt,6);
  const heave=a.heave+(idle?Math.sin(a.t*1.7)*.006:0)+(wheelspin?Math.sin(a.t*47)*.006:0)+(spinning?Math.sin(a.t*13)*.02:0);
  kartBodyPose(ud.body,a.pitch+(spinning?Math.cos(a.t*11)*.03:0),a.sway,a.roll+wobble+shudder,heave,a.stretch);
  // --- wheels: spin, steer, anti-grav fold, glow
  a.overspin=wheelspin?a.overspin+dt*38:a.overspin*Math.exp(-dt*4);
  for(let i=0;i<4;i++){const w=ud.wheels[i];if(!w)continue;
    w.spin.rotation.x=r.wheelRot+(i>=2?a.overspin:0);w.pivot.rotation.y=i<2?Math.atan2(2.53*r.steer,6.65-w.side*r.steer*1.23):0;
    a.fold[i]=ease(a.fold[i],w.side*ag*Math.PI/2,dt,5);w.pivot.rotation.z=a.fold[i];
    w.glow.material.emissiveIntensity=.65+ag*1.0;w.glow.material.opacity=1;}
  ud.under.material.emissiveIntensity=ag*2.4;
  // --- exhausts, halo/star, shield
  const pulse=boosting?1+.12*Math.sin(a.t*38)+.08:1;
  for(let i=0;i<ud.exhaust.length;i++){const e=ud.exhaust[i];e.material.emissiveIntensity=boosting?2.4:r.throttle?1.1:.4;e.scale.set(pulse,pulse,1);}
  ud.halo.rotation.y+=dt*2.5;ud.star.rotation.y+=dt*1.5;ud.shield.visible=r.shield>0;if(r.shield>0){const s=1+Math.sin(a.t*9)*.04;ud.shield.scale.set(s,s,s);ud.shield.rotation.y+=dt;}
  // --- steering wheel and arms
  a.wheel=ease(a.wheel,spinning?Math.sin(a.t*21)*.6:-r.steer*1.1,dt,12);
  const sw=ud.steeringWheel;if(sw){sw.rotation.z=a.wheel;}
  // --- pilot: counter-lean, look into slides, brake/boost head pitch, state poses
  const pilot=ud.pilot,head=ud.head,armL=ud.arms&&ud.arms[0],armR=ud.arms&&ud.arms[1];
  const breathe=Math.sin(a.t*1.5)*(idle?.012:.005);
  let torsoX=(boosting?-.12:0)+(braking?-.09:0)+accelN*.04-a.flinch*.25,torsoY=-drift*.25-r.steer*.08*sf,torsoZ=-a.roll*1.6-a.lat*.08,pilotY=1+breathe-Math.max(0,accelN)*.018;
  let lookY=-r.steer*.35*Math.max(.35,sf)-drift*.3,lookX=braking?-.18:boosting?.2:accelN*.06+breathe*.5;
  let aL=-a.wheel*.28,aR=a.wheel*.28,zL=0,zR=0;
  if(spinning){const f=Math.min(1,r.spin);aL=1.3+Math.sin(a.t*16)*.5*f;aR=1.3+Math.cos(a.t*15)*.5*f;zL=.5*f;zR=-.5*f;lookY=Math.sin(a.t*24)*.35*f;lookX=Math.cos(a.t*19)*.2*f;torsoZ+=Math.sin(a.t*14)*.12*f;}
  else if(victory){const bounce=Math.abs(Math.sin(a.t*5));pilotY=1+bounce*.05;aR=1.55+Math.sin(a.t*6)*.45;aL=.35;zR=-.25;lookX=.3;lookY=Math.sin(a.t*2)*.2;torsoX=-.05+bounce*.04;}
  else if(defeat){torsoX=-.2;lookX=-.4;aL=-.25;aR=-.25;lookY=Math.sin(a.t*.8)*.12;}
  else if(hitting){lookY+=Math.sin(a.t*30)*.15*a.flinch;}
  a.headYaw=ease(a.headYaw,clamp(lookY,-.7,.7),dt,10);a.headPitch=ease(a.headPitch,clamp(lookX,-.5,.5),dt,10);
  pilot.rotation.set(torsoX,torsoY,torsoZ);pilot.position.y=pilotY;
  if(head)head.rotation.set(a.headPitch,a.headYaw,-a.roll*.5);
  if(armL)armL.rotation.set(aL,0,zL);if(armR)armR.rotation.set(aR,0,zR);
  // --- state clips (additive, crossfaded)
  const state=victory?'victory':defeat?'defeat':spinning?'spinout':hitting?'hit':boosting?'boost':r.drifting?'drift':idle?'idle':'drive';
  applyKartClips(ud,state,dt);
  animateRacingEquipment(ud,a.t,boosting?1:0);
  if(typeof animateKartBuildVisuals==='function')animateKartBuildVisuals(r.mesh,a.t,{speed:r.speed});
  if(typeof constrainKartHands==='function')constrainKartHands(r.mesh,state);
}
// Turntable presentation: heave, settling suspension, breathing pilot who follows the showroom camera.
function animateShowroomKart(kart,time,dt,yaw){
  const ud=kart.userData;if(!ud||!ud.wheels)return;
  const a=kartAnimState(ud);if(!ud.clipNodes)resolveKartRig(kart);
  if(!a.settled){a.settled=true;for(let i=0;i<4;i++)a.suspV[i]=1.6;a.heaveV=-.8;}
  if(yaw!==undefined)kart.rotation.y=yaw;kart.position.y=.02;resetClipNodes(ud);
  kartWheelSprings(ud,a,dt,0,0,0,0,0,0,0);
  {const h=Math.min(dt,.033);a.heaveV+=(-420*a.heave-41*a.heaveV)*h;a.heave+=a.heaveV*h;}
  kartBodyPose(ud.body,Math.sin(time*.9)*.004,0,Math.sin(time*1.3)*.005,a.heave,0);
  for(let i=0;i<4;i++){const w=ud.wheels[i];w.glow.material.emissiveIntensity=1.2+Math.sin(time*3)*.4;w.glow.material.opacity=1;w.pivot.rotation.y=0;w.pivot.rotation.z=0;}
  ud.under.material.emissiveIntensity=.9;
  for(let i=0;i<ud.exhaust.length;i++){const e=ud.exhaust[i],s=1+Math.sin(time*2.4+i)*.04;e.material.emissiveIntensity=1.6+Math.sin(time*2.4+i)*.3;e.scale.set(s,s,1);}
  // Head turns toward the fixed showroom camera expressed in kart-local space (pilot faces -z).
  const ky=kart.rotation.y,cx=KART_SHOWROOM_CAMERA[0],cz=KART_SHOWROOM_CAMERA[2],lx=cx*Math.cos(ky)-cz*Math.sin(ky),lz=cx*Math.sin(ky)+cz*Math.cos(ky);
  a.look=ease(a.look,clamp(Math.atan2(-lx,-lz),-.85,.85),dt,2.5);
  const breathe=Math.sin(time*1.5)*.012;
  a.wheel=ease(a.wheel,Math.sin(time*.9)*.07,dt,6);if(ud.steeringWheel)ud.steeringWheel.rotation.z=a.wheel;
  ud.pilot.rotation.set(breathe*.4,0,0);ud.pilot.position.y=1+breathe;
  if(ud.head)ud.head.rotation.set(Math.sin(time*.7)*.04+breathe*.5,a.look,0);
  if(ud.arms){ud.arms[0].rotation.set(-a.wheel*.28,0,0);ud.arms[1].rotation.set(a.wheel*.28,0,0);}
  ud.halo.rotation.y+=dt*2.5;ud.star.rotation.y+=dt*1.5;
  applyKartClips(ud,'idle',dt);
  animateRacingEquipment(ud,time,0);
  if(typeof animateKartBuildVisuals==='function')animateKartBuildVisuals(kart,time,{speed:0});
  if(typeof constrainKartHands==='function')constrainKartHands(kart,'idle');
}

// ---------- Item / token pickups ----------
const ITEMS={
  burst:{name:'Signal Burst',color:'#F43F5E',desc:'Speed boost'},
  shield:{name:'Aegis Shield',color:'#00D9B5',desc:'Blocks one hit'},
  mine:{name:'Loom Mine',color:'#A3E635',desc:'Drop behind'},
  missile:{name:'Vector Missile',color:'#CBD5E1',desc:'Homing forward'},
  pulse:{name:'Overseer Pulse',color:'#D4A843',desc:'Spins everyone ahead'},
  triple:{name:'Node Cluster',color:'#7C3AED',desc:'Three bursts'},
};
function itemIconSVG(key){
  const c=ITEMS[key].color;
  switch(key){
    case 'burst':return `<svg viewBox="0 0 64 64"><path d="M14 34h22l-6 16 22-24H30l6-16z" fill="${c}"/></svg>`;
    case 'shield':return `<svg viewBox="0 0 64 64"><path d="M32 8l20 8v16c0 12-8 20-20 24-12-4-20-12-20-24V16z" fill="none" stroke="${c}" stroke-width="5"/><circle cx="32" cy="30" r="5" fill="${c}"/></svg>`;
    case 'mine':return `<svg viewBox="0 0 64 64"><polygon points="32,6 55,19 55,45 32,58 9,45 9,19" fill="none" stroke="${c}" stroke-width="5"/><circle cx="32" cy="32" r="7" fill="${c}"/></svg>`;
    case 'missile':return `<svg viewBox="0 0 64 64"><path d="M10 34c10-12 24-18 44-18l-8 10 8 10c-20 0-34-6-44-18z" fill="${c}" transform="rotate(0 32 32)"/><path d="M30 16l6-10 4 10M30 48l6 10 4-10" fill="${c}"/></svg>`;
    case 'pulse':return `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="7" fill="${c}"/><circle cx="32" cy="32" r="16" fill="none" stroke="${c}" stroke-width="3"/><circle cx="32" cy="32" r="25" fill="none" stroke="${c}" stroke-width="3" opacity=".6"/></svg>`;
    case 'triple':return `<svg viewBox="0 0 64 64"><g fill="${c}"><path d="M8 30h12l-4 10 14-16H18l4-10z"/><path d="M24 30h12l-4 10 14-16H34l4-10z"/><path d="M40 30h12l-4 10 14-16H50l4-10z"/></g></svg>`;
  }
}
let itemBoxes=[],tokens=[],mines=[],missiles=[];
const pickupGroup=new THREE.Group();scene.add(pickupGroup);
function buildPickups(){
  const boxG=new THREE.BoxGeometry(1.45,1.45,.32);const boxMat=new THREE.MeshPhysicalMaterial({color:0x66e8ff,metalness:.25,roughness:.1,emissive:0x00bfff,emissiveIntensity:.25,transparent:true,opacity:.72,depthWrite:false,clearcoat:1});
  const coreG=starGeo(.44,.38);const coreMat=new THREE.MeshStandardMaterial({color:0xc4ffff,emissive:0x39dcff,emissiveIntensity:1.1});
  const rows=[0.11,0.30,0.47,0.64,0.80,0.93];
  rows.forEach(u=>{[-5,-1.7,1.7,5].forEach(lat=>{const g=new THREE.Group();const m=new THREE.Mesh(boxG,boxMat);m.castShadow=true;g.add(m);const cc=new THREE.Mesh(coreG,coreMat);g.add(cc);pickupGroup.add(g);itemBoxes.push({u,lat,mesh:g,star:m,core:cc,t:0});});});
  // tokens: round gold coins in arcs
  const tokG=new THREE.CylinderGeometry(.5,.5,.12,32);tokG.rotateX(Math.PI/2);const tokMat=new THREE.MeshPhysicalMaterial({color:0xd4a843,metalness:.9,roughness:.2,emissive:0xd4a843,emissiveIntensity:.35,clearcoat:.8});
  const embG=starGeo(.24,.06);const embMat=new THREE.MeshStandardMaterial({color:0x2a1a04,roughness:.5,metalness:.4});
  const arcs=[[0.06,-3,1],[0.2,3,-1],[0.38,-4,.5],[0.55,0,0],[0.72,4,-.5],[0.86,-2,1]];
  arcs.forEach(([u0,lat0,dir])=>{for(let k=0;k<6;k++){const u=u0+k*0.0045,lat=lat0+Math.sin(k*.9)*dir*2.2;const g=new THREE.Group();g.add(new THREE.Mesh(tokG,tokMat));const e=new THREE.Mesh(embG,embMat);e.position.z=.07;g.add(e);const e2=e.clone();e2.position.z=-.07;g.add(e2);pickupGroup.add(g);tokens.push({u,lat,mesh:g,t:0});}});
}
const _p=new THREE.Vector3(),_q=new THREE.Quaternion(),_m=new THREE.Matrix4();
function orientOnTrack(obj,u,lat,h,yaw=0){trackPoint(u,lat,h,obj.position);trackTan(u,_v1);trackUp(u,_v2);trackRight(u,_v3);
  if(yaw){_v1.applyAxisAngle(_v2,yaw);_v3.crossVectors(_v1,_v2);}
  _p.copy(_v1).negate();_m.makeBasis(_v3,_v2,_p);obj.quaternion.setFromRotationMatrix(_m);}

// ---------- Particles (sparks, boost trail, token bursts) ----------
class ParticlePool{
  constructor(n,color,size,additive=true){this.n=n;this.pos=new Float32Array(n*3);this.vel=new Float32Array(n*3);this.life=new Float32Array(n);this.maxl=new Float32Array(n);this.head=0;
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(this.pos,3));this.alpha=new Float32Array(n);g.setAttribute('alpha',new THREE.BufferAttribute(this.alpha,1));
    const m=new THREE.PointsMaterial({size,map:TEX.spark,color,transparent:true,depthWrite:false,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,sizeAttenuation:true});
    m.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float alpha;varying float vA;').replace('#include <fog_vertex>','#include <fog_vertex>\nvA=alpha;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying float vA;').replace('vec4 diffuseColor = vec4( diffuse, opacity );','vec4 diffuseColor = vec4( diffuse, opacity*vA );');};
    this.mesh=new THREE.Points(g,m);this.mesh.frustumCulled=false;scene.add(this.mesh);this.gravity=0;this.color=m;
  }
  emit(p,v,life,spread=0){const i=this.head;this.head=(i+1)%this.n;this.pos[i*3]=p.x+(rng()-.5)*spread;this.pos[i*3+1]=p.y+(rng()-.5)*spread;this.pos[i*3+2]=p.z+(rng()-.5)*spread;this.vel[i*3]=v.x;this.vel[i*3+1]=v.y;this.vel[i*3+2]=v.z;this.life[i]=Math.max(.001,life);this.maxl[i]=this.life[i];this.alpha[i]=1;}
  clear(){this.life.fill(0);this.alpha.fill(0);this.mesh.geometry.attributes.alpha.needsUpdate=true;}
  update(dt){let active=false;for(let i=0;i<this.n;i++){if(this.life[i]<=0){this.alpha[i]=0;continue;}active=true;this.life[i]-=dt;this.vel[i*3+1]+=this.gravity*dt;this.pos[i*3]+=this.vel[i*3]*dt;this.pos[i*3+1]+=this.vel[i*3+1]*dt;this.pos[i*3+2]+=this.vel[i*3+2]*dt;this.alpha[i]=clamp(this.life[i]/this.maxl[i],0,1);}
    this.mesh.visible=active;this.mesh.geometry.attributes.position.needsUpdate=active;this.mesh.geometry.attributes.alpha.needsUpdate=true;}
}
let sparksBlue,sparksOrange,sparksPink,boostFx,goldFx,smokeFx,hitFx;
function buildParticles(){sparksBlue=new ParticlePool(600,0x66aaff,1.1);sparksOrange=new ParticlePool(600,0xffa040,1.25);sparksPink=new ParticlePool(600,0xff5fd0,1.5);boostFx=new ParticlePool(900,0x00d9b5,2.2);goldFx=new ParticlePool(300,0xffd77a,1.6);smokeFx=new ParticlePool(500,0x7a8090,2.4,false);hitFx=new ParticlePool(300,0xff5a3a,2);sparksBlue.gravity=sparksOrange.gravity=sparksPink.gravity=-14;goldFx.gravity=-8;smokeFx.gravity=1.5;smokeFx.color.opacity=.35;}

// ---------- Procedural audio (Web Audio) ----------
const AUDIO={ctx:null,on:true,master:null,voices:0,failed:false};
function audioInit(){
  if(AUDIO.failed)return;
  if(AUDIO.ctx){if(['suspended','interrupted'].includes(AUDIO.ctx.state))AUDIO.ctx.resume().catch(()=>{});return;}
  const AudioCtor=window.AudioContext||window.webkitAudioContext;if(!AudioCtor){AUDIO.failed=true;return;}
  let C;
  try{
    C=new AudioCtor();
    const master=C.createGain();master.gain.value=AUDIO.on?.42:0;
    // A safety limiter keeps stacked pickups, engine and collisions comfortable.
    const limiter=C.createDynamicsCompressor();limiter.threshold.value=-12;limiter.knee.value=12;limiter.ratio.value=6;limiter.attack.value=.003;limiter.release.value=.18;
    master.connect(limiter);limiter.connect(C.destination);
    const eng=C.createGain();eng.gain.value=0;eng.connect(master);
    const lp=C.createBiquadFilter();lp.type='lowpass';lp.frequency.value=900;lp.Q.value=.75;lp.connect(eng);
    const mk=(type,det)=>{const o=C.createOscillator();o.type=type;o.detune.value=det;o.connect(lp);o.start();return o;};
    const osc=[mk('sawtooth',0),mk('sawtooth',-9),mk('sine',0)];
    const buf=C.createBuffer(1,Math.floor(C.sampleRate*2),C.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    const noise=(type,frequency,volume,rate=1)=>{
      const source=C.createBufferSource();source.buffer=buf;source.loop=true;source.playbackRate.value=rate;
      const filter=C.createBiquadFilter();filter.type=type;filter.frequency.value=frequency;filter.Q.value=.7;
      const gain=C.createGain();gain.gain.value=volume;source.connect(filter);filter.connect(gain);gain.connect(master);source.start();return {gain,filter};
    };
    const drift=noise('bandpass',1800,0),wind=noise('lowpass',400,0);
    noise('bandpass',600,.015,.5);
    Object.assign(AUDIO,{ctx:C,master,osc,engGain:eng,lp,noiseGain:drift.gain,noiseBP:drift.filter,windGain:wind.gain});
    if(C.state==='suspended')C.resume().catch(()=>{});
  }catch(error){if(C)C.close().catch(()=>{});AUDIO.ctx=null;AUDIO.failed=true;}
}
function audioAllowed(){return AUDIO.ctx&&AUDIO.ctx.state!=='closed'&&AUDIO.on&&!document.hidden&&game.state!=='paused'&&AUDIO.voices<32;}
function tone(f,dur,type='sine',vol=.25,slide=0,delay=0){
  if(!audioAllowed())return;
  const C=AUDIO.ctx,o=C.createOscillator(),g=C.createGain(),start=C.currentTime+Math.max(0,delay);dur=Math.max(.03,dur);
  o.type=type;o.frequency.setValueAtTime(Math.max(20,f),start);
  if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,f+slide),start+dur);
  g.gain.setValueAtTime(0,start);g.gain.linearRampToValueAtTime(vol,start+.012);g.gain.exponentialRampToValueAtTime(.0001,start+dur);
  o.connect(g);g.connect(AUDIO.master);AUDIO.voices++;
  o.onended=()=>{o.disconnect();g.disconnect();AUDIO.voices=Math.max(0,AUDIO.voices-1);};
  o.start(start);o.stop(start+dur+.03);
}
function noiseHit(dur=.25,vol=.5,f=300){
  if(!audioAllowed())return;
  const C=AUDIO.ctx,b=C.createBuffer(1,Math.max(1,Math.floor(C.sampleRate*dur)),C.sampleRate),d=b.getChannelData(0);
  for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);
  const source=C.createBufferSource();source.buffer=b;
  const filter=C.createBiquadFilter();filter.type='lowpass';filter.frequency.value=f;
  const gain=C.createGain();gain.gain.value=vol;source.connect(filter);filter.connect(gain);gain.connect(AUDIO.master);AUDIO.voices++;
  source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();AUDIO.voices=Math.max(0,AUDIO.voices-1);};source.start();
}
// Visibility events are synchronous even when animation frames stop in a hidden tab.
document.addEventListener('visibilitychange',()=>{if(!AUDIO.master)return;const t=AUDIO.ctx.currentTime;AUDIO.master.gain.cancelScheduledValues(t);AUDIO.master.gain.setValueAtTime(0,t);});
const SFX={
  count:()=>tone(660,.18,'square',.22),go:()=>{tone(880,.5,'square',.25);tone(1320,.5,'square',.15,0,.02);},
  token:(n)=>{tone(1200+n*60,.09,'sine',.2,600);tone(1800+n*60,.12,'sine',.12,900,.05);},
  box:()=>{[0,1,2,3].forEach(i=>tone(520*Math.pow(1.26,i),.1,'triangle',.18,0,i*.06));},
  boost:(lvl=1)=>{noiseHit(.5,.35,1600);tone(220,.55,'sawtooth',.18,700+lvl*200);},
  driftTier:(lvl)=>tone(700+lvl*250,.12,'square',.14,300),
  hit:()=>{noiseHit(.35,.7,500);tone(160,.4,'sawtooth',.3,-100);},
  shieldBlock:()=>{tone(1500,.2,'sine',.3,-400);tone(2200,.3,'sine',.15,-1000,.05);},
  fire:()=>{noiseHit(.3,.4,3000);tone(400,.3,'sawtooth',.2,1200);},
  pulse:()=>{tone(90,1.2,'sine',.5,900);noiseHit(.9,.3,800);},
  lap:()=>{[0,4,7,12].forEach((s,i)=>tone(440*Math.pow(2,s/12),.25,'triangle',.2,0,i*.09));},
  finish:()=>{[0,4,7,12,16,19,24].forEach((s,i)=>tone(330*Math.pow(2,s/12),.5,'triangle',.22,0,i*.11));},
  wall:()=>noiseHit(.15,.35,900),
  ui:()=>tone(1000,.06,'square',.08),
};
function audioUpdate(dt,player,rms){ if(!AUDIO.ctx||AUDIO.ctx.state==='closed')return;const C=AUDIO.ctx;const t=C.currentTime;
  const on=AUDIO.on&&!document.hidden&&game.state!=='paused';AUDIO.master.gain.setTargetAtTime(on?.42:0,t,.04);
  const racing=game.state==='race'||game.state==='countdown'||game.state==='finish';
  const spd=player?player.speed:0,max=player?player.maxSpeed:40;const r=clamp(spd/Math.max(1,max),0,1.3);
  const gear=Math.floor(r*3.999),gr=(r*4)%1;const f=70+gr*95+gear*18+(player&&player.boost>0?40:0);
  AUDIO.osc[0].frequency.setTargetAtTime(f,t,.05);AUDIO.osc[1].frequency.setTargetAtTime(f*1.005,t,.05);AUDIO.osc[2].frequency.setTargetAtTime(f*.5,t,.05);
  AUDIO.lp.frequency.setTargetAtTime(500+r*1800+(player&&player.throttle?300:0),t,.08);
  AUDIO.engGain.gain.setTargetAtTime(racing?.09+r*.05:0,t,.1);
  AUDIO.noiseGain.gain.setTargetAtTime(racing&&player&&player.drifting?.10+player.driftTier*.03:0,t,.06);AUDIO.noiseBP.frequency.setTargetAtTime(1200+r*1200,t,.1);
  AUDIO.windGain.gain.setTargetAtTime(racing?r*r*.10+(player&&player.boost>0?.12:0):0,t,.15);
}
