import { ACTIVITIES, STICKERS, SESSION_LENGTH, getItem } from './data.js';
import { createSession, answer, advance, validSession } from './engine.js';
import { animal, balloon, shape, itemArt, meadow, icon } from './art.js';
import { Platform } from './platform.js';

const $=id=>document.getElementById(id);
const SAVE_KEY='lapki-i-kraski.v1';
const platform=new Platform();
let session=null,album=[],completedSessions=0,sound=true,screen='home',sdkPaused=false;
let audioContext,feedbackTime=0,lastTime=0,toastTimer,storageWarned=false,keyboardUser=false;
let lastReward='bunny';
try {
  const saved=JSON.parse(localStorage.getItem(SAVE_KEY));
  if(validSession(saved?.session))session=saved.session;
  if(Array.isArray(saved?.album))album=[...new Set(saved.album.filter(id=>STICKERS.includes(id)))];
  if(Number.isSafeInteger(saved?.completedSessions)&&saved.completedSessions>=0)completedSessions=saved.completedSessions;
  if(saved?.sound===false)sound=false;
  if(STICKERS.includes(saved?.lastReward))lastReward=saved.lastReward;
}catch{}
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),4500);}
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify({session,album,completedSessions,sound,lastReward}));}catch{if(!storageWarned){storageWarned=true;toast('Браузер не сохраняет альбом. Сейчас всё равно можно играть.');}}}
function active(){return !document.hidden&&!sdkPaused&&!$('modal').open&&document.hasFocus();}
function cancelVoice(){try{window.speechSynthesis?.cancel();}catch{}}
function say(text){
  cancelVoice();
  if(!sound||!active()||!window.speechSynthesis||!window.SpeechSynthesisUtterance)return;
  const utterance=new SpeechSynthesisUtterance(text);utterance.lang='ru-RU';utterance.rate=.82;utterance.pitch=1.12;utterance.volume=.8;
  const voices=speechSynthesis.getVoices();utterance.voice=voices.find(v=>v.lang.startsWith('ru')&&v.localService)||voices.find(v=>v.lang.startsWith('ru'))||null;
  try{speechSynthesis.speak(utterance);}catch{}
}
function chime(success=false){
  if(!sound||!active())return;
  try{
    audioContext||=new(window.AudioContext||window.webkitAudioContext)();audioContext.resume();
    (success?[523.25,659.25,783.99]:[440]).forEach((frequency,i)=>{
      const oscillator=audioContext.createOscillator(),gain=audioContext.createGain(),start=audioContext.currentTime+i*.1;
      oscillator.type='sine';oscillator.frequency.value=frequency;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.035,start+.02);gain.gain.exponentialRampToValueAtTime(.001,start+.3);
      oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start(start);oscillator.stop(start+.31);
    });
  }catch{}
}
function syncPlatform(){if(active()&&screen==='game'&&session?.status==='playing')platform.start();else platform.stop();}
function showScreen(next){cancelVoice();screen=next;for(const name of ['home','game','reward'])$(`${name}-screen`).hidden=name!==next;document.body.dataset.screen=next;syncPlatform();}
function renderHome(){
  $('play-label').textContent=session&&session.status!=='finished'?'Продолжить играть':'Начать играть';
  $('activities').innerHTML=Object.entries(ACTIVITIES).map(([id,activity],i)=>`<button class="activity-card ${id}" data-mode="${id}" aria-label="Играть: ${activity.title}"><div class="activity-art">${id==='animals'?animal('cat'):id==='colors'?`${balloon('#e99a91')}${balloon('#e7c56d')}${balloon('#8eb8b0')}`:`${shape('circle','#a2b9ad')}${shape('triangle','#c0a9cf')}${shape('star','#e4c172')}`}</div><span class="activity-number">0${i+1}</span><div class="activity-copy"><h3>${activity.title}</h3><p>${activity.subtitle}</p></div><span class="activity-arrow">${icon('arrow')}</span></button>`).join('');
  $('album-preview').innerHTML=STICKERS.map(id=>`<span class="little-sticker ${album.includes(id)?'unlocked':'waiting'}" title="${album.includes(id)?getItem('animals',id).label:'Ещё встретимся'}">${animal(id)}</span>`).join('');
}
function renderSound(){$('sound').innerHTML=icon('sound')+(!sound?'<span class="mute-line"></span>':'');$('sound').setAttribute('aria-label',sound?'Выключить звук':'Включить звук');$('sound').setAttribute('aria-pressed',String(sound));}
function renderTask(){
  const activity=ACTIVITIES[session.mode],item=getItem(session.mode,session.task.target);
  $('activity-label').textContent=activity.badge;
  $('flowers').innerHTML=Array.from({length:SESSION_LENGTH},(_,i)=>`<span class="progress-flower ${i<session.completed?'done':''}">${icon('flower')}</span>`).join('');
  $('flowers').setAttribute('aria-label',`Выполнено ${session.completed} из ${SESSION_LENGTH} заданий`);
  const solved=session.status==='feedback';
  const shadow=session.mode!=='colors',help=session.task.attempts>=2;
  $('task-title').textContent=activity.instruction;
  $('target').dataset.kind=shadow?'shadow':'color';
  $('target').dataset.stage=solved?'revealed':help?'hint':'hidden';
  $('target').innerHTML=shadow?`<span class="reference-shadow">${itemArt(session.mode,item.id,true)}</span><span class="reference-color">${itemArt(session.mode,item.id)}</span>`:itemArt(session.mode,item.id);
  // Keep a text equivalent for assistive technology; the visible and spoken
  // riddle does not name the hidden animal or shape before a correct answer.
  $('target').setAttribute('aria-label',`${shadow?'Силуэт':'Образец'}: ${item.label}`);
  $('task-title').previousElementSibling.textContent=shadow?'УЗНАЙ ПО ТЕНИ':'ПОСМОТРИ И ВЫБЕРИ';
  $('task-hint').textContent=shadow?(solved?'Тень ожила — ты нашёл пару!':help?'В тени появилась маленькая подсказка':session.mode==='animals'?'Посмотри на ушки, лапки и хвостик':'Найди фигуру с таким же контуром'):'Нажми на такую же картинку внизу';
  $('choices').innerHTML=session.task.choices.map(id=>`<button class="choice ${solved&&id===item.id?'correct':''} ${session.task.attempts>=2&&id===item.id?'gentle-hint':''}" data-choice="${id}" aria-label="${getItem(session.mode,id).label}" ${solved?'disabled':''}>${itemArt(session.mode,id)}<span class="choice-name">${getItem(session.mode,id).label}</span>${solved&&id===item.id?`<span class="correct-mark">${icon('check')}</span>`:''}</button>`).join('');
  $('feedback').classList.toggle('success',solved);$('feedback').textContent=solved?`Вот и ${item.label.toLocaleLowerCase('ru')}! Здорово получилось!`:help&&shadow?'Подсказка поможет. Попробуем ещё раз?':session.task.attempts?`Посмотри на ${shadow?'тень':'образец'}. Попробуем ещё раз?`:'Не спеши. У тебя всё получится!';
  if(keyboardUser)$('choices').querySelector('button:not(:disabled)')?.focus({preventScroll:true});
}
function promptTask(){
  if(session?.status!=='playing'||screen!=='game')return;
  if(session.mode==='colors')say(getItem(session.mode,session.task.target).prompt);
  else if(session.task.attempts>=2)say('В тени появилась подсказка. Найди подходящую картинку.');
  else say(session.mode==='animals'?'Кто спрятался в тени? Найди зверёнка.':'Чья это тень? Найди подходящую фигуру.');
}
function begin(mode,force=false){if(force||!session||session.mode!==mode||session.status==='finished')session=createSession(mode);feedbackTime=0;save();showScreen('game');renderTask();promptTask();}
function finishSession(){
  if(!session.rewarded){lastReward=STICKERS.find(id=>!album.includes(id))||STICKERS[completedSessions%STICKERS.length];if(!album.includes(lastReward))album.push(lastReward);completedSessions++;session={...session,rewarded:true};save();}
  showScreen('reward');$('sticker-reward').innerHTML=animal(lastReward);$('sticker-name').textContent=getItem('animals',lastReward).label;
  $('reward-caption').textContent=album.length===STICKERS.length?'Все друзья уже в альбоме. Здорово играть вместе!':'Новый маленький друг поселится в твоём альбоме.';
  chime(true);say('Здорово! Все пять заданий готовы. Вот твой маленький друг.');renderHome();
}
function goHome(){showScreen('home');renderHome();save();}
function showModal(content){cancelVoice();audioContext?.suspend();$('modal-content').innerHTML=content;$('modal').showModal();syncPlatform();}
$('play').addEventListener('click',()=>begin(session?.mode||'animals'));
$('activities').addEventListener('click',event=>{const card=event.target.closest('[data-mode]');if(card)begin(card.dataset.mode);});
$('brand').addEventListener('click',goHome);$('home').addEventListener('click',goHome);$('reward-home').addEventListener('click',goHome);$('again').addEventListener('click',()=>begin(session?.mode||'animals',true));
$('repeat').addEventListener('click',()=>{if(session?.status==='playing')promptTask();});
$('sound').addEventListener('click',()=>{sound=!sound;cancelVoice();if(!sound)audioContext?.suspend();save();renderSound();if(sound){if(screen==='game')promptTask();else chime();}});
$('choices').addEventListener('click',event=>{
  const button=event.target.closest('[data-choice]');if(!button||!active())return;
  const result=answer(session,button.dataset.choice);if(!result)return;session=result.session;save();renderTask();
  if(result.kind==='correct'){feedbackTime=0;chime(true);say(`Здорово! Это ${getItem(session.mode,session.task.target).label.toLocaleLowerCase('ru')}.`);syncPlatform();}
  else{const wrong=$('choices').querySelector(`[data-choice="${button.dataset.choice}"]`);wrong?.classList.add('try-again');promptTask();}
});
$('parents').addEventListener('click',()=>showModal(`<div class="modal-symbol">${icon('heart')}</div><h2>Играем вместе</h2><p>В 2–4 года интересно узнавать знакомое по контуру. В «Зверятах» и «Формах» покажите малышу тень и предложите найти того, кто спрятался. В «Цветах» подбираем шарик по цветному образцу.</p><p>После двух неточных нажатий в тени проявляется подсказка. При правильном ответе тень оживает и становится цветной.</p><p>Здесь нет таймера, проигрыша и рекламы. Пять заданий — одна короткая прогулка. Можно остановиться в любой момент.</p><p>Кнопка с динамиком повторяет задание, не называя спрятанного зверёнка или фигуру. Голос зависит от устройства; картинки позволяют играть и без озвучки.</p><p>Альбом сохраняется только в этом браузере. Игра не запрашивает имя, возраст ребёнка или регистрацию.</p>`));
function showAlbum(){showModal(`<span class="eyebrow">МАЛЕНЬКИЕ ДРУЗЬЯ</span><h2>Твой альбом</h2><p>За пять заданий — одна наклейка. Все друзья обязательно встретятся!</p><div class="album-grid">${STICKERS.map(id=>`<div class="album-item ${album.includes(id)?'':'waiting'}">${animal(id)}<span>${album.includes(id)?getItem('animals',id).label:'Ещё встретимся'}</span></div>`).join('')}</div>`);}
$('album-button').addEventListener('click',showAlbum);$('see-album').addEventListener('click',showAlbum);$('close-modal').addEventListener('click',()=>$('modal').close());$('modal').addEventListener('close',syncPlatform);
document.addEventListener('keydown',event=>{if(event.key==='Tab'||event.key.startsWith('Arrow'))keyboardUser=true;});document.addEventListener('pointerdown',()=>{keyboardUser=false;});
function pause(){cancelVoice();audioContext?.suspend();platform.stop();save();}
platform.onPause=()=>{sdkPaused=true;pause();};platform.onResume=()=>{sdkPaused=false;syncPlatform();};
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else syncPlatform();});window.addEventListener('blur',pause);window.addEventListener('focus',syncPlatform);window.addEventListener('pagehide',save);
document.addEventListener('contextmenu',event=>{if(event.target.closest('.choice,.target,.activity-art'))event.preventDefault();});
function tick(timestamp){const dt=Math.min(100,timestamp-lastTime||0);lastTime=timestamp;if(screen==='game'&&session?.status==='feedback'&&active()){feedbackTime+=dt;if(feedbackTime>=1600){session=advance(session);feedbackTime=0;save();if(session.status==='finished')finishSession();else{renderTask();promptTask();syncPlatform();}}}requestAnimationFrame(tick);}
$('brand-picture').innerHTML=animal('bunny');$('hero-art').innerHTML=meadow();$('play-arrow').innerHTML=icon('arrow');$('album-icon').innerHTML=icon('book');$('album-button').innerHTML=icon('book');$('home-icon').innerHTML=icon('home');$('repeat-icon').innerHTML=icon('sound');$('game-heart').innerHTML=icon('heart');$('again-icon').innerHTML=icon('arrow');
renderHome();renderSound();requestAnimationFrame(tick);await platform.init();platform.ready();syncPlatform();
