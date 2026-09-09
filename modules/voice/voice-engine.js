// LexFlow · единый модуль озвучки для Safari/iOS, Chrome/Android и desktop
(() => {
  'use strict';
  const KEY='lexflow_voice_v1';
  const presets={
    'gb-female':{label:'🇬🇧 Британский · женский',lang:'en-GB',female:['serena','kate','martha','susan','stephanie','fiona','samantha'],male:[]},
    'gb-male':{label:'🇬🇧 Британский · мужской',lang:'en-GB',female:[],male:['daniel','oliver','arthur','george','rishi','thomas']},
    'us-female':{label:'🇺🇸 Американский · женский',lang:'en-US',female:['samantha','ava','allison','susan','victoria','zoe','karen'],male:[]},
    'us-male':{label:'🇺🇸 Американский · мужской',lang:'en-US',female:[],male:['alex','aaron','fred','david','james','tom','evan']}
  };
  let voices=[];
  let selected=localStorage.getItem(KEY)||'gb-female';
  const lower=s=>String(s||'').toLowerCase();
  function refresh(){ voices=window.speechSynthesis?window.speechSynthesis.getVoices():[]; return voices; }
  function score(v,p){
    let n=lower(v.name), score=0;
    if(lower(v.lang)===lower(p.lang)) score+=100;
    else if(lower(v.lang).startsWith(lower(p.lang).slice(0,2))) score+=20;
    const desired=[...(p.female||[]),...(p.male||[])];
    desired.forEach((k,i)=>{if(n.includes(k)) score+=80-i;});
    if(n.includes('enhanced')||n.includes('premium')) score+=8;
    return score;
  }
  function getVoice(key=selected){
    refresh(); const p=presets[key]||presets['gb-female'];
    const english=voices.filter(v=>lower(v.lang).startsWith('en'));
    const exact=english.filter(v=>lower(v.lang)===lower(p.lang));
    const pool=exact.length?exact:english;
    return pool.sort((a,b)=>score(b,p)-score(a,p))[0]||voices[0]||null;
  }
  function setPreset(key){ if(!presets[key]) return; selected=key; localStorage.setItem(KEY,key); syncUI(); }
  function syncUI(){ const el=document.getElementById('voicePreset'); if(el) el.value=selected; const info=document.getElementById('voiceResolved'); const v=getVoice(); if(info) info.textContent=v?`На этом устройстве: ${v.name} (${v.lang})`:'Системный английский голос'; }
  function speak(text,opts={}){
    return new Promise(resolve=>{
      if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){resolve();return;}
      window.speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(String(text||''));
      const key=opts.preset||selected, p=presets[key]||presets['gb-female'], v=getVoice(key);
      if(v) u.voice=v; u.lang=(v&&v.lang)||p.lang;
      u.rate=Number.isFinite(opts.rate)?opts.rate:0.82;
      u.pitch=1;
      u.onstart=()=>{if(typeof opts.onstart==='function')opts.onstart();};
      u.onend=()=>{if(typeof opts.onend==='function')opts.onend();resolve();};
      u.onerror=()=>{if(typeof opts.onend==='function')opts.onend();resolve();};
      window.speechSynthesis.resume(); window.speechSynthesis.speak(u);
    });
  }
  function stop(){ if(window.speechSynthesis) window.speechSynthesis.cancel(); }
  function init(){ refresh(); syncUI(); if(window.speechSynthesis){const old=window.speechSynthesis.onvoiceschanged; window.speechSynthesis.onvoiceschanged=()=>{refresh();syncUI();if(typeof old==='function')old();};}}
  window.LexFlowVoice={init,speak,stop,setPreset,getPreset:()=>selected,getVoice,presets,syncUI};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
