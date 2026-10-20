import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVITIES,SESSION_LENGTH } from '../kids/data.js';
import { createSession,answer,advance,validSession,shuffled,selectPiece,placePiece,restoreSession } from '../kids/engine.js';

function solve(s){
  if(s.mode!=='puzzles')return answer(s,s.task.target).session;
  for(const p of ['0','1','2','3'])s=placePiece(selectPiece(s,p),p).session;
  return s;
}

for(const mode of Object.keys(ACTIVITIES)) {
  test(`${mode}: first task is valid, legible and has one correct choice`,()=>{
    const s=createSession(mode,()=>.3);
    assert.ok(validSession(s));assert.equal(s.task.choices.length,mode==='puzzles'?4:3);assert.equal(s.task.target,ACTIVITIES[mode].items[0].id);
    if(mode==='puzzles')assert.deepEqual([...s.task.choices].sort(),['0','1','2','3']);
    else assert.equal(s.task.choices.filter(id=>id===s.task.target).length,1);
  });
  test(`${mode}: ten different targets finish a session without repeats`,()=>{
    let s=createSession(mode,()=>.4);
    for(let i=0;i<SESSION_LENGTH;i++){
      const old=structuredClone(s),target=s.task.target;
      const result=solve(s);assert.equal(result.completed,i+1);
      assert.deepEqual(s,old,'input not mutated');
      assert.equal(answer(result,target),null,'double taps cannot skip tasks');
      s=advance(result,()=>.4);assert.ok(validSession(s));
      if(i<SESSION_LENGTH-1){assert.equal(s.status,'playing');assert.notEqual(s.task.target,target);}else assert.equal(s.status,'finished');
    }
    assert.equal(answer(s,s.task.target),null);assert.equal(s.history.length,SESSION_LENGTH);assert.equal(new Set(s.history).size,SESSION_LENGTH);assert.equal(ACTIVITIES[mode].items.length,SESSION_LENGTH);
  });
}
test('mistakes never reduce progress or remove the target; help can use attempts',()=>{
  const s=createSession(),wrong=s.task.choices.find(id=>id!==s.task.target);
  let next=s;
  for(let i=0;i<100;i++)next=answer(next,wrong).session;
  assert.equal(next.completed,0);assert.equal(next.status,'playing');assert.equal(next.task.target,s.task.target);
  assert.equal(next.task.attempts,100);assert.ok(validSession(next));assert.equal(s.task.attempts,0);
  assert.equal(answer(next,next.task.target).session.completed,1);
});
test('unknown choices and activities are rejected; advancing unsolved tasks does nothing',()=>{
  const s=createSession();assert.equal(answer(s,'not-a-choice'),null);assert.equal(advance(s),s);
  assert.throws(()=>createSession('bad'));assert.throws(()=>createSession('toString'));
});
test('corrupt and inconsistent saves are rejected without throwing',()=>{
  for(const s of [null,{}, {mode:'toString'}, {...createSession(),completed:5}, {...createSession(),rewarded:true}, {...createSession(),status:'finished'}, {...createSession(),task:{target:'x',choices:['x','x','x'],attempts:0}}])assert.equal(validSession(s),false);
});
test('generated tasks remain valid over different seeded sessions',()=>{
  let seed=451;
  const rng=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;};
  const observed=new Set();
  for(let n=0;n<100;n++){
    let s=createSession(Object.keys(ACTIVITIES)[n%6],rng);
    while(s.status!=='finished'){
      assert.ok(validSession(s));observed.add(`${s.mode}:${s.task.target}`);
      s=advance(solve(s),rng);
    }
    assert.ok(validSession({...s,rewarded:true}));
  }
  assert.equal(observed.size,60);
});
test('shuffle does not mutate or lose input elements',()=>{
  const a=['a','b','c'];const b=shuffled(a,()=>0);assert.deepEqual(a,['a','b','c']);assert.deepEqual([...b].sort(),a);assert.notEqual(a,b);
});
test('puzzle requires selecting a piece and matching its position; only piece four completes a task',()=>{
  let s=createSession('puzzles');const old=structuredClone(s);
  assert.equal(placePiece(s,'0'),null);assert.equal(selectPiece(s,'unknown'),null);assert.equal(answer(s,'0'),null);
  s=selectPiece(s,'0');const miss=placePiece(s,'1');assert.equal(miss.kind,'tryAgain');
  assert.equal(miss.session.task.selected,'0');assert.equal(miss.session.completed,0);assert.deepEqual(miss.session.task.placed,[]);
  s=placePiece(miss.session,'0').session;assert.equal(s.task.attempts,0);assert.equal(s.task.selected,null);
  assert.equal(selectPiece(s,'0'),null);assert.deepEqual(old.task.placed,[]);
  for(const p of ['1','2']){s=placePiece(selectPiece(s,p),p).session;assert.equal(s.completed,0);assert.equal(s.status,'playing');}
  const final=placePiece(selectPiece(s,'3'),'3');assert.equal(final.kind,'correct');assert.equal(final.session.completed,1);
  assert.equal(placePiece(final.session,'3'),null);
  const next=advance(final.session);assert.deepEqual(next.task.placed,[]);assert.equal(next.task.selected,null);assert.ok(validSession(next));
});
test('partially assembled puzzle can be serialized and corrupt piece state is rejected',()=>{
  let s=createSession('puzzles');s=placePiece(selectPiece(s,'1'),'1').session;s=selectPiece(s,'2');
  assert.ok(validSession(JSON.parse(JSON.stringify(s))));
  for(const patch of [{placed:['0','0']},{placed:['9']},{selected:'1'},{selected:'9'},{choices:['0','1','2']},{placed:['0','1','2','3']}])assert.equal(validSession({...s,task:{...s.task,...patch}}),false);
});
test('requested animal associations use distinct pictured answers',()=>{
  assert.equal(ACTIVITIES.homes.items.find(i=>i.id==='frog').answerId,'pond');
  assert.equal(ACTIVITIES.homes.items.find(i=>i.id==='bee').answerId,'hive');
  assert.equal(ACTIVITIES.foods.items.find(i=>i.id==='monkey').answerId,'banana');
  assert.equal(ACTIVITIES.foods.items.find(i=>i.id==='bee').answerId,'flower');
  for(const mode of ['homes','foods'])assert.equal(new Set(ACTIVITIES[mode].items.map(i=>i.answerId)).size,ACTIVITIES[mode].items.length);
});

