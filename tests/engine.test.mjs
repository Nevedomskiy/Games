import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, place, connected, neighbors, isGameOver, revive, randomTile, validState, MAX_LEVEL } from '../src/engine.js';

const empty = () => ({ ...createGame(() => 0), board: Array(25).fill(0) });

test('opening is valid and the first suggested merge works', () => {
  const state = createGame(() => 0);
  assert.ok(validState(state));
  const result = place(state, 10, () => 0);
  assert.equal(result.state.board[10], 2);
  assert.equal(result.state.board[11], 0);
  assert.equal(result.state.board[12], 0);
  assert.equal(result.state.score, 65);
  assert.equal(result.state.turns, 1);
  assert.equal(result.merges.length, 1);
  assert.equal(state.board[10], 0, 'input remains immutable');
});

test('invalid and occupied positions cannot consume the next piece', () => {
  const state = createGame();
  for (const i of [-1, 25, 1.5, NaN, 11]) assert.equal(place(state, i), null);
  assert.equal(state.turns, 0);
});

test('neighbors do not wrap at row edges and diagonals do not merge', () => {
  assert.deepEqual(neighbors(0), [1, 5]);
  assert.deepEqual(neighbors(4), [3, 9]);
  const state = empty(); state.board[0] = state.board[6] = 1;
  const result = place(state, 12, () => 0);
  assert.equal(result.merges.length, 0);
  state.board.fill(0); state.board[4] = state.board[9] = 1;
  assert.equal(place(state, 5, () => 0).merges.length, 0);
});

test('every piece of a connected component is consumed, including branches', () => {
  const state = empty();
  [7, 11, 13, 17].forEach(i => state.board[i] = 1);
  const result = place(state, 12, () => 0);
  assert.equal(result.merges[0].indices.length, 5);
  assert.equal(result.state.board.filter(Boolean).length, 1);
  assert.equal(result.state.board[12], 2);
});

test('chain reaction combines a newly created building at the placement cell', () => {
  const state = empty();
  state.board[10] = state.board[11] = 1;
  state.board[7] = state.board[13] = 2;
  const result = place(state, 12, () => 0);
  assert.equal(result.merges.length, 2);
  assert.equal(result.state.board[12], 3);
  assert.equal(result.state.board.filter(Boolean).length, 1);
  assert.equal(result.earned, 305);
  assert.equal(result.state.maxLevel, 3);
});

test('highest tier stays on board without overflowing the supported levels', () => {
  const state = empty(); state.next = MAX_LEVEL;
  state.board[10] = state.board[11] = MAX_LEVEL;
  const result = place(state, 12, () => 0);
  assert.equal(result.merges.length, 0);
  assert.equal(Math.max(...result.state.board), MAX_LEVEL);
});

test('a merge in the last empty cell keeps the game alive', () => {
  const state = empty();
  state.board.fill(2); state.board[0] = 0; state.board[1] = state.board[5] = 1;
  assert.equal(place(state, 0, () => 0).over, false);
});

test('a full board ends the game and one revival clears exactly three lowest tiles', () => {
  const state = empty(); state.board = Array.from({length: 25}, (_, i) => i % 2 ? 2 : 3); state.board[0] = 0;
  const result = place(state, 0, () => 0);
  assert.equal(result.over, true);
  const revived = revive(result.state);
  assert.equal(revived.board.filter(n => n === 0).length, 3);
  assert.equal(revived.revives, 1);
  assert.equal(revived.score, result.state.score);
  assert.equal(result.state.board.filter(n => n === 0).length, 0);
  assert.equal(isGameOver(revived), false);
  revived.board.fill(1);
  assert.equal(revive(revived), null, 'only one continuation per round');
  assert.equal(revive(createGame()), null, 'no reward action during a live game');
});

test('piece probabilities have stable, documented boundaries', () => {
  assert.equal(randomTile(() => 0), 1);
  assert.equal(randomTile(() => .81999), 1);
  assert.equal(randomTile(() => .82), 2);
  assert.equal(randomTile(() => .98), 3);
});

test('corrupt saves are rejected', () => {
  assert.equal(validState(null), false);
  assert.equal(validState({}), false);
  for (const patch of [{ board: [1] }, { score: -1 }, { next: 9 }, { revives: 2 }, { maxLevel: 0 }, { turns: 1.5 }, { later: null }]) {
    assert.equal(validState({ ...createGame(), ...patch }), false);
  }
});

test('simulated rounds preserve state invariants and eventually finish', () => {
  let seed = 42;
  const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  let totalMoves = 0;
  for (let round = 0; round < 100; round++) {
    let state = createGame(rng);
    let moves = 0;
    while (!isGameOver(state) && moves < 10000) {
      const free = state.board.flatMap((n, i) => n ? [] : [i]);
      const result = place(state, free[Math.floor(rng() * free.length)], rng);
      assert.ok(result.state.score > state.score);
      assert.ok(validState(result.state));
      state = result.state; moves++;
    }
    assert.ok(isGameOver(state), 'round terminates normally');
    totalMoves += moves;
  }
  assert.ok(totalMoves > 1000);
});
