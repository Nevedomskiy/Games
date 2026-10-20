import { ACTIVITIES, SESSION_LENGTH, PUZZLE_PARTS, getItem } from './data.js';

export function shuffled(items,rng=Math.random) {
  const copy=[...items];
  for(let i=copy.length-1;i>0;i--){const j=Math.min(i,Math.max(0,Math.floor(rng()*(i+1))));[copy[i],copy[j]]=[copy[j],copy[i]];}
  return copy;
}
export function makeTask(mode,previous=null,rng=Math.random) {
  const items=ACTIVITIES[mode].items;
  const candidates=items.filter(item=>item.id!==previous);
  const target=previous?candidates[Math.min(candidates.length-1,Math.floor(rng()*candidates.length))].id:items[0].id;
  if(mode==='puzzles')return {target,choices:shuffled(PUZZLE_PARTS,rng),attempts:0,placed:[],selected:null};
  const distractors=shuffled(items.filter(item=>item.id!==target),rng).slice(0,2).map(item=>item.id);
  return {target,choices:shuffled([target,...distractors],rng),attempts:0};
}
export function createSession(mode='animals',rng=Math.random) {
  if(!Object.hasOwn(ACTIVITIES,mode))throw new Error('Unknown activity');
  return {version:1,mode,completed:0,status:'playing',task:makeTask(mode,null,rng),history:[],rewarded:false};
}
export function answer(session,choice) {
  if(session.mode==='puzzles'||session.status!=='playing'||!session.task.choices.includes(choice)) return null;
  if(choice!==session.task.target) return {kind:'tryAgain',session:{...session,task:{...session.task,attempts:session.task.attempts+1}}};
  return {kind:'correct',session:{...session,completed:session.completed+1,status:'feedback',history:[...session.history,choice]}};
}
export function selectPiece(session,piece){
  if(session.mode!=='puzzles'||session.status!=='playing'||!session.task.choices.includes(piece)||session.task.placed.includes(piece))return null;
  return {...session,task:{...session.task,selected:piece}};
}
export function placePiece(session,slot){
  if(session.mode!=='puzzles'||session.status!=='playing'||session.task.selected===null||!PUZZLE_PARTS.includes(slot)||session.task.placed.includes(slot))return null;
  if(slot!==session.task.selected)return {kind:'tryAgain',session:{...session,task:{...session.task,attempts:session.task.attempts+1}}};
  const placed=[...session.task.placed,slot],task={...session.task,placed,selected:null,attempts:0};
  if(placed.length<4)return {kind:'piece',session:{...session,task}};
  return {kind:'correct',session:{...session,task,completed:session.completed+1,status:'feedback',history:[...session.history,session.task.target]}};
}
export function advance(session,rng=Math.random) {
  if(session.status!=='feedback')return session;
  if(session.completed===SESSION_LENGTH)return {...session,status:'finished'};
  return {...session,status:'playing',task:makeTask(session.mode,session.task.target,rng)};
}
export function validSession(s) {
  const common=Boolean(s&&s.version===1&&Object.hasOwn(ACTIVITIES,s.mode)&&['playing','feedback','finished'].includes(s.status)&&
    Number.isInteger(s.completed)&&s.completed>=0&&s.completed<=SESSION_LENGTH&&
    Array.isArray(s.history)&&s.history.length===s.completed&&s.history.every(id=>getItem(s.mode,id))&&
    typeof s.rewarded==='boolean'&&(!s.rewarded||s.status==='finished')&&
    s.task&&getItem(s.mode,s.task.target)&&Array.isArray(s.task.choices)&&
    Number.isSafeInteger(s.task.attempts)&&s.task.attempts>=0&&
    (s.status==='playing'?s.completed<SESSION_LENGTH:s.completed>0)&&
    (s.status!=='finished'||s.completed===SESSION_LENGTH)&&
    (s.status==='playing'||s.history.at(-1)===s.task.target));
  if(!common)return false;
  if(s.mode==='puzzles')return s.task.choices.length===4&&new Set(s.task.choices).size===4&&s.task.choices.every(p=>PUZZLE_PARTS.includes(p))&&
    Array.isArray(s.task.placed)&&new Set(s.task.placed).size===s.task.placed.length&&s.task.placed.every(p=>PUZZLE_PARTS.includes(p))&&
    (s.task.selected===null||PUZZLE_PARTS.includes(s.task.selected)&&!s.task.placed.includes(s.task.selected))&&
    (s.status==='playing'?s.task.placed.length<4:s.task.placed.length===4&&s.task.selected===null);
  return s.task.choices.length===3&&new Set(s.task.choices).size===3&&s.task.choices.includes(s.task.target)&&s.task.choices.every(id=>getItem(s.mode,id));
}
