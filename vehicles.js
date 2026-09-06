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
function batchKartBody(group){
  const batches=new Map();
  for(const mesh of group.children){
    // Transparent effects and dynamically animated materials must remain addressable.
    if(!mesh.isMesh||mesh.material.transparent||(mesh.material.emissiveIntensity>0&&mesh.material.emissive?.getHex()!==0))continue;
    const key=mesh.material;const batch=batches.get(key)||[];batch.push(mesh);batches.set(key,batch);
  }
  for(const [material,meshes] of batches){
    if(meshes.length<2)continue;
    const parts=meshes.map(mesh=>{mesh.updateMatrix();return mesh.geometry.clone().applyMatrix4(mesh.matrix);});
    const merged=new THREE.Mesh(mergeKartGeometry(parts),material);merged.castShadow=true;
    parts.forEach(g=>g.dispose());const shared=new Set(Object.values(KART_GEO));meshes.forEach(mesh=>{group.remove(mesh);if(!shared.has(mesh.geometry))mesh.geometry.dispose();});group.add(merged);
  }
}
function disposeKart(root){
  if(!root)return;
  const sharedGeometry=new Set(Object.values(KART_GEO));
  const sharedTextures=new Set(Object.values(TEX));
  const geometries=new Set(),materials=new Set(),textures=new Set();
  root.traverse(obj=>{if(obj.geometry&&!sharedGeometry.has(obj.geometry))geometries.add(obj.geometry);
    if(obj.material)(Array.isArray(obj.material)?obj.material:[obj.material]).forEach(m=>materials.add(m));});
  materials.forEach(m=>{Object.values(m).forEach(v=>{if(v?.isTexture&&!sharedTextures.has(v))textures.add(v);});m.dispose();});
  geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());if(root.parent)root.parent.remove(root);
}
const KART_GEO={};
// Reference reconstruction: rounded section surfaces retain an open cockpit.
function sectionSurface(rows,segments=48){
  const positions=[],uv=[],indices=[];
  rows.forEach((row,j)=>{for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2,front=Math.max(0,-Math.cos(a)),w=row[1]*(1-front*.12);positions.push(Math.sin(a)*w,row[0],Math.cos(a)*row[2]+(row[3]||0));uv.push(i/segments,j/(rows.length-1));}});
  for(let j=0;j<rows.length-1;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+segments+1;indices.push(a,b,a+1,b,b+1,a+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
function bodyLoft(rows,segments=32){
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
  const torso=bodyLoft([[0,.19,.17,.02],[.12,.29,.22,.02],[.33,.27,.19,0],[.52,.31,.2,0],[.75,.4,.235,.01],[.9,.41,.22,.025],[1.0,.33,.17,.02],[1.065,.2,.145,.02],[1.12,.115,.11,.02],[1.27,.12,.11,0]],40);
  const head=bodyLoft([[1.18,.075,.075,0],[1.22,.12,.11,-.012],[1.28,.15,.13,-.025],[1.39,.185,.15,-.013],[1.50,.20,.16,0],[1.62,.18,.153,.015],[1.7,.125,.11,.02],[1.735,.01,.01,.02]],36);
  const arms=[];const legs=[];
  for(const s of [-1,1]){
    arms.push(limbSurface([[s*.32,.91,.025],[s*.43,.85,-.015],[s*.46,.66,-.17],[s*.44,.53,-.29],[s*.35,.56,-.48],[s*.28,.47,-.68]],[.14,.155,.11,.095,.07,.065]));
    legs.push(limbSurface([[s*.19,.06,.01],[s*.22,-.05,-.2],[s*.27,-.10,-.43],[s*.28,-.12,-.57],[s*.27,-.35,-.75],[s*.24,-.53,-.91]],[.16,.17,.15,.14,.1,.075]));
  }
  const hands=[];for(const s of [-1,1])hands.push(limbSurface([[s*.28,.47,-.66],[s*.275,.49,-.71],[s*.255,.47,-.76]],[.065,.085,.035]));
  const body=mergeKartGeometry([torso,head,...arms,...legs,...hands]);[torso,head,...arms,...legs,...hands].forEach(g=>g.dispose());
  const locks=[];for(let i=0;i<9;i++){const x=(i-4)*.048;locks.push(limbSurface([[x*.6,1.72,.035],[x,1.64,.16],[x*1.2,1.44,.21],[x*1.2,1.19,.22],[x*1.3,1.03,.19]],[.035,.047,.045,.038,.012]));}const hair=mergeKartGeometry(locks);locks.forEach(g=>g.dispose());Object.assign(KART_GEO,{shell,lower,band,floor,tyre,rim,hub,wheelBand,body,hair});
}
// Longitudinal coachwork: each station defines z, half-width, vertical center and depth.
// Unlike primitive boxes, these smooth closed lofts have authored taper and camber.
function coachwork(stations,facets=24){
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
function buildDivisionCoachwork(div,root,add,m){
  const {white,dark,panel,glow,metal}=m,id=div.id;
  const hull=(rows,mat=white,x=0,name='sculpted-coachwork')=>{const o=add(coachwork(rows),mat,root,name);o.position.x=x;return o;};
  const ribbon=(points,mat=white,w=.14,t=.055,name='swept-ribbon')=>add(kartRibbon(points,w,t),mat,root,name);
  const pipe=(points,mat=dark,r=.04)=>add(limbSurface(points,[r,r,r]),mat,root,'suspension-link');
  const ring=(r,t,mat,x,y,z,name='intake-ring')=>{const o=add(new THREE.TorusGeometry(r,t,10,32),mat,root,name);o.position.set(x,y,z);return o;};
  const nose=(length=2.15,width=.65,height=.92)=>hull([[-length,.015,.5,.025],[-length+.28,width*.5,.58,.13],[-1.3,width,.73,.23],[-.7,width*.77,height,.22],[-.4,.43,.91,.07]],white);
  const wing=(z,y,span=1.35)=>{for(const s of [-1,1]){ribbon([[s*.1,y,z],[s*.65,y+.03,z-.08],[s*span,y+.06,z]],white,.21,.055,'aerofoil');ribbon([[s*span,y,z+.13],[s*span,y+.3,z],[s*span,y+.36,z-.23]],panel,.14,.045,'wing-endplate');}};
  const cockpit=hull([[-.8,.5,.63,.13],[-.4,.69,.62,.2],[.7,.71,.62,.22],[1.5,.65,.61,.2],[1.8,.08,.58,.06]],dark);cockpit.name='open-cockpit-monocoque';
  for(const s of [-1,1])ribbon([[s*.43,.88,-.65],[s*.72,1.02,-.12],[s*.76,1.08,.7],[s*.6,1.13,1.3],[0,1.1,1.48]],white,.13,.075,'cockpit-shoulder');
  hull([[.55,.35,.63,.04],[.7,.46,.92,.27],[.95,.44,1.18,.38],[1.12,.28,1.16,.35],[1.2,.05,1.03,.1]],dark).name='contoured-seat';
  // Functional crossarms visibly connect the four independent wheel assemblies.
  for(const s of [-1,1])for(const z of [-1.25,1.28])for(const y of [.35,.66])pipe([[s*.45,y,z+.18],[s*.87,y-.03,z],[s*1.23,.6,z]],metal,.035);
  const fenders=(broad=false)=>{for(const s of [-1,1])for(const z of [-1.25,1.28])ribbon([[s*1.23,.56,z-.64],[s*1.23,1.04,z-.47],[s*1.23,1.2,z],[s*1.23,1.04,z+.47],[s*1.23,.6,z+.62]],white,broad?.3:.16,.065,'wheel-arch');};
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
  }else{
    const sharp=id==='signal'||id==='vector';nose(sharp?2.55:2.15, id==='juris'?.73:.57,1.02);
    for(const s of [-1,1]){
      hull([[-2.05,.015,.35,.015],[-1.45,.3,.5,.18],[-.5,.25,.75,.21],[.6,.24,.72,.19],[1.6,.03,.63,.04]],white,s*.77);
      ribbon([[s*.06,.53,sharp?-2.48:-2.07],[s*.52,.68,-1.56],[s*.83,.84,-.75],[s*.85,.61,.45]],glow,.025,.023,'headlight-signature');
      if(sharp){ribbon([[s*.76,.73,.43],[s*1.05,1.3,1.45],[s*1.18,1.65,1.81]],white,.22,.06,'swept-tail-fin');ribbon([[s*.31,.4,-2.1],[s*1.25,.3,-1.66],[s*1.44,.42,-1.38]],panel,.17,.035,'split-front-canard');}
      if(id==='juris'){hull([[-1.8,.1,.38,.1],[-1.3,.35,.78,.37],[-.75,.29,.92,.3],[-.45,.03,.7,.04]],dark,s*.92);ribbon([[s*.94,.38,-1.75],[s*1.18,.85,-1.27],[s*.98,1.18,-.7]],metal,.055,.04,'armor-gold-seam');hull([[.85,.06,.7,.05],[1.1,.25,1.06,.37],[1.65,.2,.99,.3],[1.8,.03,.7,.04]],dark,s*.68);}
      if(id==='hybrid')ribbon([[s*1.23,.5,-1.9],[s*1.23,1.16,-1.3],[s*1.23,1.1,-.9]],metal,.045,.025,'orange-outrigger');
    }
    if(!sharp)fenders(id==='juris');if(id==='vector')wing(1.36,1.42,1.32);
  }
  return {hull,ribbon};
}

function buildKart(div){
  const root=new THREE.Group();root.name=div.name+' Reference Chassis';
  const {white,dark,panel,glow,skin,metal,tyre}=kartMaterials(div);
  const add=(g,m,parent=root,name='')=>{const o=new THREE.Mesh(g,m);o.name=name;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
  buildDivisionCoachwork(div,root,add,{white,dark,panel,glow,metal});add(KART_GEO.floor,dark,root,'cockpit-well');
  const pilot=new THREE.Group();pilot.name='seated-humanoid';pilot.position.set(0,1,.37);root.add(pilot);add(KART_GEO.body,skin,pilot,'continuous-humanoid-surface');if(div.id==='kinetic'||div.id==='loom'){pilot.scale.set(.9,1,.94);add(KART_GEO.hair,skin,pilot,'swept-hair');}
  // Steering wheel is connected to the footwell, with hands meeting its upper grips.
  const wheel=new THREE.Mesh(new THREE.TorusGeometry(.25,.035,10,32),dark);wheel.position.set(0,1.45,-.34);wheel.rotation.x=-.7;wheel.name='steering-wheel';root.add(wheel);
  const stem=add(limbSurface([[0,.64,-.58],[0,1.15,-.46],[0,1.44,-.34]],[.03,.03,.03]),dark,root,'steering-column');
  const wheels=[];
  [[-1.23,.6,-1.25],[1.23,.6,-1.25],[-1.23,.6,1.28],[1.23,.6,1.28]].forEach((p,i)=>{
    const pivot=new THREE.Group(),spin=new THREE.Group();pivot.name=['wheel-fl','wheel-fr','wheel-rl','wheel-rr'][i];pivot.position.set(...p);root.add(pivot);pivot.add(spin);
    add(KART_GEO.tyre,tyre,spin,'rounded-wheel-shell');add(KART_GEO.hub,panel,spin,'recessed-colored-hub');add(KART_GEO.wheelBand,panel,spin,'translucent-tire-band');
    const luminous=glow.clone();const ring=add(KART_GEO.rim,luminous,pivot,'wheel-light-ring');ring.position.x=i%2?.255:-.255;
    wheels.push({pivot,spin,glow:ring,side:i%2?1:-1});
  });
  const exhaust=[];for(const x of [-.48,.48]){const e=add(new THREE.TorusGeometry(.11,.045,8,20),glow.clone(),root,'rear-flow-emitter');e.position.set(x,.37,1.89);exhaust.push(e);}
  const under=add(new THREE.TorusGeometry(1,.035,8,48),glow.clone(),root,'underbody-flow-ring');under.rotation.x=Math.PI/2;under.scale.set(.85,1.6,1);under.position.y=.19;
  const shield=add(new THREE.SphereGeometry(2.15,24,16),new THREE.MeshPhysicalMaterial({color:0x00d9b5,emissive:0x00d9b5,emissiveIntensity:.35,transparent:true,opacity:.16,roughness:.15,side:THREE.DoubleSide}),root,'aegis-shield');shield.position.y=.9;shield.visible=false;
  const halo=new THREE.Group(),star=new THREE.Group();halo.visible=star.visible=false;pilot.add(halo,star);
  root.userData={wheels,pilot,halo,star,under,shield,exhaust,glow,chassis:div.id};batchKartBody(root);return root;
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
  const boxG=starGeo(1.1,.5);const boxMat=new THREE.MeshPhysicalMaterial({color:0xd4a843,metalness:.85,roughness:.18,emissive:0xd4a843,emissiveIntensity:.18,clearcoat:1});
  const coreG=new THREE.IcosahedronGeometry(.42,1);const coreMat=new THREE.MeshStandardMaterial({color:0x000,emissive:0x00d9b5,emissiveIntensity:3});
  const rows=[0.11,0.30,0.47,0.64,0.80,0.93];
  rows.forEach(u=>{[-5,-1.7,1.7,5].forEach(lat=>{const g=new THREE.Group();const m=new THREE.Mesh(boxG,boxMat);m.castShadow=true;g.add(m);const cc=new THREE.Mesh(coreG,coreMat);g.add(cc);pickupGroup.add(g);itemBoxes.push({u,lat,mesh:g,star:m,core:cc,t:0});});});
  // tokens: gold hex coins in arcs
  const tokG=new THREE.CylinderGeometry(.5,.5,.12,6);tokG.rotateX(Math.PI/2);const tokMat=new THREE.MeshPhysicalMaterial({color:0xd4a843,metalness:.9,roughness:.2,emissive:0xd4a843,emissiveIntensity:.35,clearcoat:.8});
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
  if(AUDIO.ctx){if(AUDIO.ctx.state==='suspended')AUDIO.ctx.resume().catch(()=>{});return;}
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
