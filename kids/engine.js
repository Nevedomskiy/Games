import { ACTIVITIES, SESSION_LENGTH, PUZZLE_PARTS, getItem } from './data.js';

export function shuffled(items,rng=Math.random) {
  const copy=[...items];
  for(let i=copy.length-1;i>0;i--){const j=Math.min(i,Math.max(0,Math.floor(rng()*(i+1))));[copy[i],copy[j]]=[copy[j],copy[i]];}
  return copy;
}
export function makeTask(mode,target=ACTIVITIES[mode].items[0].id,rng=Math.random) {
  const items=ACTIVITIES[mode].items,item=getItem(mode,target);
  if(mode==='puzzles')return {target,choices:shuffled(PUZZLE_PARTS,rng),attempts:0,placed:[],selected:null};
  const distractors=shuffled(items.filter(other=>other.id!==target&&!item.alsoEats?.includes(other.answerId)),rng).slice(0,2).map(other=>other.id);
  return {target,choices:shuffled([target,...distractors],rng),attempts:0};
}
export function createSession(mode='animals',rng=Math.random) {
  if(!Object.hasOwn(ACTIVITIES,mode))throw new Error('Unknown activity');
  const ids=ACTIVITIES[mode].items.map(item=>item.id);
  // Keep the introductory question familiar; shuffle the rest once and persist it.
  const order=[ids[0],...shuffled(ids.slice(1),rng)].slice(0,SESSION_LENGTH);
  return {version:2,mode,order,completed:0,status:'playing',task:makeTask(mode,order[0],rng),history:[],rewarded:false};
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
  return {...session,status:'playing',task:makeTask(session.mode,session.order[session.completed],rng)};
}
function validState(s,version,limit) {
  const common=Boolean(s&&s.version===version&&Object.hasOwn(ACTIVITIES,s.mode)&&['playing','feedback','finished'].includes(s.status)&&
    Number.isInteger(s.completed)&&s.completed>=0&&s.completed<=limit&&
    Array.isArray(s.history)&&s.history.length===s.completed&&s.history.every(id=>getItem(s.mode,id))&&
    typeof s.rewarded==='boolean'&&(!s.rewarded||s.status==='finished')&&
    s.task&&getItem(s.mode,s.task.target)&&Array.isArray(s.task.choices)&&
    Number.isSafeInteger(s.task.attempts)&&s.task.attempts>=0&&
    (s.status==='playing'?s.completed<limit:s.completed>0)&&
    (s.status!=='finished'||s.completed===limit)&&
    (s.status==='playing'||s.history.at(-1)===s.task.target));
  if(!common)return false;
  if(s.mode==='puzzles')return s.task.choices.length===4&&new Set(s.task.choices).size===4&&s.task.choices.every(p=>PUZZLE_PARTS.includes(p))&&
    Array.isArray(s.task.placed)&&new Set(s.task.placed).size===s.task.placed.length&&s.task.placed.every(p=>PUZZLE_PARTS.includes(p))&&
    (s.task.selected===null||PUZZLE_PARTS.includes(s.task.selected)&&!s.task.placed.includes(s.task.selected))&&
    (s.status==='playing'?s.task.placed.length<4:s.task.placed.length===4&&s.task.selected===null);
  return s.task.choices.length===3&&new Set(s.task.choices).size===3&&s.task.choices.includes(s.task.target)&&s.task.choices.every(id=>getItem(s.mode,id));
}
export function validSession(s) {
  return validState(s,2,SESSION_LENGTH)&&Array.isArray(s.order)&&s.order.length===SESSION_LENGTH&&
    new Set(s.order).size===SESSION_LENGTH&&s.order.every(id=>getItem(s.mode,id))&&
    s.history.every((id,i)=>s.order[i]===id)&&s.task.target===s.order[s.status==='playing'?s.completed:s.completed-1];
}
export function restoreSession(saved,rng=Math.random){
  if(validSession(saved))return saved;
  if(!validState(saved,1,5)||saved.status==='finished')return null;
  // Upgrade old five-question walks, removing repeats but keeping earned progress
  // and the current puzzle where possible. Album/settings are stored separately.
  let history=[...new Set(saved.history)],task=saved.task;
  if(saved.status==='feedback')history=[...history.filter(id=>id!==task.target),task.target];
  const pending=saved.status==='playing'&&!history.includes(task.target)?[task.target]:[];
  const rest=shuffled(ACTIVITIES[saved.mode].items.map(item=>item.id).filter(id=>!history.includes(id)&&!pending.includes(id)),rng);
  const order=[...history,...pending,...rest].slice(0,SESSION_LENGTH);
  if(saved.status==='playing'&&!pending.length)task=makeTask(saved.mode,order[history.length],rng);
  const upgraded={...saved,version:2,order,task,history,completed:history.length,rewarded:false};
  return validSession(upgraded)?upgraded:null;
}
