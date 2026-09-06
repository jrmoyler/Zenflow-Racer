/* Opt-in evidence recorder: ?review=1. No network, gameplay changes or certification.
   rAF intervals measure delivery cadence; renderWorkMs is CPU submission/raster work,
   NOT GPU execution time. Keep stalls; exclude only explicit inactive-state boundaries. */
class RaceFrameRecorder {
  constructor(limit=120000){this.limit=limit;this.runs=[];this.current=null;this.last=null;this.events=[];this.loadingMs=null;}
  event(type,detail={},now=performance.now()){
    if(this.events.length<2000)this.events.push({type,atMs:now,...detail});
    else this.eventsTruncated=true;
  }
  interrupt(type,now){this.last=null;this.event(type,{},now);}
  start(meta,now=performance.now()){
    if(this.current&&!this.current.completed)this.current.endReason='restarted-or-left';
    const run={...meta,startedAtMs:now,completed:false,samples:[],truncated:false};
    if(this.runs.length>=6){this.runs.shift();this.runsTruncated=true;}
    this.runs.push(run);this.current=run;this.last=null;this.event('race-start',meta,now);
  }
  sample(now,state,raceSeconds,graphics={}){
    const run=this.current;
    if(!run||run.completed||state!=='race'){this.last=null;return;}
    if(this.last!==null){
      const ms=now-this.last;
      if(Number.isFinite(ms)&&ms>0){
        if(run.samples.length<this.limit)run.samples.push([now,ms,graphics.workMs??null,graphics.pixelRatio??null,graphics.triangles??null,graphics.calls??null,graphics.activeEffects??null,raceSeconds]);
        else run.truncated=true;
      }
    }
    this.last=now;
  }
  finish(seconds,now=performance.now()){
    if(!this.current)return;
    this.current.completed=true;this.current.finishTimeSeconds=seconds;this.current.finishedAtMs=now;
    this.last=null;this.event('race-finish',{seconds},now);
  }
  static distribution(values){
    const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);
    if(!sorted.length)return {count:0,p50:null,p95:null,max:null};
    const q=p=>sorted[Math.max(0,Math.ceil(p*sorted.length)-1)];
    return {count:sorted.length,p50:q(.5),p95:q(.95),max:sorted[sorted.length-1]};
  }
  static summary(run){
    const frames=run.samples.map(s=>s[1]),total=frames.reduce((a,b)=>a+b,0);
    // Non-overlapping >=5s windows, including long stalls. A short tail is omitted.
    const windows=[];let time=0,count=0;
    for(const ms of frames){time+=ms;count++;if(time>=5000){windows.push(count*1000/time);time=0;count=0;}}
    return {frameMs:RaceFrameRecorder.distribution(frames),
      renderSubmissionMs:RaceFrameRecorder.distribution(run.samples.map(s=>s[2])),
      activeSampledSeconds:total/1000,averageFps:total?frames.length*1000/total:null,
      sustainedFps5s:RaceFrameRecorder.distribution(windows),
      slowFramesOver50ms:frames.filter(ms=>ms>50).length,
      effectsPresentFrames:run.samples.filter(s=>s[6]>0).length,
      completed:run.completed,truncated:run.truncated};
  }
  report(metadata={}){
    return {schemaVersion:1,metadata,loadingMs:this.loadingMs,certification:'not-certified',
      measurement:'rAF delivery intervals; CPU render submission time is not GPU timing',
      sampleColumns:['atMs','frameMs','renderSubmissionMs','pixelRatio','triangles','calls','activeEffects','raceSeconds'],
      events:this.events,eventsTruncated:!!this.eventsTruncated,runsTruncated:!!this.runsTruncated,
      runs:this.runs.map(run=>({...run,summary:RaceFrameRecorder.summary(run)}))};
  }
}
if(typeof module!=='undefined')module.exports={RaceFrameRecorder};
const raceTelemetry=typeof location!=='undefined'&&/[?&]review=1(?:&|$)/.test(location.search)?installRaceTelemetry():undefined;
function installRaceTelemetry(){
  const recorder=new RaceFrameRecorder();
  const graphics=()=>({renderer:FALLBACK_GRAPHICS?'software':'webgl',pixelRatio:renderer.getPixelRatio?.()??null,
    lowfx:LOWFX,mobilefx:MOBILEFX,shadows:renderer.shadowMap?.enabled??false,
    postprocessing:typeof raceComposer!=='undefined'&&!!raceComposer,
    workMs:renderer.info?.render?.workMs??null,triangles:renderer.info?.render?.triangles??null,
    calls:renderer.info?.render?.calls??null,geometries:renderer.info?.memory?.geometries??null,
    textures:renderer.info?.memory?.textures??null,activeEffects:typeof abilityZones!=='undefined'?abilityZones.length+mines.length+missiles.length+(typeof game!=='undefined'?game.racers.filter(r=>r.boost>0||r.drifting||r.shield>0||r.spin>0).length:0):null});
  const panel=document.createElement('details');panel.id='race-measurements';
  panel.style.cssText='position:fixed;top:8px;left:8px;z-index:9000;max-width:min(360px,90vw);max-height:80vh;overflow:auto;background:#102030;color:white;padding:10px;font:13px/1.5 system-ui;border:1px solid #6da0b3;border-radius:6px';
  panel.innerHTML='<summary>Race measurements</summary><p>Local diagnostic capture. Device details are tester supplied; this report does not certify hardware.</p><label>Device model<input id="measure-device" placeholder="Exact phone model"></label><label>OS version<input id="measure-os" placeholder="OS and version"></label><label>Browser version<input id="measure-browser" placeholder="Browser and version"></label><label>Test environment<select id="measure-hardware"><option value="unverified">Unverified</option><option value="physical-local">Physical phone · local tester</option><option value="physical-service">Physical phone · device service</option><option value="desktop">Desktop / emulation / cloud</option></select></label><label>Failures / session ID / test notes<textarea id="measure-notes" rows="3"></textarea></label><button id="measure-export">Export measurements</button><output id="measure-status" style="display:block">Waiting for a race</output>';
  document.body.append(panel);
  panel.querySelectorAll('input,select,textarea').forEach(el=>{el.style.cssText='display:block;width:100%;box-sizing:border-box;margin:3px 0 8px;padding:5px';});
  let lastResources=0;
  recorder.frame=(now,state,seconds)=>{
    recorder.sample(now,state,seconds,graphics());
    if(now-lastResources<1000)return;lastResources=now;
    recorder.event('resources',{...graphics(),width:innerWidth,height:innerHeight,state},now);
    const run=recorder.current;
    document.getElementById('measure-status').textContent=(FALLBACK_GRAPHICS?'Software 3D':'WebGL')+' · '+state+' · '+(run?run.samples.length:0)+' race frames · '+recorder.runs.filter(r=>r.completed).length+' completed races';
  };
  recorder.ready=()=>{recorder.loadingMs=performance.now();recorder.event('ready',graphics());};
  document.getElementById('measure-export').onclick=()=>{
    const value=id=>document.getElementById('measure-'+id).value;
    const metadata={device:value('device'),os:value('os'),browser:value('browser'),hardwareClaim:value('hardware'),notes:value('notes'),
      userAgent:navigator.userAgent,url:location.origin+location.pathname,options:{review:true,lowfx:LOWFX},
      release:document.querySelector('meta[name="zenflow-release"]')?.content??'development',
      exportedAt:new Date().toISOString(),graphics:graphics(),screen:{width:screen.width,height:screen.height,dpr:devicePixelRatio}};
    const blob=new Blob([JSON.stringify(recorder.report(metadata),null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='zenflow-device-measurements.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
  };
  for(const type of ['webglcontextlost','webglcontextrestored'])canvas.addEventListener(type,()=>recorder.interrupt(type));
  for(const type of ['pointercancel','lostpointercapture'])document.addEventListener(type,e=>recorder.event(type,{control:e.target?.id||''}));
  addEventListener('error',e=>recorder.event('error',{message:e.message}));
  addEventListener('unhandledrejection',e=>recorder.event('unhandledrejection',{message:String(e.reason)}));
  return recorder;
}
