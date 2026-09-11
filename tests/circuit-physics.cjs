module.exports=({test,assert,run,racer,opponent,context})=>{
 test('Service apex uses physical lane distance and still requires three complete laps',()=>{
  run(require('node:fs').readFileSync(require.resolve('../circuit-extensions.js'),'utf8'));
  const curvature=context.trackCurv,route=context.track.serviceRoute;
  try{
   context.trackCurv=()=>.03;context.track.serviceRoute={start:.1,end:.2};
   racer();run('r.u=r.distance=.15;r.lat=4.65;r.speed=30;r.throttle=false;globalThis.beforeRoute=r.distance;stepRacer(r,.001)');
   assert.ok(run('r.distance-beforeRoute>r.speed*Math.cos(r.theta)*.001/track.len'),'inside lane shortens physical path');
   assert.equal(run('r.lap'),1);assert.equal(run('r.finished'),false);
   run('r.u=r.distance=.19;for(let i=0;i<500;i++){r.speed=45;stepRacer(r,.01)}');
   assert.equal(run('r.lap'),1,'service exit cannot award a lap');assert.equal(run('r.finished'),false);
  }finally{context.trackCurv=curvature;context.track.serviceRoute=route;}
 });
 test('Equal-speed overlapping karts cannot gain energy',()=>{racer();opponent('helix',.0008);run('r.speed=o.speed=30;stepWorld(1/120)');assert.equal(run('r.speed'),30);assert.equal(run('o.speed'),30);});
 test('Closing contact conserves weighted momentum and reduces kinetic energy',()=>{racer();opponent('helix',.0008);run('r.speed=45;o.speed=20;globalThis.momentum=r.speed*r.weight+o.speed*o.weight;globalThis.energy=r.speed*r.speed*r.weight+o.speed*o.speed*o.weight;stepWorld(1/120)');assert.ok(Math.abs(run('r.speed*r.weight+o.speed*o.weight-momentum'))<1e-9);assert.ok(run('r.speed*r.speed*r.weight+o.speed*o.speed*o.weight<energy'));});
 test('Contact cannot push a kart past the track boundary',()=>{racer();opponent('helix',.0008);run('r.lat=TRACK_W/2-.95;o.lat=TRACK_W/2-.91;stepWorld(1/120)');assert.ok(run('Math.abs(r.lat)<=TRACK_W/2-.9&&Math.abs(o.lat)<=TRACK_W/2-.9'));});
 test('Anchored contact leaves its position and speed unchanged',()=>{racer();opponent('helix',.0008);run('o.anchor=2;r.speed=40;o.speed=20;globalThis.latBefore=o.lat;stepWorld(1/120)');assert.equal(run('o.speed'),20);assert.equal(run('o.lat'),run('latBefore'));});
 test('Slope slows uphill travel and accelerates downhill travel',()=>{const tan=context.trackTan;try{context.trackTan=(u,v)=>v.set(0,.3,.954);racer();run('r.speed=30;r.throttle=false;stepRacer(r,1/120);globalThis.uphill=r.speed');context.trackTan=(u,v)=>v.set(0,-.3,.954);racer();run('r.speed=30;r.throttle=false;stepRacer(r,1/120)');assert.ok(run('r.speed>uphill'));}finally{context.trackTan=tan;}});
 test('Countdown karts stay stationary on an incline',()=>{const tan=context.trackTan;try{context.trackTan=(u,v)=>v.set(0,-.3,.954);racer();run("game.state='countdown';globalThis.gridDistance=r.distance;for(let n=0;n<120;n++)stepRacer(r,1/120)");assert.equal(run('r.speed'),0);assert.equal(run('r.distance'),run('gridDistance'));}finally{context.trackTan=tan;}});
 test('Forward progress uses heading projection through a slide',()=>{racer();run('r.speed=30;r.theta=.3;r.ai.steer=1;globalThis.startDistance=r.distance;stepRacer(r,1/120)');assert.ok(Math.abs(run('(r.distance-startDistance)*track.len-r.speed*Math.cos(r.theta)/120'))<1e-9);});
 test('Stopped kart rolls downhill without throttle after brake release',()=>{const tan=context.trackTan;try{context.trackTan=(u,v)=>v.set(0,-.3,.954);racer();run('r.speed=0;r.throttle=false;r.brake=false;stepRacer(r,1/120)');assert.ok(run('r.speed')>0);}finally{context.trackTan=tan;}});
 test('Faster sideways rear kart does not hit a departing leader',()=>{racer();opponent('helix',.0008);run('r.speed=35;r.theta=.7;o.speed=30;o.theta=0;stepWorld(1/120)');assert.equal(run('r.speed'),35);assert.equal(run('o.speed'),30);});
 test('Equal scalar speeds transfer momentum when the leader is drifting',()=>{racer();opponent('helix',.0008);run('r.speed=o.speed=30;r.theta=0;o.theta=.5;globalThis.energy=r.speed*r.speed*r.weight+o.speed*o.speed*o.weight;stepWorld(1/120)');assert.ok(run('r.speed<30&&o.speed>30'));assert.ok(run('r.speed*r.speed*r.weight+o.speed*o.speed*o.weight<energy'));});
};
