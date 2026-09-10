// LexFlow · Неправильные глаголы — модуль упражнений
(() => {
'use strict';
const STORAGE_KEY='lexflow_irregular_v1';
const defaults={blurForms:true,errorSound:true,randomOrder:false,quizSpeechRate:.72};
let settings={...defaults},order=[],position=0,solved=[false,false,false],peeked=[false,false,false];
let recognition=null,listening=false,manualStop=true,textMode=false,mode='menu',quizTarget=0,quizLocked=false,quizRevealed=false;
const $=id=>document.getElementById(id), data=()=>Array.isArray(window.LEXFLOW_IRREGULAR_VERBS)?window.LEXFLOW_IRREGULAR_VERBS:[];
const normalize=s=>String(s||'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z\s-]/g,' ').replace(/\s+/g,' ').trim();
const homophones={knew:['new'],know:['no'],read:['red'],write:['right','rite'],won:['one'],blew:['blue'],heard:['herd'],made:['maid'],meet:['meat'],buy:['bye','by'],saw:['so'],sent:['cent','scent'],threw:['through'],flown:['floan']};
function loadSettings(){try{settings={...defaults,...(JSON.parse(localStorage.getItem(STORAGE_KEY))||{})}}catch(_){settings={...defaults}}}
function saveSettings(){localStorage.setItem(STORAGE_KEY,JSON.stringify(settings))}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function currentVerb(){return data()[order[position]]||null}
function answersFor(form){const src=Array.isArray(form.answers)?form.answers:String(form.word).split('/').map(s=>s.trim());return src.map(normalize).filter(Boolean)}
function formMatched(transcript,form){const heard=normalize(transcript);if(!heard)return false;const words=heard.split(' ');return answersFor(form).some(ans=>heard===ans||words.includes(ans)||(homophones[ans]||[]).some(a=>heard===a||words.includes(a)))}
function buildOrder(){order=data().map((_,i)=>i);if(settings.randomOrder)shuffle(order);position=0}
function openModule(){if(!data().length){window.showToast&&showToast('Нет данных неправильных глаголов');return}loadSettings();syncSettingsUI();mode='menu';showModuleView();window.showScreen&&showScreen('irregularScreen')}
function close(){stopListening();window.LexFlowVoice&&LexFlowVoice.stop();window.showScreen&&showScreen('homeScreen')}
function navigateBack(){const panel=$('ivSettings');if(panel&&!panel.classList.contains('hidden')){toggleSettings(false);return}if(mode==='menu')close();else backToMenu()}
function showModuleView(){
 $('ivModuleMenu').classList.toggle('hidden',mode!=='menu');$('ivTrainerView').classList.toggle('hidden',mode==='menu');
 $('ivSettingsBtn').classList.toggle('hidden',mode==='menu');
 const nav=$('ivNavTitle');if(nav)nav.textContent=mode==='menu'?'Неправильные глаголы':mode==='voice'?'Назови три формы':'Определи форму';
 document.getElementById('irregularScreen').classList.toggle('iv-quiz-mode',mode==='quiz');
 if(mode==='menu'){$('ivSettings').classList.add('hidden');return}
 const hint=$('ivHint');if(hint)hint.textContent=mode==='voice'?'Три формы английского глагола':'';
 $('ivVoiceControls').classList.toggle('hidden',mode!=='voice');$('ivQuizStatus').classList.toggle('hidden',mode!=='quiz');$('ivNextBtn').classList.toggle('hidden',mode!=='voice');
}
function startVoice(){mode='voice';buildOrder();resetVerb();showModuleView()}
function startQuiz(){mode='quiz';buildOrder();showModuleView();prepareQuiz()}
function backToMenu(){stopListening();window.LexFlowVoice&&LexFlowVoice.stop();mode='menu';showModuleView()}
function resetVerb(){solved=[false,false,false];peeked=[false,false,false];render()}
function render(){const verb=currentVerb();if(!verb)return;$('ivRussian').textContent=verb.ru;$('ivCount').textContent=`${position+1} / ${order.length}`;$('ivProgressFill').style.width=`${((position+1)/order.length)*100}%`;$('ivHeard').textContent='';
 verb.forms.forEach((form,i)=>{const card=$(`ivForm${i}`);$(`ivWord${i}`).textContent=form.word;$(`ivPhonetic${i}`).textContent=`${form.ipa} · ${form.ru}`;card.classList.remove('iv-blurred','iv-peek','iv-correct','iv-wrong','iv-quiz-choice');
 const revealed=mode==='quiz'?quizRevealed:(solved[i]||peeked[i]||!settings.blurForms);
 if(solved[i])card.classList.add('iv-correct');else if(mode!=='quiz'&&peeked[i])card.classList.add('iv-peek');else if(!revealed)card.classList.add('iv-blurred');
 const sp=$(`ivSpeak${i}`);if(sp)sp.classList.toggle('hidden',!revealed);
 if(mode==='quiz')card.classList.add('iv-quiz-choice');});
 if(mode==='voice'){$('ivNextBtn').disabled=!solved.every(Boolean);$('ivMicStatus').textContent=solved.every(Boolean)?'Все три формы правильные':textMode?'Введи английскую форму текстом':listening?'Слушаю… произнеси любую из трёх форм':'Нажми на микрофон и произнеси форму'}
}
function revealForm(i){if(mode==='quiz'){chooseQuiz(i);return}if(solved[i]||!settings.blurForms)return;peeked[i]=!peeked[i];render()}
function speakForm(i,e){if(e)e.stopPropagation();const v=currentVerb();if(!v)return;window.LexFlowVoice&&LexFlowVoice.speak(answersFor(v.forms[i])[0]||v.forms[i].word,{rate:.72})}
function processAnswer(answer,source='voice'){const verb=currentVerb();if(!verb)return false;const clean=String(answer||'').trim();if(!clean)return false;const matched=[];verb.forms.forEach((f,i)=>{if(!solved[i]&&formMatched(clean,f)){solved[i]=true;peeked[i]=false;matched.push(i)}});if(matched.length){render();$('ivHeard').textContent=source==='text'?`Правильно: ${clean}`:`Распознано: “${clean}”`;$('ivHeard').className='iv-heard iv-answer-ok';return true}$('ivHeard').textContent=source==='text'?`Неверно: ${clean}`:`Распознано: “${clean}”`;$('ivHeard').className='iv-heard iv-answer-error';signalError();return false}
function signalError(){const el=$('ivRussian');el.classList.remove('iv-error');void el.offsetWidth;el.classList.add('iv-error');if(settings.errorSound)playErrorSound()}
function playErrorSound(){try{const A=window.AudioContext||window.webkitAudioContext;if(!A)return;const c=new A(),o=c.createOscillator(),g=c.createGain();o.frequency.value=180;g.gain.setValueAtTime(.09,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.16);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.17);setTimeout(()=>c.close().catch(()=>{}),250)}catch(_){}}
function setupRecognition(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)return false;recognition=new SR();recognition.lang='en-US';recognition.continuous=true;recognition.interimResults=true;recognition.maxAlternatives=10;
 recognition.onspeechstart=()=>setMicPulse(true);recognition.onspeechend=()=>setMicPulse(false);recognition.onsoundstart=()=>setMicPulse(true);recognition.onsoundend=()=>setMicPulse(false);
 recognition.onresult=e=>{setMicPulse(true);for(let i=e.resultIndex;i<e.results.length;i++){if(!e.results[i].isFinal)continue;const candidates=Array.from(e.results[i]).map(x=>x.transcript),verb=currentVerb();const best=candidates.find(t=>verb&&verb.forms.some((f,idx)=>!solved[idx]&&formMatched(t,f)))||candidates[0];processAnswer(best,'voice')}setTimeout(()=>setMicPulse(false),350)};
 recognition.onerror=e=>{setMicPulse(false);if(e.error==='not-allowed'||e.error==='service-not-allowed'){listening=false;manualStop=true;updateMicUI();$('ivMicStatus').textContent='Нет доступа к микрофону. Разреши микрофон для этой страницы.'}else if(e.error!=='no-speech'&&e.error!=='aborted')$('ivMicStatus').textContent='Не удалось распознать речь. Нажми микрофон ещё раз.'};recognition.onend=()=>{setMicPulse(false);if(listening&&!manualStop){try{recognition.start()}catch(_){}}else updateMicUI()};return true}
function setMicPulse(on){const b=$('ivMicBtn');if(b)b.classList.toggle('iv-hearing',!!on&&listening)}
function toggleListening(){listening?stopListening():startListening()}
function startListening(){if(textMode){textMode=false;$('ivTextPanel').classList.add('hidden');$('ivTextModeBtn').classList.remove('active')}if(!recognition&&!setupRecognition()){$('ivMicStatus').textContent='Распознавание речи недоступно в этом браузере.';return}manualStop=false;listening=true;updateMicUI();try{recognition.start()}catch(_){listening=false;manualStop=true;updateMicUI()}}
function stopListening(){manualStop=true;listening=false;setMicPulse(false);updateMicUI();if(recognition)try{recognition.stop()}catch(_){}}
function updateMicUI(){const b=$('ivMicBtn');if(!b)return;b.classList.toggle('iv-listening',listening);b.textContent=listening?'■':'🎤';if(mode==='voice'&&!solved.every(Boolean))$('ivMicStatus').textContent=listening?'Слушаю… произнеси любую из трёх форм':'Нажми на микрофон и произнеси форму'}
function toggleTextMode(){textMode=!textMode;$('ivTextPanel').classList.toggle('hidden',!textMode);$('ivTextModeBtn').classList.toggle('active',textMode);if(textMode){stopListening();$('ivHeard').textContent='';$('ivMicStatus').textContent='Введи английскую форму текстом';setTimeout(()=>$('ivTextInput').focus(),0)}else $('ivMicStatus').textContent='Нажми на микрофон и произнеси форму'}
function submitText(){const i=$('ivTextInput');if(!i||!i.value.trim())return false;const ok=processAnswer(i.value.trim(),'text');i.classList.remove('iv-input-ok','iv-input-error');void i.offsetWidth;i.classList.add(ok?'iv-input-ok':'iv-input-error');i.value='';i.focus();return ok}
function nextVerb(){if(mode!=='voice'||!solved.every(Boolean))return;stopListening();position=position<order.length-1?position+1:0;resetVerb()}
function prepareQuiz(){quizLocked=false;quizRevealed=false;solved=[false,false,false];peeked=[false,false,false];quizTarget=Math.floor(Math.random()*3);render();const m=$('ivQuizMessage');if(m)m.textContent='';setTimeout(playQuizPrompt,350)}
function playQuizPrompt(){const v=currentVerb();if(!v)return;const word=answersFor(v.forms[quizTarget])[0]||v.forms[quizTarget].word;window.LexFlowVoice&&LexFlowVoice.speak(word,{rate:Number(settings.quizSpeechRate)||.72,onstart:()=>{$('ivQuizReplay').classList.add('iv-speaking')},onend:()=>{$('ivQuizReplay').classList.remove('iv-speaking')}})}
function chooseQuiz(i){if(quizLocked)return;const card=$(`ivForm${i}`),m=$('ivQuizMessage');if(i!==quizTarget){card.classList.add('iv-wrong');if(m)m.textContent='Попробуй ещё раз';signalError();setTimeout(()=>card.classList.remove('iv-wrong'),550);return}quizLocked=true;quizRevealed=true;solved[i]=true;render();if(m)m.textContent='Правильно';setTimeout(()=>{if(position<order.length-1){position++;prepareQuiz()}else{mode='menu';showModuleView();window.showToast&&showToast('Упражнение завершено')}},1500)}
function toggleSettings(force){const panel=$('ivSettings');if(!panel)return;const show=typeof force==='boolean'?force:panel.classList.contains('hidden');panel.classList.toggle('hidden',!show)}
function syncSettingsUI(){$('ivBlurToggle').checked=!!settings.blurForms;$('ivSoundToggle').checked=!!settings.errorSound;$('ivRandomToggle').checked=!!settings.randomOrder;const r=$('ivQuizRate'),n=$('ivQuizRateNum'),l=$('ivQuizRateValue');const v=Math.max(.2,Math.min(1,Number(settings.quizSpeechRate)||.72));settings.quizSpeechRate=v;if(r)r.value=v;if(n)n.value=v.toFixed(2);if(l)l.textContent=v.toFixed(2)+'×';paintQuizRate()}
function updateSetting(n,v){settings[n]=!!v;saveSettings();if(n==='randomOrder')buildOrder();render()}
function paintQuizRate(){const r=$('ivQuizRate');if(!r)return;const min=Number(r.min),max=Number(r.max),v=Number(r.value),pct=((v-min)/(max-min))*100;r.style.background=`linear-gradient(90deg,var(--accent) 0 ${pct}%,var(--bg3) ${pct}% 100%)`}
function updateQuizRate(source){const r=$('ivQuizRate'),n=$('ivQuizRateNum'),l=$('ivQuizRateValue');if(!r||!n)return;let v=source==='number'?Number(n.value):Number(r.value);if(!Number.isFinite(v))return;v=Math.max(.2,Math.min(1,v));v=Math.round(v*100)/100;r.value=v;n.value=v.toFixed(2);settings.quizSpeechRate=v;if(l)l.textContent=v.toFixed(2)+'×';paintQuizRate();saveSettings()}
function bind(){const c=$('ivCheckBtn'),i=$('ivTextInput');if(c&&!c.dataset.bound){c.addEventListener('click',submitText);c.dataset.bound=1}if(i&&!i.dataset.bound){i.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submitText()}});i.dataset.bound=1}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
window.IrregularTrainer={open:openModule,close,navigateBack,backToMenu,startVoice,startQuiz,revealForm,speakForm,toggleListening,toggleTextMode,submitText,next:nextVerb,toggleSettings,updateSetting,updateQuizRate,playQuizPrompt};
})();
