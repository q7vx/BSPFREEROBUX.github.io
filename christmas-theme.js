
(()=>{
  "use strict";
  if(window.__zyChristmas2026Theme)return;
  window.__zyChristmas2026Theme=true;
  const d=document,base="/christmas-assets/";
  function addCss(){if(d.querySelector('[data-zy-xmas-css],link[href="/christmas-theme.css"]'))return;const l=d.createElement("link");l.rel="stylesheet";l.href="/christmas-theme.css";l.dataset.zyXmasCss="1";d.head.append(l)}
  function enable(){d.body.classList.add("zy-xmas-2026");addCss();if(!d.querySelector(".zy-xmas-garland")){const g=d.createElement("div");g.className="zy-xmas-garland";g.setAttribute("aria-hidden","true");d.body.append(g)}if(!d.querySelector(".zy-xmas-snow")){const root=d.createElement("div");root.className="zy-xmas-snow";root.setAttribute("aria-hidden","true");for(let i=0;i<32;i++){const n=d.createElement("i");n.style.cssText="--x:"+((i*73.7)%100)+"%;--sz:"+(2+i%5)+"px;--a:"+(0.25+(i%7)/12)+";--dur:"+(8+i%11)+"s;--delay:-"+(i*5%17)+"s;--drift:"+((i%2?1:-1)*(25+i%8*10))+"px";root.append(n)}d.body.append(root)}if(!d.querySelector(".zy-xmas-float")&&!/Christmas\.html/i.test(location.pathname)){const a=d.createElement("a");a.className="zy-xmas-float";a.href="/Christmas.html";a.textContent="Christmas 2026";d.body.append(a)}}
  const audio={ctx:null};
  function clickSound(){if(localStorage.getItem("zy_xmas_sound")==="off")return;try{const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)return;const ctx=audio.ctx||(audio.ctx=new AudioCtx);const osc=ctx.createOscillator(),g=ctx.createGain(),t=ctx.currentTime;osc.type="sine";osc.frequency.setValueAtTime(780,t);osc.frequency.exponentialRampToValueAtTime(1120,t+.11);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.055,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+.20);osc.connect(g).connect(ctx.destination);osc.start(t);osc.stop(t+.21)}catch{}}
  d.addEventListener("pointerup",e=>{if(e.target.closest("button,.zy-xmas-float")&&!e.target.closest("[data-muted]"))clickSound()},{passive:true});
  d.addEventListener("visibilitychange",()=>d.body&&d.body.classList.toggle("zy-xmas-hidden-snow",d.hidden));
  async function decorate(){const avatar=d.querySelector("#profilePfp,#avatarImage,#avatar img,.profileTop .avatar img");if(!avatar)return;let username=new URLSearchParams(location.search).get("username")||localStorage.getItem("username");if(!username)return;try{const api=(await (await fetch("/server.txt",{cache:"no-store"})).text()).trim();if(!api)return;const r=await fetch(api+"/profile?username="+encodeURIComponent(username));if(!r.ok)return;const x=await r.json();const chosen=x.christmas?.selected;if(!chosen)return;const av=avatar.closest(".avatar")||avatar.parentElement;if(!av||!av.parentElement)return;const parent=av.parentElement;const pstyle=getComputedStyle(parent);if(pstyle.position==="static")parent.style.position="relative";let layer=parent.querySelector(".zy-cosmetic-anchor");if(!layer){layer=d.createElement("div");layer.className="zy-cosmetic-anchor";parent.append(layer)}function update(){const a=av.getBoundingClientRect(),p=parent.getBoundingClientRect();layer.style.left=(a.left-p.left)+"px";layer.style.top=(a.top-p.top)+"px";layer.style.width=a.width+"px";layer.style.height=a.height+"px"}update();window.addEventListener("resize",update,{passive:true});layer.replaceChildren();if(chosen.border){const img=d.createElement("img");img.src=base+encodeURIComponent(chosen.border)+".svg";img.className="zy-cosmetic-border";img.alt="";layer.append(img)}if(chosen.pfp){const img=d.createElement("img");img.src=base+encodeURIComponent(chosen.pfp)+".svg";img.className="zy-cosmetic-avatar";img.dataset.deco=chosen.pfp;img.alt="";layer.append(img)}if(chosen.background){const bg=av.closest(".profileHero,.hero,.profileCard,.profile-card")||av.parentElement.closest(".profileHero,.hero,.profileCard");if(bg){bg.classList.add("zy-cosmetic-background");bg.style.backgroundImage="linear-gradient(90deg,#031221cc,#03122144),url('"+base+encodeURIComponent(chosen.background)+".svg')"}}}catch{}}

  const EVENT_START=Date.parse("2026-12-01T00:00:00+01:00");
  const EVENT_END=Date.parse("2026-12-25T00:00:00+01:00");
  let backend=null;
  let status=null;
  let loading=null;
  let timer=null;
  const token=()=>localStorage.getItem("Token")||localStorage.getItem("SessionID")||"";
  function scheduleActive(){
    const now=Date.now();
    return now>=EVENT_START&&now<EVENT_END;
  }
  function disable(){
    d.body.classList.remove("zy-xmas-2026","zy-xmas-hidden-snow");
    for(const el of d.querySelectorAll(".zy-xmas-snow,.zy-xmas-garland,.zy-xmas-float"))el.remove();
  }
  function apply(active){
    if(active)enable();
    else disable();
  }
  function clearAdmin(){
    for(const el of d.querySelectorAll(".zy-xmas-admin-control,.zy-xmas-admin-dialog"))el.remove();
  }
  function adminPanel(){
    if(!status?.admin){clearAdmin();return}
    let trigger=d.querySelector(".zy-xmas-admin-control");
    if(!trigger){
      trigger=d.createElement("button");
      trigger.type="button";
      trigger.className="zy-xmas-admin-control";
      trigger.textContent="Christmas theme controls";
      trigger.addEventListener("click",openAdminPanel);
      d.body.append(trigger);
    }
    trigger.textContent="✦ Christmas theme settings";
  }
  function openAdminPanel(){
    if(!status?.admin)return;
    const existing=d.querySelector(".zy-xmas-admin-dialog");
    if(existing){existing.remove();return}
    const modal=d.createElement("div");
    modal.className="zy-xmas-admin-dialog";
    modal.setAttribute("role","dialog");
    modal.setAttribute("aria-modal","true");
    modal.setAttribute("aria-label","Christmas theme administration");
    const scheduled=status.scheduled;
    modal.innerHTML='<section class="zy-xmas-admin-card"><div class="zy-xmas-admin-heading"><span>DECEMBER 2026</span><button type="button" data-close aria-label="Close">×</button></div><h2>Christmas theme</h2><p>Automatically applies to every member December 1–24, Copenhagen time. Members have no theme switch.</p><div class="zy-xmas-admin-info"><span>Season</span><strong>'+ (scheduled?"Event dates":"Outside season")+'</strong><span>Member theme</span><strong>'+(status.publicActive?"Active":"Inactive")+'</strong></div><div class="zy-xmas-admin-option"><div><b>Theme for all members</b><small>Only applies during December 1–24</small></div><button type="button" data-action="global">'+(status.enabled?"Disable":"Enable")+'</button></div><div class="zy-xmas-admin-option"><div><b>My administrator preview</b><small>Visible only to you; works outside December</small></div><button type="button" data-action="preview">'+(status.preview?"Disable":"Enable")+'</button></div><p class="zy-xmas-admin-error" role="status"></p><button type="button" class="zy-xmas-admin-done" data-close>Done</button></section>';
    d.body.append(modal);
    modal.addEventListener("click",e=>{if(e.target===modal||e.target.closest("[data-close]"))modal.remove()});
    modal.querySelectorAll("[data-action]").forEach(button=>button.addEventListener("click",async()=>{
      const action=button.dataset.action;
      const next=action==="global"?!status.enabled:!status.preview;
      button.disabled=true;
      try{
        const response=await fetch(backend+"/api/theme/christmas/admin",{
          method:"POST",
          headers:{"Content-Type":"application/json",Authorization:token()},
          body:JSON.stringify({action,enabled:next}),
          cache:"no-store"
        });
        const result=await response.json();
        if(!response.ok)throw Error(result.error||"Unable to update Christmas theme");
        status=result;
        apply(result.active);
        modal.remove();
        adminPanel();
        openAdminPanel();
      }catch(e){
        button.disabled=false;
        const msg=modal.querySelector(".zy-xmas-admin-error");
        if(msg)msg.textContent=e.message||"Unable to save setting";
      }
    }));
  }
  async function refresh(){
    if(loading)return loading;
    loading=(async()=>{
      let next=null;
      try{
        if(!backend){
          const r=await fetch("/server.txt",{cache:"no-store"});
          if(!r.ok)throw Error("Backend address unavailable");
          backend=(await r.text()).trim().replace(/\/+$/,"");
          if(!/^https?:\/\//i.test(backend))throw Error("Invalid backend address");
        }
        const r=await fetch(backend+"/api/theme/christmas",{headers:token()?{Authorization:token()}:{},cache:"no-store"});
        if(!r.ok)throw Error("Theme status unavailable");
        next=await r.json();
      }catch{
        next={active:scheduleActive(),scheduled:scheduleActive(),publicActive:scheduleActive(),admin:false};
      }
      status=next;
      apply(next.active===true);
      const seasonalLinkAllowed=next.scheduled===true||next.admin===true;
      for(const a of d.querySelectorAll('a[href$="Christmas.html"],a[href$="/Christmas.html"]')){
        if(!seasonalLinkAllowed){
          a.dataset.zyHolidayHidden="1";
          a.style.setProperty("display","none","important");
          a.setAttribute("aria-hidden","true");
          a.tabIndex=-1;
        }else if(a.dataset.zyHolidayHidden==="1"){
          a.style.removeProperty("display");
          a.removeAttribute("aria-hidden");
          a.removeAttribute("tabindex");
          delete a.dataset.zyHolidayHidden;
        }
      }
      if(!seasonalLinkAllowed&&/\/christmas\.html$/i.test(location.pathname)){
        location.replace("/dashboard.html");
        return next;
      }
      adminPanel();
      if(timer)clearTimeout(timer);
      const now=Date.now();
      const boundary=now<EVENT_START?EVENT_START:now<EVENT_END?EVENT_END:null;
      const interval=boundary?Math.min(60000,Math.max(1000,boundary-now+200)):60000;
      timer=setTimeout(refresh,interval);
      return next;
    })();
    try{return await loading}finally{loading=null}
  }
  function start(){
    refresh();
    setTimeout(decorate,1100);
    d.addEventListener("visibilitychange",()=>{if(d.hidden){d.body.classList.add("zy-xmas-hidden-snow")}else{d.body.classList.remove("zy-xmas-hidden-snow");refresh()}});
  }
  window.ZyphorChristmasTheme={refresh};
  if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",start,{once:true});
  else start();
})();
