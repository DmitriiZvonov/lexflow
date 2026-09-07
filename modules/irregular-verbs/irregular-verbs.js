// LexFlow · Неправильные глаголы — логика тренажёра
(() => {
  'use strict';

  const STORAGE_KEY = 'lexflow_irregular_v1';
  const defaults = { blurForms:true, errorSound:true, randomOrder:false };
  let settings = {...defaults};
  let order = [];
  let position = 0;
  let solved = [false,false,false];
  let peeked = [false,false,false];
  let recognition = null;
  let listening = false;
  let manualStop = true;
  let textMode = false;

  const $ = id => document.getElementById(id);
  const data = () => Array.isArray(window.LEXFLOW_IRREGULAR_VERBS) ? window.LEXFLOW_IRREGULAR_VERBS : [];

  function loadSettings() {
    try { settings = {...defaults, ...(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}) }; }
    catch (_) { settings = {...defaults}; }
  }
  function saveSettings() { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); }
  function shuffle(arr) {
    for (let i=arr.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
    return arr;
  }
  function currentVerb() { return data()[order[position]] || null; }
  function normalize(s) {
    return String(s || '').toLowerCase().replace(/[’']/g,'').replace(/[^a-z\s-]/g,' ').replace(/\s+/g,' ').trim();
  }
  function answersFor(form) {
    const source = Array.isArray(form.answers) ? form.answers : String(form.word).split('/').map(s=>s.trim());
    return source.map(normalize).filter(Boolean);
  }
  function formMatched(transcript, form) {
    const heard = normalize(transcript);
    if (!heard) return false;
    const words = heard.split(' ');
    return answersFor(form).some(ans => heard === ans || words.includes(ans));
  }

  function buildOrder() {
    order = data().map((_,i)=>i);
    if (settings.randomOrder) shuffle(order);
    position = 0;
  }

  function openTrainer() {
    if (!data().length) { if (window.showToast) showToast('Нет данных неправильных глаголов'); return; }
    loadSettings();
    buildOrder();
    syncSettingsUI();
    resetVerb();
    if (window.showScreen) showScreen('irregularScreen');
  }

  function closeTrainer() {
    stopListening();
    if (window.showScreen) showScreen('homeScreen');
  }

  function resetVerb() {
    solved = [false,false,false];
    peeked = [false,false,false];
    render();
  }

  function render() {
    const verb = currentVerb();
    if (!verb) return;
    $('ivRussian').textContent = verb.ru;
    $('ivCount').textContent = `${position+1} / ${order.length}`;
    $('ivProgressFill').style.width = `${((position+1)/order.length)*100}%`;
    $('ivHeard').textContent = '';
    if ($('ivTextInput')) $('ivTextInput').value = '';

    verb.forms.forEach((form,i) => {
      const card = $(`ivForm${i}`);
      $(`ivWord${i}`).textContent = form.word;
      $(`ivPhonetic${i}`).textContent = `${form.ipa} · ${form.ru}`;
      card.classList.remove('iv-blurred','iv-peek','iv-correct');
      if (solved[i]) card.classList.add('iv-correct');
      else if (peeked[i]) card.classList.add('iv-peek');
      else if (settings.blurForms) card.classList.add('iv-blurred');
    });

    $('ivNextBtn').disabled = !solved.every(Boolean);
    if (solved.every(Boolean)) {
      $('ivMicStatus').textContent = 'Все три формы правильные ✓';
    } else if (textMode) {
      $('ivMicStatus').textContent = 'Введи английскую форму текстом';
    } else {
      $('ivMicStatus').textContent = listening ? 'Слушаю… произнеси любую из трёх форм' : 'Нажми на микрофон и произнеси форму';
    }
  }

  function revealForm(index) {
    if (solved[index]) return;
    if (!settings.blurForms) return;
    peeked[index] = !peeked[index];
    render();
  }

  function processAnswer(answer, source='voice') {
    const verb = currentVerb();
    if (!verb) return false;

    const cleanAnswer = String(answer || '').trim();
    if (!cleanAnswer) return false;

    const newlyMatched = [];
    verb.forms.forEach((form,i) => {
      if (!solved[i] && formMatched(cleanAnswer, form)) {
        solved[i] = true;
        peeked[i] = false;
        newlyMatched.push(i);
      }
    });

    if (newlyMatched.length) {
      render();
      if ($('ivHeard')) {
        $('ivHeard').textContent = source === 'text'
          ? `Правильно: ${cleanAnswer} ✓`
          : `Распознано: “${cleanAnswer}”`;
        $('ivHeard').classList.remove('iv-answer-error');
        $('ivHeard').classList.add('iv-answer-ok');
      }
      if (solved.every(Boolean)) $('ivMicStatus').textContent = 'Все три формы правильные ✓';
      return true;
    }

    if ($('ivHeard')) {
      $('ivHeard').textContent = source === 'text' ? `Неверно: ${cleanAnswer}` : `Распознано: “${cleanAnswer}”`;
      $('ivHeard').classList.remove('iv-answer-ok');
      $('ivHeard').classList.add('iv-answer-error');
    }
    signalError();
    return false;
  }

  function processTranscript(transcript) {
    return processAnswer(transcript, 'voice');
  }

  function signalError() {
    const el = $('ivRussian');
    el.classList.remove('iv-error'); void el.offsetWidth; el.classList.add('iv-error');
    if (settings.errorSound) playErrorSound();
  }

  function playErrorSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type='sine'; osc.frequency.setValueAtTime(180,ctx.currentTime);
      gain.gain.setValueAtTime(.09,ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.16);
      osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime+.17);
      setTimeout(()=>ctx.close().catch(()=>{}),250);
    } catch (_) {}
  }

  function setupRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return false;
    recognition = new SR();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;
    recognition.onresult = e => {
      for (let i=e.resultIndex;i<e.results.length;i++) {
        if (!e.results[i].isFinal) continue;
        const candidates = Array.from(e.results[i]).map(x=>x.transcript);
        const verb = currentVerb();
        const best = candidates.find(t => verb && verb.forms.some((f,idx)=>!solved[idx] && formMatched(t,f))) || candidates[0];
        processTranscript(best);
      }
    };
    recognition.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        listening=false; manualStop=true; updateMicUI();
        $('ivMicStatus').textContent='Нет доступа к микрофону. Разреши микрофон для этой страницы.';
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        $('ivMicStatus').textContent='Не удалось распознать речь. Нажми микрофон ещё раз.';
      }
    };
    recognition.onend = () => {
      if (listening && !manualStop) {
        try { recognition.start(); } catch (_) {}
      } else updateMicUI();
    };
    return true;
  }

  function toggleTextMode() {
    textMode = !textMode;
    const panel = $('ivTextPanel');
    const btn = $('ivTextModeBtn');
    if (panel) panel.classList.toggle('hidden', !textMode);
    if (btn) btn.classList.toggle('active', textMode);
    if (textMode) {
      stopListening();
      if ($('ivHeard')) {
        $('ivHeard').textContent = '';
        $('ivHeard').classList.remove('iv-answer-ok','iv-answer-error');
      }
      if ($('ivMicStatus')) $('ivMicStatus').textContent = 'Введи английскую форму текстом';
      setTimeout(() => { if ($('ivTextInput')) $('ivTextInput').focus(); }, 0);
    } else {
      if ($('ivMicStatus')) $('ivMicStatus').textContent = 'Нажми на микрофон и произнеси форму';
    }
  }

  function submitText() {
    const input = $('ivTextInput');
    if (!input) return false;
    const answer = input.value.trim();
    if (!answer) {
      input.focus();
      return false;
    }

    const ok = processAnswer(answer, 'text');
    input.classList.remove('iv-input-ok','iv-input-error');
    void input.offsetWidth;
    input.classList.add(ok ? 'iv-input-ok' : 'iv-input-error');

    input.value = '';
    input.focus();
    return ok;
  }

  function handleTextKey(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitText();
    }
  }

  function toggleListening() { listening ? stopListening() : startListening(); }
  function startListening() {
    if (textMode) {
      textMode = false;
      if ($('ivTextPanel')) $('ivTextPanel').classList.add('hidden');
      if ($('ivTextModeBtn')) $('ivTextModeBtn').classList.remove('active');
    }
    if (!recognition && !setupRecognition()) {
      $('ivMicStatus').textContent='Этот браузер не поддерживает распознавание речи. Открой LexFlow в Google Chrome.';
      return;
    }
    manualStop=false; listening=true; updateMicUI();
    try { recognition.start(); }
    catch (_) { listening=false; manualStop=true; updateMicUI(); }
  }
  function stopListening() {
    manualStop=true; listening=false; updateMicUI();
    if (recognition) { try { recognition.stop(); } catch (_) {} }
  }
  function updateMicUI() {
    const btn=$('ivMicBtn'); if (!btn) return;
    btn.classList.toggle('iv-listening', listening);
    btn.textContent = listening ? '■' : '🎤';
    if ($('ivMicStatus')) $('ivMicStatus').textContent = listening ? 'Слушаю… произнеси любую из трёх форм' : 'Нажми на микрофон и произнеси форму';
  }

  function nextVerb() {
    if (!solved.every(Boolean)) return;
    stopListening();
    if (position < order.length-1) position++;
    else { if (settings.randomOrder) buildOrder(); else position=0; }
    resetVerb();
  }

  function toggleSettings() { $('ivSettings').classList.toggle('hidden'); }
  function syncSettingsUI() {
    $('ivBlurToggle').checked=!!settings.blurForms;
    $('ivSoundToggle').checked=!!settings.errorSound;
    $('ivRandomToggle').checked=!!settings.randomOrder;
  }
  function updateSetting(name, value) {
    settings[name]=!!value; saveSettings();
    if (name==='randomOrder') buildOrder();
    render();
  }

  function bindTextControls() {
    const checkBtn = $('ivCheckBtn');
    const input = $('ivTextInput');
    if (checkBtn && !checkBtn.dataset.ivBound) {
      checkBtn.addEventListener('click', submitText);
      checkBtn.dataset.ivBound = '1';
    }
    if (input && !input.dataset.ivBound) {
      input.addEventListener('keydown', handleTextKey);
      input.dataset.ivBound = '1';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindTextControls);
  else bindTextControls();

  window.IrregularTrainer = { open:openTrainer, close:closeTrainer, revealForm, toggleListening, toggleTextMode, submitText, handleTextKey, next:nextVerb, toggleSettings, updateSetting };
})();
