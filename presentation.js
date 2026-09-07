/* DOM scene cuts. The simulation never advances under a transition curtain. */
const sceneCut={busy:false,committing:false};
function transitionScene(label,commit){
  if(sceneCut.busy)return false;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let curtain=document.getElementById('scene-cut');
  if(!curtain){curtain=document.createElement('div');curtain.id='scene-cut';curtain.setAttribute('role','status');curtain.setAttribute('aria-live','polite');document.body.append(curtain);}
  curtain.textContent=label;curtain.classList.remove('hidden');sceneCut.busy=true;
  if(typeof resetInput==='function')resetInput();
  document.body.classList.add('scene-changing');
  const finish=()=>{curtain.classList.add('hidden');document.body.classList.remove('scene-changing');sceneCut.busy=false;};
  const swap=()=>{
    sceneCut.committing=true;
    try{commit();}
    catch(error){console.error('Scene transition failed',error);finish();throw error;}
    finally{sceneCut.committing=false;}
    // Leave two paints after expensive scene construction before uncovering it.
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(reduced||!curtain.animate){finish();return;}
      curtain.animate([{opacity:1,transform:'translateX(0)'},{opacity:0,transform:'translateX(-12%)'}],{duration:300,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'}).finished.then(finish,finish);
    }));
  };
  curtain.getAnimations?.().forEach(a=>a.cancel());
  if(reduced||!curtain.animate){swap();return true;}
  curtain.animate([{opacity:0,transform:'translateX(12%)'},{opacity:1,transform:'translateX(0)'}],{duration:210,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'}).finished.then(swap,finish);
  return true;
}
// Prevent held keys and repeated clicks from scheduling a second scene change.
for(const type of ['keydown','keyup','pointerdown','click'])document.addEventListener(type,event=>{
  if(!sceneCut.busy)return;event.preventDefault();event.stopImmediatePropagation();
},true);

// A paused/results dialog owns focus; returning to gameplay clears the old key state.
addEventListener('DOMContentLoaded',()=>{
  let active=null,previous=null;
  const dialogs=['pause','results','settings-panel'].map(id=>document.getElementById(id));
  const sync=()=>{
    const next=dialogs.find(el=>!el.classList.contains('hidden'))||null;
    if(next===active)return;
    document.getElementById('hud').inert=!!next;
    if(next){previous=document.activeElement;active=next;(next.querySelector('#resume')||next.querySelector('#rematch')||next.querySelector('input'))?.focus({preventScroll:true});}
    else{active=null;if(previous?.isConnected&&!previous.closest('.hidden'))previous.focus({preventScroll:true});previous=null;}
  };
  const observer=new MutationObserver(sync);dialogs.forEach(el=>observer.observe(el,{attributes:true,attributeFilter:['class']}));
  document.addEventListener('keydown',event=>{
    if(event.key!=='Tab'||!active)return;
    const buttons=[...active.querySelectorAll('button:not(:disabled),input:not(:disabled),summary')];if(!buttons.length)return;
    const first=buttons[0],last=buttons[buttons.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
});
