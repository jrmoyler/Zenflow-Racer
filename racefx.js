// ---------- Race presentation FX ----------
// Skid marks, drift ribbons, speed lines, impact bursts and dynamic post-processing hints.
// Pure presentation: never touches race rules. Every hook is safe to call from tests.
const raceFX={
  init(){},
  clear(){},
  update(dt,player){},
  step(r,dt){},
  onDriftTier(r,tier){},
  onBoost(r,strength){},
  onHit(r,source){},
  onShieldBlock(r){},
  onWall(r,side){},
  onToken(pos,count){},
  onItemBox(pos){},
  onLap(r,lap){},
  onFinish(r){},
  onSpecial(r,kind){},
};
