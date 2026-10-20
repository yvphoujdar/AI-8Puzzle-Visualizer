/*
 * puzzle.js
 * Basic helpers for the 8-puzzle: states, moves, heuristics,
 * solvability check and random puzzle generation.
 *
 * A state is stored as a 9-character string read row by row,
 * with "0" standing for the blank tile.
 * Example:  2 8 3 / 1 6 4 / 7 _ 5   ->   "283164705"
 */

const Puzzle = (() => {
  // How the blank moves, and how much its index changes for that move
  const DIRECTIONS = [
    { name: "Up", dr: -1, dc: 0 },
    { name: "Down", dr: 1, dc: 0 },
    { name: "Left", dr: 0, dc: -1 },
    { name: "Right", dr: 0, dc: 1 },
  ];

  const DEFAULT_START = "283164705";
  const DEFAULT_GOAL = "123804765";

  /** Turn any user text ("2 8 3, 1 6 4, 7 _ 5") into "283164705". */
  function normalize(text) {
    return String(text)
      .replace(/[_\-.*xX]/g, "0")
      .replace(/[^0-9]/g, "");
  }

  /** A valid state has the digits 0-8 exactly once each. */
  function isValid(state) {
    if (typeof state !== "string" || state.length !== 9) return false;
    return state.split("").sort().join("") === "012345678";
  }

  /** All states reachable with one move of the blank. */
  function successors(state) {
    const b = state.indexOf("0");
    const r = Math.floor(b / 3);
    const c = b % 3;
    const out = [];
    for (const d of DIRECTIONS) {
      const nr = r + d.dr;
      const nc = c + d.dc;
      if (nr < 0 || nr > 2 || nc < 0 || nc > 2) continue;
      const t = nr * 3 + nc;
      const arr = state.split("");
      const tile = arr[t];
      arr[b] = tile;
      arr[t] = "0";
      out.push({ state: arr.join(""), move: d.name, tile: Number(tile) });
    }
    return out;
  }

  /** Number of tile pairs that are in the "wrong" order (blank ignored). */
  function inversions(state) {
    const tiles = state.split("").filter((ch) => ch !== "0").map(Number);
    let count = 0;
    for (let i = 0; i < tiles.length; i++) {
      for (let j = i + 1; j < tiles.length; j++) {
        if (tiles[i] > tiles[j]) count++;
      }
    }
    return count;
  }

  /**
   * On a 3x3 board a move never changes the parity of the inversion count,
   * so start can reach goal only if both have the same parity.
   */
  function isSolvable(start, goal) {
    return inversions(start) % 2 === inversions(goal) % 2;
  }

  /** h1: how many tiles (not counting the blank) are out of place. */
  function misplacedTiles(state, goal) {
    let count = 0;
    for (let i = 0; i < 9; i++) {
      if (state[i] !== "0" && state[i] !== goal[i]) count++;
    }
    return count;
  }

  // Cache of goal positions so Manhattan distance stays fast
  const goalPosCache = new Map();
  function goalPositions(goal) {
    if (!goalPosCache.has(goal)) {
      const pos = new Array(9);
      for (let i = 0; i < 9; i++) pos[Number(goal[i])] = i;
      goalPosCache.set(goal, pos);
    }
    return goalPosCache.get(goal);
  }

  /** h2: sum of how far each tile is from its goal square (rows + columns). */
  function manhattan(state, goal) {
    const pos = goalPositions(goal);
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      const v = Number(state[i]);
      if (v === 0) continue;
      const g = pos[v];
      sum += Math.abs(Math.floor(i / 3) - Math.floor(g / 3)) + Math.abs((i % 3) - (g % 3));
    }
    return sum;
  }

  const HEURISTICS = {
    manhattan: { label: "Manhattan Distance", fn: manhattan },
    misplaced: { label: "Misplaced Tiles", fn: misplacedTiles },
  };

  /**
   * Cost of one move.
   *  - "unit":  every move costs 1 (the usual 8-puzzle setting)
   *  - "tile":  a move costs the number written on the tile that slides
   *             (so moving tile 8 is costlier than moving tile 1).
   *             This makes Uniform Cost Search behave differently from BFS.
   */
  function moveCost(tile, costModel) {
    return costModel === "tile" ? tile : 1;
  }

  /**
   * Make a random puzzle that is always solvable: start from the goal and
   * make random legal moves (never undoing the previous one).
   */
  function randomFrom(goal, steps = 15) {
    let state = goal;
    let prev = null;
    for (let i = 0; i < steps; i++) {
      const options = successors(state).filter((s) => s.state !== prev);
      const pick = options[Math.floor(Math.random() * options.length)];
      prev = state;
      state = pick.state;
    }
    return state === goal ? randomFrom(goal, steps) : state;
  }

  /** "283164705" -> [["2","8","3"],["1","6","4"],["7","_","5"]] */
  function toRows(state) {
    const rows = [];
    for (let r = 0; r < 3; r++) {
      rows.push(state.slice(r * 3, r * 3 + 3).split("").map((ch) => (ch === "0" ? "_" : ch)));
    }
    return rows;
  }

  function pretty(state) {
    return toRows(state).map((r) => r.join(" ")).join(" / ");
  }

  return {
    DEFAULT_START,
    DEFAULT_GOAL,
    HEURISTICS,
    normalize,
    isValid,
    successors,
    inversions,
    isSolvable,
    misplacedTiles,
    manhattan,
    moveCost,
    randomFrom,
    toRows,
    pretty,
  };
})();

if (typeof module !== "undefined") module.exports = Puzzle;
