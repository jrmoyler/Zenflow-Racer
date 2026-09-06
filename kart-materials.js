// ---------- Kart material factory ----------
// Procedural PBR liveries for the twelve division chassis. Textures are cached in TEX so
// disposeKart() keeps them alive across races; every generator degrades to plain materials
// when no 2D canvas is available (Node regression contexts).
function kartMaterials(div){
  const color=new THREE.Color(div.id==='vector'?'#309DFF':div.acc),light=color.clone().lerp(new THREE.Color(0xc8ffff),.38);
  const white=new THREE.MeshPhysicalMaterial({color:0xeaf5ff,roughness:.2,metalness:.08,clearcoat:1,clearcoatRoughness:.15,side:THREE.DoubleSide});
  const dark=new THREE.MeshStandardMaterial({color:0x142943,metalness:.18,roughness:.45,side:THREE.DoubleSide});
  const panel=new THREE.MeshPhysicalMaterial({color:color.clone(),emissive:color,emissiveIntensity:.15,roughness:.2,metalness:.25,clearcoat:1,side:THREE.DoubleSide});
  const glow=new THREE.MeshStandardMaterial({color:light,emissive:light,emissiveIntensity:1.7,roughness:.2,side:THREE.DoubleSide});
  const skin=new THREE.MeshPhysicalMaterial({color,emissive:color,emissiveIntensity:.18,roughness:.18,metalness:.3,clearcoat:1,transparent:true,opacity:.91,depthWrite:true,side:THREE.DoubleSide});
  const metal=new THREE.MeshPhysicalMaterial({color:['collective','juris','aether','helix','hybrid'].includes(div.id)?(div.id==='juris'?'#C9A84C':div.id==='collective'?'#BE813B':'#EE8B36'):'#708CA3',metalness:.8,roughness:.22,clearcoat:1});
  return {white,dark,panel,glow,skin,metal,tyre:white,color,light};
}
