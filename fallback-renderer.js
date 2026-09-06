/* Canvas road renderer for browsers where GPU contexts are unavailable.
   Game state, collision, AI, items, controls and race timing remain authoritative. */
class CanvasRaceRenderer {
  constructor({canvas}){this.domElement=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.shadowMap={enabled:false};this.capabilities={isWebGL2:false,getMaxAnisotropy:()=>1};this.info={render:{calls:1,triangles:0},memory:{geometries:0,textures:0}};this.ratio=1;this.width=innerWidth;this.height=innerHeight;this.points=[];}
  setPixelRatio(r){this.ratio=Math.min(r,1.5);if(this.width)this.setSize(this.width,this.height);}
  setSize(w,h){this.width=w;this.height=h;this.domElement.width=Math.round(w*this.ratio);this.domElement.height=Math.round(h*this.ratio);this.domElement.style.width=w+'px';this.domElement.style.height=h+'px';}
  polygon(points,color){const c=this.ctx;c.fillStyle=color;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();c.fill();}
  kart(x,y,size,color,steer=0,boost=false,shield=false){
    const c=this.ctx;c.save();c.translate(x,y);c.rotate(steer*.07);c.scale(size/100,size/100);
    c.fillStyle='rgba(0,0,0,.35)';c.beginPath();c.ellipse(0,12,53,15,0,0,Math.PI*2);c.fill();
    if(boost){const fire=c.createLinearGradient(0,0,0,65);fire.addColorStop(0,'#eaffff');fire.addColorStop(.35,'#00d9b5');fire.addColorStop(1,'transparent');this.polygon([[-29,0],[-14,0],[-21,55+Math.sin(performance.now()*.06)*10]],fire);this.polygon([[14,0],[29,0],[21,55+Math.cos(performance.now()*.06)*10]],fire);}
    for(const side of [-1,1]){c.fillStyle='#070b13';c.fillRect(side*43-9,-36,18,43);c.fillRect(side*35-7,-67,14,23);c.fillStyle='#374252';c.fillRect(side*43-7,-32,3,33);}
    const paint=c.createLinearGradient(0,-75,0,10);paint.addColorStop(0,'#f1f6fc');paint.addColorStop(.2,color);paint.addColorStop(1,'#182334');
    this.polygon([[-28,7],[-36,-20],[-26,-62],[-14,-75],[14,-75],[26,-62],[36,-20],[28,7]],paint);
    c.fillStyle='#090f20';c.beginPath();c.ellipse(0,-43,18,24,0,0,Math.PI*2);c.fill();
    const helmet=c.createLinearGradient(-10,-60,10,-31);helmet.addColorStop(0,'#f5f5f5');helmet.addColorStop(.5,color);helmet.addColorStop(1,'#162337');c.fillStyle=helmet;c.beginPath();c.ellipse(0,-48,12,14,0,0,Math.PI*2);c.fill();c.fillStyle='#06101c';c.fillRect(-10,-48,20,5);
    c.fillStyle=color;c.fillRect(-43,-20,86,7);c.fillStyle='#111b2b';c.fillRect(-37,-11,74,14);c.fillStyle='#ff6267';c.fillRect(-34,-8,15,4);c.fillRect(19,-8,15,4);c.fillStyle='#bac7ce';c.fillRect(-9,-7,18,4);
    if(shield){c.strokeStyle='#56ffe4';c.lineWidth=2;c.beginPath();c.ellipse(0,-30,58,68,0,0,Math.PI*2);c.stroke();}c.restore();
  }
  render(){
    if(typeof track==='undefined'||!track.len)return;
    const c=this.ctx,w=this.width,h=this.height;c.setTransform(this.ratio,0,0,this.ratio,0,0);
    const player=typeof game!=='undefined'?game.player:null;
    const u=player?player.u:performance.now()*.000009,lat=player?player.lat:0;
    const ag=trackAG(u)>.5;const horizon=h*.37;
    const sky=c.createLinearGradient(0,0,0,horizon+h*.12);sky.addColorStop(0,'#101d39');sky.addColorStop(.55,'#34455f');sky.addColorStop(1,'#e5ad74');c.fillStyle=sky;c.fillRect(0,0,w,h);
    c.fillStyle='#efd3a2';c.beginPath();c.arc(w*.76,h*.29,Math.max(17,w*.024),0,Math.PI*2);c.fill();
    // Layered skyline and hills provide depth without allocating a 3D scene per frame.
    for(let layer=0;layer<3;layer++){c.fillStyle=['#53616b','#354a51','#243c40'][layer];c.beginPath();c.moveTo(0,horizon+35);for(let x=0;x<=w+20;x+=20){const y=horizon-15+layer*14-Math.sin(x/w*12+layer*2)*22-Math.sin(x/w*27+layer)*13;c.lineTo(x,y);}c.lineTo(w,h);c.lineTo(0,h);c.fill();}
    c.fillStyle='#243243';for(let i=0;i<23;i++){const bx=(i*83+37)%Math.max(w,1),bh=12+(i*19)%59;c.fillRect(bx,horizon-bh,13+(i%3)*6,bh);c.fillStyle='#b5a579';for(let k=5;k<bh;k+=9)c.fillRect(bx+4,horizon-bh+k,2,2);c.fillStyle='#243243';}
    const ground=c.createLinearGradient(0,horizon,0,h);ground.addColorStop(0,ag?'#263843':'#304a40');ground.addColorStop(1,ag?'#102832':'#172c27');c.fillStyle=ground;c.fillRect(0,horizon+26,w,h-horizon);
    // Curvature uses the same signed local road frame as steering; barrel-roll sections
    // are stabilized in this accessibility renderer to keep touch driving legible.
    const focal=Math.min(w,h*1.6)*.95,camHeight=5.5,near=focal*camHeight/Math.max(1,h-horizon)*.9,step=3.6,count=95;
    let bend=0,heading=0;this.points.length=0;
    for(let i=0;i<=count;i++){const distance=i*step,z=near+distance,tu=u+distance/track.len;heading+=trackCurv(tu)*step;bend+=Math.sin(heading)*step*.65;const scale=focal/z;this.points.push({x:w*.5+(bend-lat)*scale,y:horizon+camHeight*scale,half:TRACK_W*.5*scale,scale,u:tu,d:distance});}
    for(let i=count-1;i>=0;i--){const a=this.points[i],b=this.points[i+1],band=Math.floor(wrap01(a.u)*track.len/5)%2;
      const quad=(l,r,col)=>this.polygon([[a.x+a.half*l,a.y],[a.x+a.half*r,a.y],[b.x+b.half*r,b.y],[b.x+b.half*l,b.y]],col);
      quad(-1.14,1.14,band?'#eee9dc':'#b8424d');quad(-1,1,band?'#333b47':'#303845');quad(-.95,-.93,'#dddcd1');quad(.93,.95,'#dddcd1');if(band)quad(-.009,.009,'#a0a6a8');
      if(wrap01(a.u)<step/track.len*1.4){for(let k=0;k<10;k++)quad(-1+k*.2,-.8+k*.2,k%2?'#f5f5f5':'#10151f');}
      if(ag){quad(-1.2,-1.16,'#00d9b5');quad(1.16,1.2,'#00d9b5');}
      if(i%7===0){for(const side of[-1,1]){const x=a.x+side*a.half*1.7,sy=a.y,s=a.scale;c.fillStyle='#131f27';c.fillRect(x-s*.1,sy-s*5,s*.2,s*5);c.fillStyle='#edd29a';c.fillRect(x-s*.35,sy-s*5,s*.7,s*.3);}}
    }
    const sprites=[];
    const add=(obj,type)=>{const d=wrap01(obj.u-u)*track.len;if(d>3&&d<count*step)sprites.push({obj,type,d});};
    if(typeof tokens!=='undefined')tokens.forEach(t=>{if(t.t<=0)add(t,'token');});
    if(typeof itemBoxes!=='undefined')itemBoxes.forEach(t=>{if(t.t<=0)add(t,'item');});
    if(typeof mines!=='undefined')mines.forEach(t=>add(t,'mine'));
    if(typeof missiles!=='undefined')missiles.forEach(t=>add(t,'missile'));
    if(typeof game!=='undefined')game.racers.forEach(r=>{if(r!==player)add(r,'kart');});
    sprites.sort((a,b)=>b.d-a.d);for(const s of sprites){const idx=Math.min(count-1,Math.floor(s.d/step)),a=this.points[idx],b=this.points[idx+1],t=s.d/step-idx,scale=a.scale+(b.scale-a.scale)*t,x=a.x+(b.x-a.x)*t+s.obj.lat*scale,y=a.y+(b.y-a.y)*t;
      if(s.type==='kart')this.kart(x,y,Math.min(scale*2.8,Math.min(140,w*.22)*.95),s.obj.div.acc,s.obj.steer,s.obj.boost>0,s.obj.shield>0);
      else {c.save();c.translate(x,y-scale*1.4);if(s.type==='token'){c.fillStyle='#edc36d';c.strokeStyle='#fff4ba';c.lineWidth=Math.max(1,scale*.09);c.beginPath();c.ellipse(0,0,scale*.35,scale*.55,0,0,Math.PI*2);c.fill();c.stroke();}else if(s.type==='mine'){c.fillStyle='#fc626b';c.beginPath();c.arc(0,scale*.9,scale*.6,0,Math.PI*2);c.fill();c.strokeStyle='#ffd7ca';c.lineWidth=2;c.stroke();}else if(s.type==='missile'){this.polygon([[0,-scale],[-scale*.3,scale*.6],[scale*.3,scale*.6]],'#f6c379');}else{c.rotate(Math.PI/4);c.fillStyle='#00baa4';c.strokeStyle='#bcfff2';c.lineWidth=1.5;c.fillRect(-scale*.5,-scale*.5,scale,scale);c.strokeRect(-scale*.5,-scale*.5,scale,scale);}c.restore();}
    }
    if(player){const py=Math.min(h*.84,horizon+camHeight*focal/near);this.kart(w*.5,py,Math.min(140,w*.22),player.div.acc,player.steer,player.boost>0,player.shield>0);if(player.drifting){c.fillStyle=player.driftTier>1?'#bc85ff':'#66e0ff';for(let i=0;i<6;i++){const sx=w*.5+(player.driftDir<0?-1:1)*(45+i*5),sy=py+Math.sin(performance.now()*.02+i)*9;c.fillRect(sx,sy,3,2);}}}
    // Gentle lens vignette, also maintaining HUD contrast around small screens.
    const vignette=c.createRadialGradient(w/2,h/2,h*.15,w/2,h/2,Math.max(w,h)*.7);vignette.addColorStop(0,'transparent');vignette.addColorStop(1,'rgba(3,8,19,.5)');c.fillStyle=vignette;c.fillRect(0,0,w,h);
  }
}