test('the saved deck survives errors, serialization and every advance without repeated targets',()=>{
  for(const mode of Object.keys(ACTIVITIES)){
    let s=createSession(mode),order=[...s.order];
    while(s.status!=='finished'){
      s=restoreSession(JSON.parse(JSON.stringify(s)));assert.deepEqual(s.order,order);
      if(mode!=='puzzles')s=answer(s,s.task.choices.find(id=>id!==s.task.target)).session;
      s=advance(solve(s));
    }
    assert.deepEqual(s.history,order);
  }
});
test('duplicate or inconsistent saved decks are rejected',()=>{
  const s=createSession();
  for(const order of [[],s.order.slice(1),s.order.map(()=>s.order[0]),[...s.order.slice(0,9),'bad'],[...s.order].reverse()]){
    assert.equal(validSession({...s,order}),false);assert.equal(restoreSession({...s,order}),null);
  }
});
function legacy(mode,history,target,status='playing'){
  const s=createSession(mode);delete s.order;s.version=1;s.history=history;s.completed=history.length;s.status=status;
  s.task={...s.task,target};
  if(mode!=='puzzles')s.task.choices=[target,...ACTIVITIES[mode].items.filter(i=>i.id!==target).slice(0,2).map(i=>i.id)];
  return s;
}
test('old walks with repeats migrate once to a unique persisted deck',()=>{
  for(const [status,target] of [['playing','ant'],['feedback','ant'],['playing','dog']]){
    const old=legacy('homes',['frog','ant','bird','ant'],target,status),original=structuredClone(old),s=restoreSession(old,()=>.4);
    assert.ok(validSession(s));assert.deepEqual(old,original);assert.equal(s.version,2);assert.equal(s.completed,3);
    if(status==='playing'&&target==='ant')assert.notEqual(s.task.target,'ant');else assert.equal(s.task.target,target);
    let final=s;if(final.status==='feedback')final=advance(final);
    while(final.status!=='finished')final=advance(solve(final));
    assert.equal(new Set(final.history).size,10);assert.equal(final.history.length,10);assert.deepEqual(restoreSession(s),s);
  }
});
test('old partially assembled puzzle keeps its pieces and selected position',()=>{
  const old=legacy('puzzles',['bunny'],'cat');old.task.placed=['0'];old.task.selected='2';old.task.attempts=2;
  const s=restoreSession(old);assert.ok(validSession(s));assert.deepEqual(s.task,old.task);assert.equal(s.completed,1);
  assert.equal(s.order[1],'cat');
});
test('old final feedback continues the longer walk, finished and corrupt legacy saves do not restart a reward',()=>{
  const old=legacy('homes',['frog','bee','bird','squirrel','dog'],'dog','feedback');const s=restoreSession(old);
  assert.ok(validSession(s));assert.equal(advance(s).status,'playing');assert.equal(advance(s).completed,5);
  assert.equal(restoreSession({...old,status:'finished',rewarded:true}),null);
  assert.equal(restoreSession({...old,history:['bad']}),null);assert.equal(restoreSession(null),null);
});
test('food questions have three choices without familiar alternative edible answers',()=>{
  for(let n=0;n<50;n++){
    let s=createSession('foods');
    while(s.status!=='finished'){
      const target=ACTIVITIES.foods.items.find(i=>i.id===s.task.target);
      assert.equal(s.task.choices.length,3);
      for(const id of s.task.choices.filter(id=>id!==target.id))assert.ok(!target.alsoEats.includes(ACTIVITIES.foods.items.find(i=>i.id===id).answerId));
      s=advance(solve(s));
    }
  }
});
