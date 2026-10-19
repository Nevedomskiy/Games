export const SIZE = 5;
export const MAX_LEVEL = 8;
export const GOAL_LEVEL = 6;

export function randomTile(rng = Math.random) {
  const n = rng();
  return n < 0.82 ? 1 : n < 0.98 ? 2 : 3;
}

export function createGame(rng = Math.random) {
  const board = Array(SIZE * SIZE).fill(0);
  // A small, deliberate opening: the first move can demonstrate a merge.
  board[11] = 1;
  board[12] = 1;
  board[18] = 2;
  return { board, score: 0, turns: 0, next: 1, later: randomTile(rng), maxLevel: 2, revives: 0 };
}

export function neighbors(index) {
  const result = [];
  const x = index % SIZE;
  const y = Math.floor(index / SIZE);
  if (x > 0) result.push(index - 1);
  if (x < SIZE - 1) result.push(index + 1);
  if (y > 0) result.push(index - SIZE);
  if (y < SIZE - 1) result.push(index + SIZE);
  return result;
}

export function connected(board, start) {
  const level = board[start];
  if (!level) return [];
  const seen = new Set([start]);
  const queue = [start];
  for (let n = 0; n < queue.length; n++) {
    for (const i of neighbors(queue[n])) {
      if (!seen.has(i) && board[i] === level) { seen.add(i); queue.push(i); }
    }
  }
  return queue;
}

export function place(state, index, rng = Math.random) {
  if (!Number.isInteger(index) || index < 0 || index >= SIZE * SIZE || state.board[index]) return null;
  const board = [...state.board];
  board[index] = state.next;
  const merges = [];
  let earned = 5;
  while (board[index] < MAX_LEVEL) {
    const group = connected(board, index);
    if (group.length < 3) break;
    const level = board[index];
    for (const i of group) board[i] = 0;
    board[index] = level + 1;
    earned += group.length * 10 * 2 ** level * (merges.length + 1);
    merges.push({ indices: group, level: level + 1 });
  }
  const nextState = {
    ...state, board, score: state.score + earned, turns: state.turns + 1,
    next: state.later, later: randomTile(rng), maxLevel: Math.max(state.maxLevel, ...board),
  };
  return { state: nextState, merges, earned, index, over: isGameOver(nextState) };
}

export function isGameOver(state) { return state.board.every(Boolean); }

export function revive(state) {
  if (!isGameOver(state) || state.revives >= 1) return null;
  const board = [...state.board];
  const lowest = board.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value || a.index - b.index).slice(0, 3);
  for (const { index } of lowest) board[index] = 0;
  return { ...state, board, revives: state.revives + 1 };
}

export function validState(state) {
  return Boolean(state && Array.isArray(state.board) && state.board.length === SIZE * SIZE &&
    state.board.every(n => Number.isInteger(n) && n >= 0 && n <= MAX_LEVEL) &&
    Number.isSafeInteger(state.score) && state.score >= 0 &&
    Number.isSafeInteger(state.turns) && state.turns >= 0 &&
    Number.isInteger(state.next) && state.next >= 1 && state.next <= 3 &&
    Number.isInteger(state.later) && state.later >= 1 && state.later <= 3 &&
    Number.isInteger(state.maxLevel) && state.maxLevel >= Math.max(1, ...state.board) && state.maxLevel <= MAX_LEVEL &&
    Number.isInteger(state.revives) && state.revives >= 0 && state.revives <= 1);
}
