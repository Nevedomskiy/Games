import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVITIES,SESSION_LENGTH } from '../kids/data.js';
import { createSession,answer,advance,validSession,shuffled } from '../kids/engine.js';

for(const mode of Object.keys(ACTIVITIES)) {
  test(`${mode}: first task is valid, legible and has one correct choice`,()=>{
    const s=createSession(mode,()=>.3);
    assert.ok(validSession(s));assert.equal(s.task.choices.length,3);assert.equal(s.task.target,ACTIVITIES[mode].items[0].id);
    assert.equal(s.task.choices.filter(id=>id===s.task.target).length,1);
  });
  test(`${mode}: five solved tasks finish a session without repeating adjacent targets`,()=>{
    let s=createSession(mode,()=>.4);
    for(let i=0;i<SESSION_LENGTH;i++){
      const old=structuredClone(s),target=s.task.target;
      const result=answer(s,target);assert.equal(result.kind,'correct');assert.equal(result.session.completed,i+1);
      assert.deepEqual(s,old,'input not mutated');
      assert.equal(answer(result.session,target),null,'double taps cannot skip tasks');
      s=advance(result.session,()=>.4);assert.ok(validSession(s));
      if(i<SESSION_LENGTH-1){assert.equal(s.status,'playing');assert.notEqual(s.task.target,target);}else assert.equal(s.status,'finished');
    }
    assert.equal(answer(s,s.task.target),null);assert.equal(s.history.length,SESSION_LENGTH);
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
    let s=createSession(Object.keys(ACTIVITIES)[n%3],rng);
    while(s.status!=='finished'){
      assert.ok(validSession(s));observed.add(`${s.mode}:${s.task.target}`);
      s=advance(answer(s,s.task.target).session,rng);
    }
    assert.ok(validSession({...s,rewarded:true}));
  }
  assert.equal(observed.size,18);
});
test('shuffle does not mutate or lose input elements',()=>{
  const a=['a','b','c'];const b=shuffled(a,()=>0);assert.deepEqual(a,['a','b','c']);assert.deepEqual([...b].sort(),a);assert.notEqual(a,b);
});
