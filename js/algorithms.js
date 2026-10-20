/*
 * algorithms.js
 * All seven search algorithms, written from scratch.
 *
 *   Uninformed: BFS, DFS, DLS, IDDLS, Uniform Cost Search
 *   Informed:   Greedy Best First Search, A*
 *
 * Every algorithm returns the same kind of result object (path, counts,
 * time, memory). When `trace` is on, it also records every node expansion
 * so the page can replay the search step by step.
 */

const Search = (() => {
  const P = typeof Puzzle !== "undefined" ? Puzzle : require("./puzzle.js");

  const ALGORITHMS = {
    bfs: { short: "BFS", name: "Breadth First Search", informed: false },
    dfs: { short: "DFS", name: "Depth First Search", informed: false },
    dls: { short: "DLS", name: "Depth Limited Search", informed: false },
    iddls: { short: "IDDLS", name: "Iterative Deepening Depth Limited Search", informed: false },
    ucs: { short: "UCS", name: "Uniform Cost Search", informed: false },
    gbfs: { short: "GBFS", name: "Greedy Best First Search", informed: true },
    astar: { short: "A*", name: "A* Search", informed: true },
  };

  // Rough size of one stored search node in browser memory
  // (state string + node object + entry in a Set/Map).
  const BYTES_PER_NODE = 160;

  /* ---------------- Min-heap (priority queue) ---------------- */
  // Items are compared by priority p, then tie-break t, then insertion order.
  function less(a, b) {
    if (a.p !== b.p) return a.p < b.p;
    if (a.t !== b.t) return a.t < b.t;
    return a.seq < b.seq;
  }

  class MinHeap {
    constructor() {
      this.a = [];
      this.seq = 0;
    }
    get size() {
      return this.a.length;
    }
    push(node, p, t = 0) {
      const a = this.a;
      a.push({ node, p, t, seq: this.seq++ });
      let i = a.length - 1;
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (!less(a[i], a[parent])) break;
        [a[i], a[parent]] = [a[parent], a[i]];
        i = parent;
      }
    }
    pop() {
      const a = this.a;
      const top = a[0];
      const last = a.pop();
      if (a.length > 0) {
        a[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < a.length && less(a[l], a[m])) m = l;
          if (r < a.length && less(a[r], a[m])) m = r;
          if (m === i) break;
          [a[i], a[m]] = [a[m], a[i]];
          i = m;
        }
      }
      return top;
    }
    /** The k best items, in order. (The k smallest of a heap always sit in its first 2^k - 1 slots.) */
    peek(k) {
      const n = Math.min(this.a.length, (1 << k) - 1);
      return this.a.slice(0, n).sort((x, y) => (less(x, y) ? -1 : 1)).slice(0, k).map((x) => x.node);
    }
  }

  /* ---------------- Shared bookkeeping ---------------- */
  class Context {
    constructor(algo, start, goal, o) {
      this.algo = algo;
      this.start = start;
      this.goal = goal;
      this.o = o;
      this.informed = ALGORITHMS[algo].informed;
      this.hfn = P.HEURISTICS[o.heuristic].fn;
      this.generated = 0;
      this.expanded = 0;
      this.maxDepth = 0;
      this.peakNodes = 0;
      this.trace = [];
      this.traceTruncated = false;
      this.stopped = false;
    }

    makeNode(state, parent, move = null, tile = null) {
      const g = parent ? parent.g + P.moveCost(tile, this.o.costModel) : 0;
      const depth = parent ? parent.depth + 1 : 0;
      const h = this.informed ? this.hfn(state, this.goal) : null;
      if (depth > this.maxDepth) this.maxDepth = depth;
      return { state, parent, move, tile, g, depth, h };
    }

    /** The evaluation value used to order the frontier. */
    f(node) {
      if (this.algo === "astar") return node.g + node.h;
      if (this.algo === "gbfs") return node.h;
      return node.g;
    }

    overLimit() {
      if (this.generated > this.o.nodeLimit) this.stopped = true;
      return this.stopped;
    }

    notePeak(n) {
      if (n > this.peakNodes) this.peakNodes = n;
    }

    canTrace() {
      if (!this.o.trace) return false;
      if (this.trace.length >= this.o.traceLimit) {
        this.traceTruncated = true;
        return false;
      }
      return true;
    }

    info(node) {
      return {
        state: node.state,
        g: node.g,
        h: node.h,
        f: this.f(node),
        depth: node.depth,
        move: node.move,
        parent: node.parent ? node.parent.state : null,
      };
    }

    record(node, succ, frontierNodes, frontierSize, exploredStates, exploredSize, extra = {}) {
      if (!this.canTrace()) return;
      this.trace.push({
        kind: "expand",
        node: this.info(node),
        succ,
        frontier: frontierNodes.map((n) => this.info(n)),
        frontierSize,
        explored: exploredStates,
        exploredSize,
        generated: this.generated,
        expanded: this.expanded,
        ...extra,
      });
    }

    recordGoal(node) {
      if (this.o.trace) this.trace.push({ kind: "goal", node: this.info(node), generated: this.generated, expanded: this.expanded });
    }

    succInfo(child, status) {
      return { state: child.state, move: child.move, g: child.g, h: child.h, f: this.f(child), status };
    }
  }

  function lastN(arr, n) {
    return arr.slice(Math.max(0, arr.length - n)).reverse();
  }

  /* ---------------- 1. Breadth First Search ---------------- */
  function bfs(ctx) {
    const { start, goal } = ctx;
    const root = ctx.makeNode(start, null);
    ctx.generated = 1;
    if (start === goal) {
      ctx.recordGoal(root);
      return root;
    }
    const queue = [root];
    let head = 0;
    const inFrontier = new Set([start]);
    const explored = new Set();
    const order = [];

    while (head < queue.length) {
      if (ctx.overLimit()) return null;
      const node = queue[head++];
      inFrontier.delete(node.state);
      explored.add(node.state);
      if (ctx.o.trace) order.push(node.state);
      ctx.expanded++;
      const succ = [];
      for (const s of P.successors(node.state)) {
        ctx.generated++;
        if (explored.has(s.state) || inFrontier.has(s.state)) {
          if (ctx.o.trace) succ.push({ state: s.state, move: s.move, g: node.g + P.moveCost(s.tile, ctx.o.costModel), status: "already seen" });
          continue;
        }
        const child = ctx.makeNode(s.state, node, s.move, s.tile);
        if (child.state === goal) {
          // BFS checks the goal as soon as a node is generated
          succ.push(ctx.succInfo(child, "goal"));
          ctx.record(node, succ, queue.slice(head, head + 6), queue.length - head, lastN(order, 6), explored.size);
          ctx.recordGoal(child);
          return child;
        }
        queue.push(child);
        inFrontier.add(child.state);
        if (ctx.o.trace) succ.push(ctx.succInfo(child, "added"));
      }
      ctx.notePeak(queue.length - head + explored.size);
      ctx.record(node, succ, queue.slice(head, head + 6), queue.length - head, lastN(order, 6), explored.size);
    }
    return null;
  }

  /* ---------------- 2. Depth First Search (graph search) ---------------- */
  function dfs(ctx) {
    const { start, goal } = ctx;
    const root = ctx.makeNode(start, null);
    ctx.generated = 1;
    const stack = [root];
    const explored = new Set();
    const order = [];

    while (stack.length) {
      if (ctx.overLimit()) return null;
      const node = stack.pop();
      if (explored.has(node.state)) continue; // reached earlier by another path
      if (node.state === goal) {
        ctx.recordGoal(node);
        return node;
      }
      explored.add(node.state);
      if (ctx.o.trace) order.push(node.state);
      ctx.expanded++;
      const succ = [];
      const children = [];
      for (const s of P.successors(node.state)) {
        ctx.generated++;
        if (explored.has(s.state)) {
          if (ctx.o.trace) succ.push({ state: s.state, move: s.move, g: node.g + P.moveCost(s.tile, ctx.o.costModel), status: "already explored" });
          continue;
        }
        const child = ctx.makeNode(s.state, node, s.move, s.tile);
        children.push(child);
        if (ctx.o.trace) succ.push(ctx.succInfo(child, s.state === goal ? "goal (added)" : "added"));
      }
      // push in reverse so the first move (Up) is tried first
      for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
      ctx.notePeak(stack.length + explored.size);
      ctx.record(node, succ, lastN(stack, 6), stack.length, lastN(order, 6), explored.size);
    }
    return null;
  }

  /* ---------------- 3. Depth Limited Search ---------------- */
  // Returns { node } if found, or { cutoff: true/false } if not.
  function dlsRun(ctx, limit, extra = {}) {
    const { start, goal } = ctx;
    const root = ctx.makeNode(start, null);
    ctx.generated++;
    const stack = [root];
    const order = [];
    let expandedHere = 0;
    let cutoff = false;

    // Shallowest depth at which each state was reached in THIS pass.
    // A state reached again at the same or a deeper level is skipped, because
    // everything below it is already being searched with more depth to spare.
    // This removes repeated work without losing completeness inside the limit.
    const seenDepth = new Map([[start, 0]]);

    while (stack.length) {
      if (ctx.overLimit()) return { node: null, cutoff: true };
      const node = stack.pop();
      if (node.state === goal) {
        ctx.recordGoal(node);
        return { node };
      }
      if (node.depth >= limit) {
        cutoff = true; // could go deeper, but the limit stops us
        continue;
      }
      ctx.expanded++;
      expandedHere++;
      if (ctx.o.trace) order.push(node.state);
      const succ = [];
      const children = [];
      for (const s of P.successors(node.state)) {
        ctx.generated++;
        const prevDepth = seenDepth.get(s.state);
        if (prevDepth !== undefined && prevDepth <= node.depth + 1) {
          if (ctx.o.trace) succ.push({ state: s.state, move: s.move, g: node.g + P.moveCost(s.tile, ctx.o.costModel), status: "already reached (same or less depth)" });
          continue;
        }
        seenDepth.set(s.state, node.depth + 1);
        const child = ctx.makeNode(s.state, node, s.move, s.tile);
        children.push(child);
        if (ctx.o.trace) {
          const st = s.state === goal ? "goal (added)" : child.depth >= limit ? "added (at limit)" : "added";
          succ.push(ctx.succInfo(child, st));
        }
      }
      for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
      ctx.notePeak(stack.length + seenDepth.size);
      ctx.record(node, succ, lastN(stack, 6), stack.length, lastN(order, 6), expandedHere, { limit, ...extra });
    }
    return { node: null, cutoff };
  }

  function dls(ctx) {
    const res = dlsRun(ctx, ctx.o.depthLimit);
    ctx.cutoff = !res.node && res.cutoff;
    return res.node;
  }

  /* ---------------- 4. Iterative Deepening DLS ---------------- */
  function iddls(ctx) {
    for (let limit = 0; limit <= ctx.o.maxDepth; limit++) {
      ctx.iterations = limit + 1;
      ctx.finalLimit = limit;
      if (ctx.canTrace()) ctx.trace.push({ kind: "iteration", limit, generated: ctx.generated, expanded: ctx.expanded });
      const res = dlsRun(ctx, limit, { iteration: limit });
      if (res.node) return res.node;
      if (!res.cutoff || ctx.stopped) return null; // whole space searched, or node limit hit
    }
    ctx.cutoff = true;
    return null;
  }

  /* ---------------- 5/6/7. UCS, Greedy Best First, A* ---------------- */
  // All three use a priority queue; only the priority changes:
  //   UCS: g(n)     GBFS: h(n)     A*: f(n) = g(n) + h(n)
  function bestFirst(ctx) {
    const { start, goal, algo } = ctx;
    const useCost = algo !== "gbfs";
    const tie = (n) => (algo === "astar" ? n.h : 0); // A*: prefer smaller h on ties
    const open = new MinHeap();
    const bestG = new Map(); // cheapest known cost to each state seen
    const closed = new Set();
    const order = [];

    const root = ctx.makeNode(start, null);
    ctx.generated = 1;
    open.push(root, ctx.f(root), tie(root));
    bestG.set(start, 0);

    while (open.size) {
      if (ctx.overLimit()) return null;
      const node = open.pop().node;
      if (closed.has(node.state)) continue; // old, more expensive copy
      if (useCost && node.g > bestG.get(node.state)) continue;
      // goal test when the node is taken OUT of the queue -> keeps UCS and A* optimal
      if (node.state === goal) {
        ctx.recordGoal(node);
        return node;
      }
      closed.add(node.state);
      if (ctx.o.trace) order.push(node.state);
      ctx.expanded++;
      const succ = [];
      for (const s of P.successors(node.state)) {
        ctx.generated++;
        const child = ctx.makeNode(s.state, node, s.move, s.tile);
        if (closed.has(child.state)) {
          if (ctx.o.trace) succ.push(ctx.succInfo(child, "already explored"));
          continue;
        }
        const known = bestG.get(child.state);
        if (!useCost) {
          if (known !== undefined) {
            if (ctx.o.trace) succ.push(ctx.succInfo(child, "already in frontier"));
            continue;
          }
          bestG.set(child.state, child.g);
          open.push(child, ctx.f(child), tie(child));
          if (ctx.o.trace) succ.push(ctx.succInfo(child, child.state === goal ? "goal (added)" : "added"));
        } else if (known === undefined || child.g < known) {
          bestG.set(child.state, child.g);
          open.push(child, ctx.f(child), tie(child));
          if (ctx.o.trace) {
            const st = child.state === goal ? "goal (added)" : known === undefined ? "added" : "cheaper path, updated";
            succ.push(ctx.succInfo(child, st));
          }
        } else if (ctx.o.trace) {
          succ.push(ctx.succInfo(child, "frontier has cheaper copy"));
        }
      }
      ctx.notePeak(open.size + closed.size);
      ctx.record(node, succ, open.peek(6), open.size, lastN(order, 6), closed.size);
    }
    return null;
  }

  const RUNNERS = { bfs, dfs, dls, iddls, ucs: bestFirst, gbfs: bestFirst, astar: bestFirst };

  function memoryLabel(bytes) {
    if (bytes < 64 * 1024) return "Low";
    if (bytes < 2 * 1024 * 1024) return "Medium";
    return "High";
  }

  /**
   * Solve one puzzle.
   * opts: heuristic ("manhattan" | "misplaced"), depthLimit (DLS), maxDepth (IDDLS),
   *       costModel ("unit" | "tile"), trace (bool), traceLimit, nodeLimit
   */
  function solve(algo, start, goal, opts = {}) {
    const o = {
      heuristic: "manhattan",
      depthLimit: 10,
      maxDepth: 31,
      costModel: "unit",
      trace: false,
      traceLimit: 4000,
      nodeLimit: 1500000,
      ...opts,
    };
    const ctx = new Context(algo, start, goal, o);
    const t0 = performance.now();
    const goalNode = RUNNERS[algo](ctx);
    const timeMs = performance.now() - t0;

    const path = [];
    const moves = [];
    for (let n = goalNode; n; n = n.parent) {
      path.push(n.state);
      if (n.move) moves.push(n.move);
    }
    path.reverse();
    moves.reverse();

    let status = "found";
    if (!goalNode) status = ctx.stopped ? "node limit reached" : ctx.cutoff ? "cutoff (depth limit)" : "no solution";

    const peak = Math.max(ctx.peakNodes, 1);
    return {
      algo,
      algoName: ALGORITHMS[algo].name,
      short: ALGORITHMS[algo].short,
      found: !!goalNode,
      status,
      path,
      moves,
      moveCount: goalNode ? moves.length : null,
      cost: goalNode ? goalNode.g : null,
      generated: ctx.generated,
      expanded: ctx.expanded,
      maxDepth: ctx.maxDepth,
      peakNodes: peak,
      memoryBytes: peak * BYTES_PER_NODE,
      memoryLabel: memoryLabel(peak * BYTES_PER_NODE),
      timeMs,
      iterations: ctx.iterations || null,
      finalLimit: ctx.finalLimit ?? null,
      trace: ctx.trace,
      traceTruncated: ctx.traceTruncated,
      options: o,
    };
  }

  return { ALGORITHMS, solve, MinHeap };
})();

if (typeof module !== "undefined") module.exports = Search;
