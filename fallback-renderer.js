/* Canvas road renderer for browsers where GPU contexts are unavailable.
   Game state, collision, AI, items, controls and race timing remain authoritative. */
class CanvasRaceRenderer {
  constructor({canvas}){this.domElement=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.shadowMap={enabled:false};this.capabilities={isWebGL2:false,getMaxAnisotropy:()=>1};this.info={render:{calls:1,triangles:0},memory:{geometries:0,textures:0}};this.ratio=1;this.width=innerWidth;this.height=innerHeight;this.points=[];}
  setPixelRatio(r){this.ratio=Math.min(r,1.5);if(this.width)this.setSize(this.width,this.height);}
  setSize(w,h){this.width=w;this.height=h;this.domElement.width=Math.round(w*this.ratio);this.domElement.height=Math.round(h*this.ratio);this.domElement.style.width=w+'px';this.domElement.style.height=h+'px';}
  polygon(points,color){const c=this.ctx;c.fillStyle=color;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();c.fill();}
  ellipse(x,y,rx,ry,color){const c=this.ctx;c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
  tree(x,y,size,seed=0){
    const c=this.ctx;c.save();c.translate(x,y);c.scale(size,size);
    c.strokeStyle='#70556c';c.lineCap='round';
    for(let i=0;i<7;i++){const bx=Math.sin(i*2.4+seed)*36,by=-45-Math.abs(Math.cos(i*1.7))*32;c.lineWidth=7-i*.65;c.beginPath();c.moveTo(0,2);c.bezierCurveTo(-8,-21,bx*.4,-44,bx,by);c.stroke();}
    for(let i=0;i<95;i++){const t=i*2.399+seed,r=Math.sqrt(i/95),px=Math.cos(t)*52*r,py=-66+Math.sin(t)*31*r;this.ellipse(px,py,4+(i%4),3+(i%3),['#eda5dd','#f6c4ed','#ffe2f6','#d888c9','#f7b4df'][i%5]);}
    c.restore();
  }
  island(x,y,size,seed=0){
    const c=this.ctx;c.save();c.translate(x,y);c.scale(size,size);
    const rock=c.createLinearGradient(-120,0,80,180);rock.addColorStop(0,'#64708d');rock.addColorStop(.5,'#5a547d');rock.addColorStop(1,'#9583b0');
    c.fillStyle=rock;c.beginPath();c.moveTo(-145,0);c.bezierCurveTo(-139,48,-101,82,-82,107);c.lineTo(-45,162);c.quadraticCurveTo(-16,196,0,175);c.lineTo(42,116);c.bezierCurveTo(116,75,149,33,142,-5);c.closePath();c.fill();
    this.polygon([[-130,18],[-76,24],[-47,161],[-83,108]],'#655878');this.polygon([[65,16],[121,2],[67,105],[7,175]],'#74719a');
    this.ellipse(0,0,146,34,'#76a699');this.ellipse(0,-8,135,31,'#a0cdb0');
    const water=c.createLinearGradient(0,-10,0,235);water.addColorStop(0,'#b3edf7');water.addColorStop(.5,'rgba(166,217,246,.83)');water.addColorStop(1,'rgba(195,216,255,0)');
    c.fillStyle=water;c.beginPath();c.moveTo(-32,-14);c.bezierCurveTo(-44,22,-34,85,-49,225);c.lineTo(2,235);c.bezierCurveTo(-5,99,4,29,8,-12);c.closePath();c.fill();
    c.strokeStyle='rgba(235,253,255,.6)';c.lineWidth=2;for(let i=0;i<6;i++){c.beginPath();c.moveTo(-29+i*6,5);c.bezierCurveTo(-35+i*6,48,-30+i*6,80,-40+i*7,191);c.stroke();}
    // Traditional curved roof and pale walls nestle between living trees.
    c.fillStyle='#e4d8e8';c.fillRect(30,-40,48,30);c.fillStyle='#806981';c.fillRect(35,-31,5,24);c.fillRect(67,-31,5,24);
    c.fillStyle='#68627e';c.beginPath();c.moveTo(17,-40);c.quadraticCurveTo(36,-45,53,-63);c.quadraticCurveTo(67,-45,92,-40);c.quadraticCurveTo(63,-32,17,-40);c.fill();
    this.tree(-90,-12,.74,seed);this.tree(101,-14,.68,seed+2);this.tree(-9,-30,.57,seed+3);
    for(let i=0;i<17;i++)this.ellipse(-130+i*16,-1+Math.sin(i*2)*14,3,1.8,'#fce1ef');c.restore();
  }
  backdrop(w,h){
    if(this.background&&this.bgW===w&&this.bgH===h){this.ctx.drawImage(this.background,0,0,w,h);return;}
    const target=document.createElement('canvas');target.width=w;target.height=h;const previous=this.ctx;this.ctx=target.getContext('2d');const c=this.ctx;
    const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#b5b6e4');sky.addColorStop(.36,'#f1c9e1');sky.addColorStop(.64,'#d5dcf2');sky.addColorStop(1,'#aacbe7');c.fillStyle=sky;c.fillRect(0,0,w,h);
    const light=c.createRadialGradient(w*.65,h*.19,0,w*.65,h*.19,w*.5);light.addColorStop(0,'rgba(255,246,243,.58)');light.addColorStop(1,'transparent');c.fillStyle=light;c.fillRect(0,0,w,h);
    for(let i=0;i<12;i++){const x=(i*197%1031)/1031*w,y=h*(.14+(i%4)*.17);this.ellipse(x,y,w*.13,h*.028,'rgba(255,245,253,.18)');}
    c.globalAlpha=.35;this.island(w*.47,h*.27,w/1550,4);this.island(w*.91,h*.20,w/1650,8);c.globalAlpha=1;
    this.island(w*.15,h*.40,w/880,2);this.island(w*.87,h*.31,w/810,5);this.island(w*.03,h*.75,w/1150,8);this.island(w*1.04,h*.69,w/900,1);
    this.ctx=previous;this.background=target;this.bgW=w;this.bgH=h;this.ctx.drawImage(target,0,0,w,h);
  }
  kart(x,y,size,color,steer=0,boost=false,shield=false){
    const c=this.ctx;c.save();c.translate(x,y);c.rotate(steer*.065);c.scale(size/100,size/100);
    this.ellipse(0,14,56,13,'rgba(60,58,102,.24)');
    if(boost){const fire=c.createLinearGradient(0,0,0,95);fire.addColorStop(0,'#fff');fire.addColorStop(.3,color);fire.addColorStop(1,'transparent');for(const side of [-1,1])this.polygon([[side*25-8,-6],[side*25+8,-6],[side*25+3,90],[side*25-3,90]],fire);}
    for(const side of [-1,1]){for(const front of [true,false]){const wx=side*(front?34:43),wy=front?-54:-9,wr=front?10:13;
      const rim=c.createLinearGradient(wx-wr,0,wx+wr,0);rim.addColorStop(0,'#f4fcff');rim.addColorStop(.35,color);rim.addColorStop(.65,'#344982');rim.addColorStop(1,'#d7fcff');this.ellipse(wx,wy,wr,front?17:24,rim);c.strokeStyle='#b5ffff';c.lineWidth=2;c.beginPath();c.ellipse(wx,wy,wr-3,front?14:21,0,0,Math.PI*2);c.stroke();}}
    const white=c.createLinearGradient(-20,-65,24,20);white.addColorStop(0,'#ffffff');white.addColorStop(.4,'#e6f1ff');white.addColorStop(.7,'#9cbddb');white.addColorStop(1,'#eaffff');
    c.fillStyle=white;c.beginPath();c.moveTo(-28,10);c.bezierCurveTo(-46,3,-39,-41,-25,-63);c.quadraticCurveTo(0,-80,25,-63);c.bezierCurveTo(39,-41,46,3,28,10);c.quadraticCurveTo(0,23,-28,10);c.fill();
    this.ellipse(0,-39,23,27,'#405b87');
    // A translucent humanoid driver: shoulders, forearms, neck and unhelmeted head.
    const body=c.createLinearGradient(-18,-90,19,-30);body.addColorStop(0,'#e2ffff');body.addColorStop(.28,color);body.addColorStop(.8,color);body.addColorStop(1,'#d9ffff');c.globalAlpha=.88;c.fillStyle=body;
    c.beginPath();c.moveTo(-14,-38);c.quadraticCurveTo(-14,-51,-19,-66);c.quadraticCurveTo(-26,-75,-17,-82);c.quadraticCurveTo(-9,-87,-6,-87);c.lineTo(-5,-94);c.lineTo(5,-94);c.lineTo(6,-87);c.quadraticCurveTo(24,-85,24,-72);c.lineTo(18,-57);c.lineTo(13,-37);c.quadraticCurveTo(0,-31,-14,-38);c.fill();
    this.ellipse(0,-105,10,15,body);c.strokeStyle='#c4ffff';c.lineWidth=1;c.beginPath();c.ellipse(0,-105,10,15,0,0,Math.PI*2);c.stroke();
    c.strokeStyle=body;c.lineWidth=7;c.lineCap='round';for(const side of [-1,1]){c.beginPath();c.moveTo(side*19,-76);c.quadraticCurveTo(side*29,-57,side*18,-55);c.stroke();}c.globalAlpha=1;
    c.fillStyle=white;c.beginPath();c.moveTo(-32,-15);c.quadraticCurveTo(0,-5,32,-15);c.lineTo(29,1);c.quadraticCurveTo(0,15,-29,1);c.closePath();c.fill();
    c.strokeStyle=color;c.lineWidth=4;c.beginPath();c.moveTo(-32,-9);c.quadraticCurveTo(0,3,32,-9);c.stroke();c.strokeStyle='#bfffff';c.lineWidth=1.5;c.stroke();
    if(shield){c.strokeStyle=color;c.lineWidth=2;c.beginPath();c.ellipse(0,-45,64,85,0,0,Math.PI*2);c.stroke();}c.restore();
  }
  renderDirectorPortrait(division){
    this.portraits ||= new Map();if(this.portraits.has(division.id))return this.portraits.get(division.id);
    const canvas=document.createElement('canvas');canvas.width=192;canvas.height=192;
    const previous=this.ctx;this.ctx=canvas.getContext('2d');const c=this.ctx;
    const bg=c.createRadialGradient(96,90,10,96,100,140);bg.addColorStop(0,'#536987');bg.addColorStop(1,'#1f334d');c.fillStyle=bg;c.fillRect(0,0,192,192);
    // Crop the very same procedural driver used by the compatibility race kart.
    this.kart(96,256,190,division.acc,0,false,false);
    this.ctx=previous;this.portraits.set(division.id,canvas);return canvas;
  }
  powerMotif(kind,x,y,size,color){
    const c=this.ctx,t=performance.now()*.003;c.save();c.translate(x,y-28*size/100);c.scale(size/100,size/100);c.strokeStyle=color;c.fillStyle=color;c.lineWidth=2.4;c.globalAlpha=.8;
    const ring=(rx,ry,angle=0)=>{c.beginPath();c.ellipse(0,0,rx,ry,angle,0,Math.PI*2);c.stroke();};
    const line=(points)=>{c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.stroke();};
    switch(kind){
      case 'zenflow':ring(78,35);ring(89,43);for(let i=0;i<12;i++){const a=i*Math.PI/6;line([[Math.cos(a)*78,Math.sin(a)*35],[Math.cos(a)*85,Math.sin(a)*40]]);}line([[0,0],[Math.cos(t)*61,Math.sin(t)*28]]);break;
      case 'collective':for(let i=0;i<7;i++){const a=t+i*6.28/7;this.ellipse(Math.cos(a)*68,Math.sin(a)*30-25,5,7,'#ffe09f');line([[Math.cos(a)*54,Math.sin(a)*22-25],[0,-25]]);}break;
      case 'hybrid':for(let i=0;i<5;i++){c.globalAlpha=.18+i*.12;c.strokeRect(-53-i*7,-89+i*7,106+i*14,109);}break;
      case 'nexus':c.setLineDash([3,5]);for(const side of[-1,1]){c.strokeRect(side*76-25,-66,50,77);line([[side*76,-66],[side*76,-93]]);ring(87,35);}break;
      case 'kinetic':for(const side of[-1,1])line([[side*58,17],[side*79,-25],[side*53,-8],[side*83,-67],[side*56,-51]]);break;
      case 'juris':for(const side of[-1,1]){c.beginPath();c.arc(0,-30,74,side<0?2:5.1,side<0?4.3:7.5);c.stroke();}line([[-61,-65],[0,-91],[61,-65],[49,3],[0,36],[-49,3],[-61,-65]]);break;
      case 'signal':for(let i=0;i<5;i++){c.beginPath();c.arc(0,-40-i*28,25+i*9,Math.PI*1.1,Math.PI*1.9);c.stroke();}line([[0,-40],[0,-180]]);break;
      case 'loom':for(let i=0;i<4;i++){c.beginPath();for(let j=-100;j<=100;j+=4){const yy=Math.sin(j*.07+t+i)*13+i*7; j===-100?c.moveTo(j,yy):c.lineTo(j,yy);}c.stroke();}break;
      case 'vector':for(const side of[-1,1])for(let i=0;i<3;i++)line([[side*(54+i*15),-59],[side*(69+i*15),-39],[side*(54+i*15),-19]]);break;
      case 'aether':ring(88,35,.3);ring(88,35,-.3);for(let i=0;i<3;i++){const a=t+i*2.1;this.ellipse(Math.cos(a)*88,Math.sin(a)*35,5,5,'#ffebad');}break;
      case 'animus':{const xx=Math.sin(t)*67,yy=-119;line([[xx-18,yy],[xx,yy-9],[xx+18,yy],[xx,yy+9],[xx-18,yy]]);this.ellipse(xx-23,yy,12,3,color);this.ellipse(xx+23,yy,12,3,color);c.setLineDash([4,7]);line([[xx,yy+10],[0,-40]]);break;}
      case 'helix':for(let strand=0;strand<2;strand++){c.beginPath();for(let j=-110;j<33;j+=3){const xx=Math.sin(j*.065+t+strand*Math.PI)*56;j===-110?c.moveTo(xx,j):c.lineTo(xx,j);}c.stroke();}for(let j=-100;j<30;j+=17)line([[Math.sin(j*.065+t)*56,j],[-Math.sin(j*.065+t)*56,j]]);break;
    }c.restore();
  }
  racerPower(r,x,y,size){
    if(typeof ABILITIES==='undefined'||!r.div)return;const ability=ABILITIES[r.div.id];if(!ability)return;
    if(r.specialActive>0||r.phase>0||r.ram>0||r.reflect>0||r.regen>0||r.specialCooldown>ability.cooldown-1.2)this.powerMotif(r.div.id,x,y,size,r.div.acc);
  }
  renderRosterPreview(division,rect){
    if(!division||!rect)return;const c=this.ctx;c.save();c.setTransform(this.ratio,0,0,this.ratio,0,0);this.kart(rect.x+rect.width*.5,rect.y+rect.height*.76,Math.min(rect.width*.53,rect.height*.64),division.acc,Math.sin(performance.now()*.0005)*1.8);c.restore();
  }
  render(){
    if(typeof track==='undefined'||!track.len)return;
    const c=this.ctx,w=this.width,h=this.height;c.setTransform(this.ratio,0,0,this.ratio,0,0);
    const player=typeof game!=='undefined'?game.player:null;
    const u=player?player.u:performance.now()*.000009,lat=player?player.lat:0;
    const ag=trackAG(u)>.5;const horizon=h*.37;
    this.backdrop(w,h);
    if(typeof game!=='undefined'&&game.state==='roster')return;
    // Curvature uses the same signed local road frame as steering; barrel-roll sections
    // are stabilized in this accessibility renderer to keep touch driving legible.
    const focal=Math.min(w,h*1.6)*.95,camHeight=5.5,near=focal*camHeight/Math.max(1,h-horizon)*.9,step=3.6,count=95;
    let bend=0,heading=0;this.points.length=0;
    for(let i=0;i<=count;i++){const distance=i*step,z=near+distance,tu=u+distance/track.len;heading+=trackCurv(tu)*step;bend+=Math.sin(heading)*step*.65;const scale=focal/z;this.points.push({x:w*.5+(bend-lat)*scale,y:horizon+camHeight*scale,half:TRACK_W*.5*scale,scale,u:tu,d:distance});}
    for(let i=count-1;i>=0;i--){const a=this.points[i],b=this.points[i+1],band=Math.floor(wrap01(a.u)*track.len/5)%2;
      const quad=(l,r,col)=>this.polygon([[a.x+a.half*l,a.y],[a.x+a.half*r,a.y],[b.x+b.half*r,b.y],[b.x+b.half*l,b.y]],col);
      quad(-1.16,1.16,'#a996e0');quad(-1.10,1.10,'#e1b0f1');quad(-1,1,band?'#7885b3':'#7683af');quad(-.97,-.95,'#b3fbff');quad(.95,.97,'#b3fbff');quad(-.46,-.44,'#9cdded');quad(.44,.46,'#9cdded');quad(-1.17,-1.15,'#afffff');quad(1.15,1.17,'#afffff');
      if(wrap01(a.u)<step/track.len*1.4){for(let k=0;k<10;k++)quad(-1+k*.2,-.8+k*.2,k%2?'#f5f5f5':'#10151f');}
      if(ag){quad(-1.2,-1.16,'#00d9b5');quad(1.16,1.2,'#00d9b5');}

    }
    const sprites=[];
    const add=(obj,type)=>{const d=wrap01(obj.u-u)*track.len;if(d>3&&d<count*step)sprites.push({obj,type,d});};
    if(typeof tokens!=='undefined')tokens.forEach(t=>{if(t.t<=0)add(t,'token');});
    if(typeof itemBoxes!=='undefined')itemBoxes.forEach(t=>{if(t.t<=0)add(t,'item');});
    if(typeof mines!=='undefined')mines.forEach(t=>add(t,'mine'));
    if(typeof abilityZones!=='undefined')abilityZones.forEach(z=>add(z,'zone'));
    if(typeof missiles!=='undefined')missiles.forEach(t=>add(t,'missile'));
    if(typeof game!=='undefined')game.racers.forEach(r=>{if(r!==player)add(r,'kart');});
    sprites.sort((a,b)=>b.d-a.d);for(const s of sprites){const idx=Math.min(count-1,Math.floor(s.d/step)),a=this.points[idx],b=this.points[idx+1],t=s.d/step-idx,scale=a.scale+(b.scale-a.scale)*t,x=a.x+(b.x-a.x)*t+s.obj.lat*scale,y=a.y+(b.y-a.y)*t;
      if(s.type==='kart'){const size=Math.min(scale*2.8,Math.min(140,w*.22)*.95);this.racerPower(s.obj,x,y,size);this.kart(x,y,size,s.obj.div.acc,s.obj.steer,s.obj.boost>0,s.obj.shield>0);}
      else if(s.type==='zone'){this.powerMotif(s.obj.kind==='snare'?'loom':'nexus',x,y,Math.min(scale*4,180),s.obj.owner.div.acc);}
      else {c.save();c.translate(x,y-scale*1.4);if(s.type==='token'){c.fillStyle='#edc36d';c.strokeStyle='#fff4ba';c.lineWidth=Math.max(1,scale*.09);c.beginPath();c.ellipse(0,0,scale*.35,scale*.55,0,0,Math.PI*2);c.fill();c.stroke();}else if(s.type==='mine'){c.fillStyle='#fc626b';c.beginPath();c.arc(0,scale*.9,scale*.6,0,Math.PI*2);c.fill();c.strokeStyle='#ffd7ca';c.lineWidth=2;c.stroke();}else if(s.type==='missile'){this.polygon([[0,-scale],[-scale*.3,scale*.6],[scale*.3,scale*.6]],'#f6c379');}else{this.ellipse(0,0,scale*.64,scale*.68,'rgba(145,244,255,.32)');c.strokeStyle='#c9ffff';c.lineWidth=1.5;c.beginPath();c.ellipse(0,0,scale*.64,scale*.68,0,0,Math.PI*2);c.stroke();c.fillStyle='#d6ffff';for(let petal=-1;petal<=1;petal++){c.beginPath();c.moveTo(0,scale*.32);c.quadraticCurveTo(petal*scale*.7,-scale*.05,petal*scale*.35,-scale*.42);c.quadraticCurveTo(petal*scale*.15,-scale*.12,0,scale*.32);c.fill();}}c.restore();}
    }
    if(player){const py=Math.min(h*.84,horizon+camHeight*focal/near);this.racerPower(player,w*.5,py,Math.min(140,w*.22));this.kart(w*.5,py,Math.min(140,w*.22),player.div.acc,player.steer,player.boost>0,player.shield>0);if(player.drifting){c.fillStyle=player.driftTier>1?'#bc85ff':'#66e0ff';for(let i=0;i<6;i++){const sx=w*.5+(player.driftDir<0?-1:1)*(45+i*5),sy=py+Math.sin(performance.now()*.02+i)*9;c.fillRect(sx,sy,3,2);}}}
    // Gentle lens vignette, also maintaining HUD contrast around small screens.
    const vignette=c.createRadialGradient(w/2,h/2,h*.2,w/2,h/2,Math.max(w,h)*.8);vignette.addColorStop(0,'transparent');vignette.addColorStop(1,'rgba(59,52,106,.18)');c.fillStyle=vignette;c.fillRect(0,0,w,h);
  }
}
