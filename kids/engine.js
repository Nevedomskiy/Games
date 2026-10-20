import { ACTIVITIES, SESSION_LENGTH, getItem } from './data.js';

export function shuffled(items,rng=Math.random) {
  const copy=[...items];
  for(let i=copy.length-1;i>0;i--){const j=Math.min(i,Math.max(0,Math.floor(rng()*(i+1))));[copy[i],copy[j]]=[copy[j],copy[i]];}
  return copy;
}
export function makeTask(mode,previous=null,rng=Math.random) {
  const items=ACTIVITIES[mode].items;
  const candidates=items.filter(item=>item.id!==previous);
  const target=previous?candidates[Math.min(candidates.length-1,Math.floor(rng()*candidates.length))].id:items[0].id;
  const distractors=shuffled(items.filter(item=>item.id!==target),rng).slice(0,2).map(item=>item.id);
  return {target,choices:shuffled([target,...distractors],rng),attempts:0};
}
export function createSession(mode='animals',rng=Math.random) {
  if(!Object.hasOwn(ACTIVITIES,mode))throw new Error('Unknown activity');
  return {version:1,mode,completed:0,status:'playing',task:makeTask(mode,null,rng),history:[],rewarded:false};
}
export function answer(session,choice) {
  if(session.status!=='playing'||!session.task.choices.includes(choice)) return null;
  if(choice!==session.task.target) return {kind:'tryAgain',session:{...session,task:{...session.task,attempts:session.task.attempts+1}}};
  return {kind:'correct',session:{...session,completed:session.completed+1,status:'feedback',history:[...session.history,choice]}};
}
export function advance(session,rng=Math.random) {
  if(session.status!=='feedback')return session;
  if(session.completed===SESSION_LENGTH)return {...session,status:'finished'};
  return {...session,status:'playing',task:makeTask(session.mode,session.task.target,rng)};
}
export function validSession(s) {
  return Boolean(s&&s.version===1&&ACTIVITIES[s.mode]&&['playing','feedback','finished'].includes(s.status)&&
    Number.isInteger(s.completed)&&s.completed>=0&&s.completed<=SESSION_LENGTH&&
    Array.isArray(s.history)&&s.history.length===s.completed&&s.history.every(id=>getItem(s.mode,id))&&
    typeof s.rewarded==='boolean'&&(!s.rewarded||s.status==='finished')&&
    s.task&&getItem(s.mode,s.task.target)&&Array.isArray(s.task.choices)&&s.task.choices.length===3&&
    new Set(s.task.choices).size===3&&s.task.choices.includes(s.task.target)&&s.task.choices.every(id=>getItem(s.mode,id))&&
    Number.isSafeInteger(s.task.attempts)&&s.task.attempts>=0&&
    (s.status==='playing'?s.completed<SESSION_LENGTH:s.completed>0)&&
    (s.status!=='finished'||s.completed===SESSION_LENGTH)&&
    (s.status==='playing'||s.history.at(-1)===s.task.target));
}
