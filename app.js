const CONFIG = {
  streams: [
    { name: "SEÑAL 1", url: "https://app.radio593.com/hls/u96/r81/playlist.m3u8", type: "hls" },
    { name: "SEÑAL 2", url: "https://streampanel.online/8082/stream", type: "auto" }
  ],
  whatsapp: "56978781300", // EJEMPLO: 56912345678
  website: "https://www.radioproyeccion.cl",
  shareText: "Escucha Radio Proyección 100.1 FM Stereo · Siempre Contigo",
  schedule: [
    { days:[1,2,3,4,5], start:"10:00", end:"13:00", name:"La Gran Mañana", subtitle:"En vivo" },
    { days:[4], start:"13:00", end:"14:00", name:"Cultivando Raíces", subtitle:"Espacio especial" }
  ]
};

const audio = document.getElementById("radioAudio");
let hls = null, currentStream = 0, playing = false, muted = false, sleepTimer = null, deferredPrompt = null;

const $ = id => document.getElementById(id);
const playBtn = $("playBtn"), statusEl = $("connectionStatus"), badge = $("streamBadge");

function setStatus(text){ statusEl.textContent = text; }
function setPlayIcon(){ playBtn.textContent = playing ? "❚❚" : "▶"; }
function streamLabel(){ badge.textContent = CONFIG.streams[currentStream].name; $("streamName").textContent = `Automático · ${CONFIG.streams[currentStream].name}`; }

function destroyHls(){ if(hls){ hls.destroy(); hls=null; } }

function loadStream(index){
  currentStream = index;
  destroyHls();
  const stream = CONFIG.streams[index];
  streamLabel();
  setStatus("Conectando…");

  if(stream.type === "hls" && window.Hls && Hls.isSupported()){
    hls = new Hls({ enableWorker:true, lowLatencyMode:true });
    hls.loadSource(stream.url);
    hls.attachMedia(audio);
    hls.on(Hls.Events.MANIFEST_PARSED, ()=> {
      setStatus("Señal conectada");
      if(playing) audio.play().catch(handlePlayError);
    });
    hls.on(Hls.Events.ERROR, (_, data)=> {
      if(data.fatal) failover();
    });
  } else {
    audio.src = stream.url;
    audio.load();
    audio.oncanplay = () => { setStatus("Señal conectada"); if(playing) audio.play().catch(handlePlayError); };
  }
}

function handlePlayError(){
  playing = false; setPlayIcon(); setStatus("No fue posible iniciar la señal");
}

function failover(){
  const next = (currentStream + 1) % CONFIG.streams.length;
  if(next !== currentStream){
    setStatus("Cambiando a señal de respaldo…");
    loadStream(next);
  } else setStatus("Señal temporalmente no disponible");
}

async function togglePlay(){
  if(!playing){
    playing = true; setPlayIcon();
    if(!audio.src && !hls) loadStream(currentStream);
    try { await audio.play(); setStatus("En vivo"); }
    catch(e){ handlePlayError(); }
  } else {
    audio.pause(); playing=false; setPlayIcon(); setStatus("Pausado");
  }
}
playBtn.addEventListener("click", togglePlay);
audio.addEventListener("playing", ()=>{ playing=true; setPlayIcon(); setStatus("En vivo"); });
audio.addEventListener("waiting", ()=> setStatus("Reconectando…"));
audio.addEventListener("error", ()=> { if(playing) failover(); });

$("volume").addEventListener("input", e=>{ audio.volume = Number(e.target.value); muted = audio.volume===0; });
$("volumeBtn").addEventListener("click", ()=>{ muted=!muted; audio.muted=muted; $("volumeBtn").textContent=muted?"🔇":"🔊"; });

function showScreen(id){
  document.querySelectorAll(".screen").forEach(s=>s.classList.toggle("active",s.id===id));
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.screen===id));
  window.scrollTo({top:0,behavior:"smooth"});
}
document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>showScreen(b.dataset.screen)));

function openSleep(){ $("sleepModal").classList.remove("hidden"); }
function closeSleep(){ $("sleepModal").classList.add("hidden"); }
$("sleepBtn").onclick=openSleep; $("sleepSetting").onclick=openSleep;
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=closeSleep);
document.querySelectorAll("[data-minutes]").forEach(b=>b.onclick=()=>{
  const mins=Number(b.dataset.minutes);
  clearTimeout(sleepTimer);
  sleepTimer=setTimeout(()=>{ audio.pause(); playing=false; setPlayIcon(); setStatus("Apagado por temporizador"); $("sleepStatus").textContent="Desactivado"; }, mins*60000);
  $("sleepStatus").textContent=`Activo · ${mins} min`;
  closeSleep();
});
$("disableSleep").onclick=()=>{ clearTimeout(sleepTimer); $("sleepStatus").textContent="Desactivado"; closeSleep(); };

function openWhatsApp(){
  if(!CONFIG.whatsapp){ alert("Agrega el número oficial de WhatsApp en CONFIG.whatsapp dentro de app.js"); return; }
  const msg=encodeURIComponent("Hola Radio Proyección, estoy escuchando la señal en vivo.");
  window.open(`https://wa.me/${CONFIG.whatsapp}?text=${msg}`,"_blank");
}
$("whatsappBtn").onclick=openWhatsApp;
document.querySelector('[data-action="whatsapp"]').onclick=openWhatsApp;
function openWebsite(){ window.open(CONFIG.website,"_blank"); }
$("websiteBtn").onclick=openWebsite;
document.querySelector('[data-action="website"]').onclick=openWebsite;

async function share(){
  if(navigator.share) await navigator.share({title:"Radio Proyección",text:CONFIG.shareText,url:location.href});
  else { await navigator.clipboard.writeText(location.href); alert("Enlace copiado"); }
}
document.querySelector('[data-action="share"]').onclick=share;
$("shareSetting").onclick=share;

$("streamSwitch").onclick=()=>{ loadStream((currentStream+1)%CONFIG.streams.length); };

function nowMinutes(){ const d=new Date(); return d.getHours()*60+d.getMinutes(); }
function timeToMin(t){ const [h,m]=t.split(":").map(Number); return h*60+m; }
function updateSchedule(){
  const day=new Date().getDay(), now=nowMinutes();
  const active=CONFIG.schedule.find(s=>s.days.includes(day)&&now>=timeToMin(s.start)&&now<timeToMin(s.end));
  if(active){ $("onAirName").textContent=active.name; $("onAirTime").textContent=`${active.start} - ${active.end}`; }
  const list=[...CONFIG.schedule].sort((a,b)=>a.start.localeCompare(b.start));
  $("scheduleList").innerHTML=list.map(s=>`<div class="schedule-item"><div class="schedule-time">${s.start}</div><div><strong>${s.name}</strong><span>${s.subtitle}</span></div></div>`).join("") || `<div class="schedule-item"><div><strong>Programación próximamente</strong></div></div>`;
}
updateSchedule(); setInterval(updateSchedule,60000);

window.addEventListener("beforeinstallprompt",e=>{ e.preventDefault(); deferredPrompt=e; $("installBtn").classList.remove("hidden"); });
$("installBtn").onclick=async()=>{ if(!deferredPrompt)return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; $("installBtn").classList.add("hidden"); };

if("serviceWorker" in navigator) window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
audio.volume=.8; loadStream(0); streamLabel();
