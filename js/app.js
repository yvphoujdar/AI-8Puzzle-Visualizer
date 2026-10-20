/*
 * app.js
 * Everything on the page: navigation, puzzle input, playback of the search,
 * the comparison page and the algorithm information page.
 */

(() => {
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => (n === null || n === undefined ? "–" : Number(n).toLocaleString("en-US"));
  const fmtTime = (ms) => (ms < 1 ? ms.toFixed(2) + " ms" : ms < 1000 ? ms.toFixed(1) + " ms" : (ms / 1000).toFixed(2) + " s");
  const fmtBytes = (b) => (b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(1) + " KB" : (b / 1048576).toFixed(2) + " MB");
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

  /* =========================================================
   * Small helpers for drawing boards
   * ========================================================= */

  /** Static small board as HTML. */
  function mini(state, cls = "") {
    let cells = "";
    for (const ch of state) cells += ch === "0" ? '<div class="b"></div>' : `<div>${ch}</div>`;
    return `<div class="mini ${cls}">${cells}</div>`;
  }

  /** Big board whose tiles slide when the state changes. */
  function createBoard(el) {
    el.innerHTML = '<div class="board-inner"></div>';
    const inner = el.firstChild;
    const tiles = {};
    const blank = document.createElement("div");
    blank.className = "blank-cell";
    blank.innerHTML = "<span></span>";
    inner.appendChild(blank);
    for (let v = 1; v <= 8; v++) {
      const t = document.createElement("div");
      t.className = "tile";
      t.innerHTML = `<span>${v}</span>`;
      inner.appendChild(t);
      tiles[v] = t;
    }
    let goal = null;
    return {
      setGoal(g) {
        goal = g;
      },
      set(state, ms = 250) {
        el.style.setProperty("--move-ms", ms + "ms");
        for (let i = 0; i < 9; i++) {
          const v = Number(state[i]);
          const tr = `translate(${(i % 3) * 100}%, ${Math.floor(i / 3) * 100}%)`;
          if (v === 0) blank.style.transform = tr;
          else {
            tiles[v].style.transform = tr;
            tiles[v].classList.toggle("correct", !!goal && goal[i] === state[i]);
          }
        }
      },
    };
  }

  /* =========================================================
   * Navigation (one page, four views)
   * ========================================================= */
  const VIEWS = ["home", "solver", "compare", "algorithms"];
  function route() {
    const view = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "home";
    for (const v of VIEWS) $("view-" + v).classList.toggle("hidden", v !== view);
    document.querySelectorAll(".nav-link").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + view));
    $("mobileNav").classList.add("hidden");
    if (view === "compare") refreshComparePuzzle();
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  $("menuBtn").addEventListener("click", () => $("mobileNav").classList.toggle("hidden"));

  /* =========================================================
   * Home page: little animated demo
   * ========================================================= */
  const hero = createBoard($("heroBoard"));
  hero.setGoal(Puzzle.DEFAULT_GOAL);
  $("homeStart").innerHTML = mini(Puzzle.DEFAULT_START, "md");
  $("homeGoal").innerHTML = mini(Puzzle.DEFAULT_GOAL, "md goal");
  (function heroLoop() {
    const res = Search.solve("astar", Puzzle.DEFAULT_START, Puzzle.DEFAULT_GOAL);
    let i = 0;
    hero.set(res.path[0], 0);
    setInterval(() => {
      i = (i + 1) % (res.path.length + 2); // short pause on the goal
      const k = Math.min(i, res.path.length - 1);
      hero.set(res.path[k], 400);
      $("heroCaption").textContent = k === 0 ? "Start" : k === res.path.length - 1 ? "Goal reached in 5 moves!" : `Move ${k}: blank goes ${res.moves[k - 1]}`;
    }, 900);
  })();

  /* =========================================================
   * Solver page: puzzle input
   * ========================================================= */
  function buildEditGrid(el, state) {
    el.innerHTML = "";
    for (let i = 0; i < 9; i++) {
      const inp = document.createElement("input");
      inp.maxLength = 1;
      inp.inputMode = "numeric";
      inp.setAttribute("aria-label", `cell ${i + 1}`);
      el.appendChild(inp);
      inp.addEventListener("input", () => {
        inp.value = inp.value.replace(/[^0-8_]/g, "");
        if (inp.value === "0" || inp.value === "_") inp.value = "";
        onInputChange();
      });
    }
    setGrid(el, state);
  }
  function setGrid(el, state) {
    [...el.children].forEach((inp, i) => {
      inp.value = state[i] === "0" ? "" : state[i];
      inp.classList.toggle("empty", state[i] === "0");
    });
  }
  function readGrid(el) {
    return [...el.children].map((inp) => (inp.value === "" ? "0" : inp.value)).join("");
  }

  const mainBoard = createBoard($("mainBoard"));
  buildEditGrid($("startGrid"), Puzzle.DEFAULT_START);
  buildEditGrid($("goalGrid"), Puzzle.DEFAULT_GOAL);

  /** Returns {ok, start, goal, msg} */
  function readPuzzle() {
    const start = readGrid($("startGrid"));
    const goal = readGrid($("goalGrid"));
    if (!Puzzle.isValid(start)) return { ok: false, start, goal, msg: "Initial state needs the digits 1–8 once each and exactly one blank." };
    if (!Puzzle.isValid(goal)) return { ok: false, start, goal, msg: "Goal state needs the digits 1–8 once each and exactly one blank." };
    if (!Puzzle.isSolvable(start, goal))
      return { ok: false, start, goal, msg: "This puzzle cannot be solved: the start and goal have a different number of inversions (odd vs even)." };
    return { ok: true, start, goal, msg: start === goal ? "The start is already the goal." : "Valid puzzle, and it can be solved." };
  }

  function onInputChange() {
    [...$("startGrid").children, ...$("goalGrid").children].forEach((i) => i.classList.toggle("empty", i.value === ""));
    const p = readPuzzle();
    $("inputMsg").textContent = (p.ok ? "✓ " : "✗ ") + p.msg;
    $("inputMsg").className = "msg mt-3 " + (p.ok ? "text-emerald-600" : "text-rose-600");
    resetPlayback();
  }

  $("btnExample").addEventListener("click", () => {
    setGrid($("startGrid"), Puzzle.DEFAULT_START);
    setGrid($("goalGrid"), Puzzle.DEFAULT_GOAL);
    onInputChange();
  });
  $("btnRandom").addEventListener("click", () => {
    const goal = Puzzle.isValid(readGrid($("goalGrid"))) ? readGrid($("goalGrid")) : Puzzle.DEFAULT_GOAL;
    setGrid($("goalGrid"), goal);
    setGrid($("startGrid"), Puzzle.randomFrom(goal, Number($("difficulty").value)));
    onInputChange();
  });

  /* ---------- algorithm options ---------- */
  function algoOptions() {
    return {
      algo: $("algo").value,
      heuristic: $("heuristic").value,
      depthLimit: Math.max(0, Number($("depthLimit").value) || 0),
      maxDepth: Math.max(1, Number($("maxDepth").value) || 31),
      costModel: $("costModel").value,
    };
  }
  const ALGO_HINT = {
    bfs: "Expands level by level using a queue. Shortest path in moves.",
    dfs: "Goes deep along one branch using a stack. Finds a path, usually a very long one.",
    dls: "DFS that stops at the depth limit below. May report a cutoff.",
    iddls: "Runs DLS with limit 0, 1, 2, … until the goal is found.",
    ucs: "My assigned algorithm. Always expands the cheapest node g(n) first, so the answer is the cheapest path.",
    gbfs: "Expands the node with the smallest h(n). Fast but not optimal.",
    astar: "Expands the node with the smallest f(n) = g(n) + h(n). Fast and optimal.",
  };
  function onAlgoChange() {
    const a = $("algo").value;
    $("dlsBox").classList.toggle("hidden", a !== "dls");
    $("iddlsBox").classList.toggle("hidden", a !== "iddls");
    $("heuristicBox").classList.toggle("hidden", !Search.ALGORITHMS[a].informed);
    $("algoHint").textContent = ALGO_HINT[a];
    resetPlayback();
  }
  ["algo", "heuristic", "depthLimit", "maxDepth", "costModel"].forEach((id) => $(id).addEventListener("change", id === "algo" ? onAlgoChange : resetPlayback));

  /* =========================================================
   * Solver page: playback
   * ========================================================= */
  const P = {
    run: null, // traced result (for the step-by-step view)
    timed: null, // untraced result (for honest timing)
    timeline: [],
    idx: -1,
    playing: false,
    timer: null,
    firstPathIdx: -1,
  };

  function speedDelay() {
    const s = Number($("speed").value);
    return Math.round(1400 * Math.pow(0.6, s - 1));
  }
  function updateSpeedLabel() {
    const d = speedDelay();
    $("speedLabel").textContent = d >= 1000 ? (d / 1000).toFixed(1) + " s per step" : d + " ms per step";
  }
  $("speed").addEventListener("input", updateSpeedLabel);
  updateSpeedLabel();

  function setPhase(text, kind = "slate") {
    $("phaseBadge").textContent = text;
    $("phaseBadge").className = "badge badge-" + kind;
  }

  function updateButtons() {
    const has = P.timeline.length > 0;
    $("btnPause").disabled = !P.playing;
    $("btnResume").disabled = !has || P.playing || P.idx >= P.timeline.length - 1;
    $("btnNext").disabled = !has || P.idx >= P.timeline.length - 1;
    $("btnPrev").disabled = !has || P.idx <= 0;
    $("btnSkip").disabled = !has || P.idx >= P.timeline.length - 1;
    $("btnReset").disabled = !has;
  }

  function resetPlayback() {
    stop();
    P.run = null;
    P.timed = null;
    P.timeline = [];
    P.idx = -1;
    const p = readPuzzle();
    const start = Puzzle.isValid(p.start) ? p.start : Puzzle.DEFAULT_START;
    const goal = Puzzle.isValid(p.goal) ? p.goal : Puzzle.DEFAULT_GOAL;
    mainBoard.setGoal(goal);
    mainBoard.set(start, 0);
    $("viewStart").innerHTML = mini(start, "md");
    $("viewGoal").innerHTML = mini(goal, "md goal");
    $("statusText").textContent = "Press Run to start the search.";
    $("progressBar").style.width = "0%";
    setPhase("Ready");
    renderStats(null);
    $("currentNode").innerHTML = '<span class="text-sm text-slate-400">Nothing yet</span>';
    $("parentNode").innerHTML = '<span class="text-sm text-slate-400">Nothing yet</span>';
    $("successors").innerHTML = '<span class="text-sm text-slate-400">Nothing yet</span>';
    $("frontier").innerHTML = '<span class="text-sm text-slate-400">Empty</span>';
    $("explored").innerHTML = '<span class="text-sm text-slate-400">Empty</span>';
    $("frontierNote").textContent = "";
    $("exploredNote").textContent = "";
    $("summaryCard").classList.add("hidden");
    $("pathCard").classList.add("hidden");
    updateButtons();
  }

  function stop() {
    P.playing = false;
    clearTimeout(P.timer);
    updateButtons();
  }

  function play() {
    if (!P.timeline.length) return;
    P.playing = true;
    updateButtons();
    const tick = () => {
      if (!P.playing) return;
      if (P.idx >= P.timeline.length - 1) {
        stop();
        return;
      }
      show(P.idx + 1);
      P.timer = setTimeout(tick, speedDelay());
    };
    P.timer = setTimeout(tick, Math.min(speedDelay(), 400));
  }

  async function runSearch() {
    const p = readPuzzle();
    if (!p.ok) {
      onInputChange();
      $("statusText").textContent = "Please fix the puzzle first: " + p.msg;
      return;
    }
    stop();
    const o = algoOptions();
    const overlay = document.createElement("div");
    overlay.className = "loading-overlay";
    overlay.textContent = "Searching…";
    document.body.appendChild(overlay);
    await nextFrame();
    try {
      // Run once without recording (fair timing), then once with recording for playback.
      P.timed = Search.solve(o.algo, p.start, p.goal, { ...o, trace: false });
      P.run = Search.solve(o.algo, p.start, p.goal, { ...o, trace: true, traceLimit: 4000 });
    } finally {
      overlay.remove();
    }
    buildTimeline();
    renderPathList();
    show(0);
    play();
  }

  function buildTimeline() {
    const r = P.run;
    P.timeline = r.trace.map((ev) => ({ type: "search", ev }));
    if (r.traceTruncated) P.timeline.push({ type: "skip" });
    P.firstPathIdx = -1;
    if (r.found) {
      P.firstPathIdx = P.timeline.length;
      for (let i = 0; i < r.path.length; i++) P.timeline.push({ type: "path", i });
    } else {
      P.timeline.push({ type: "end" });
    }
  }

  function show(idx) {
    P.idx = Math.max(0, Math.min(idx, P.timeline.length - 1));
    const item = P.timeline[P.idx];
    const r = P.run;
    const info = Search.ALGORITHMS[r.algo];
    const delay = speedDelay();
    const moveMs = Math.min(Math.round(delay * 0.75), 450);
    $("progressBar").style.width = ((P.idx + 1) / P.timeline.length) * 100 + "%";

    if (item.type === "search") {
      const ev = item.ev;
      if (ev.kind === "iteration") {
        mainBoard.set(r.path[0] || readPuzzle().start, moveMs);
        setPhase(`Searching · limit ${ev.limit}`, "indigo");
        $("statusText").innerHTML = `Starting a new pass with depth limit <b>${ev.limit}</b>. The search starts again from the initial state.`;
        renderStats({ generated: ev.generated, expanded: ev.expanded, limit: ev.limit }, info);
        hideResult();
      } else if (ev.kind === "goal") {
        mainBoard.set(ev.node.state, moveMs);
        setPhase("Goal found", "green");
        $("statusText").innerHTML = `Goal reached at depth <b>${ev.node.depth}</b> with path cost <b>${ev.node.g}</b>.`;
        renderNode(ev.node, info);
        renderStats({ ...ev, node: ev.node, frontierSize: null, exploredSize: null }, info);
        showResult();
      } else {
        mainBoard.set(ev.node.state, moveMs);
        setPhase(ev.limit !== undefined ? `Searching · limit ${ev.limit}` : "Searching", "indigo");
        const extra = info.informed ? `, h = ${ev.node.h}, f = ${ev.node.f}` : r.algo === "ucs" ? `, g = ${ev.node.g}` : "";
        $("statusText").innerHTML = `Step ${fmt(P.idx + 1)}: expanding a node at depth <b>${ev.node.depth}</b>${extra}.`;
        renderNode(ev.node, info);
        renderSucc(ev.succ, info);
        renderList("frontier", ev.frontier, ev.frontierSize, info, "frontierNote", frontierWord(r.algo));
        renderExplored(ev);
        renderStats(ev, info);
        hideResult();
      }
    } else if (item.type === "skip") {
      setPhase("Jumping ahead", "amber");
      $("statusText").textContent = `The step-by-step view stops after ${fmt(r.trace.length)} steps to keep the page fast. The search itself ran to the end. Here is the result.`;
      renderStats({ generated: r.generated, expanded: r.expanded, depth: r.maxDepth }, info);
      showResult();
    } else if (item.type === "end") {
      setPhase("No solution", "red");
      $("statusText").textContent =
        r.status === "cutoff (depth limit)"
          ? "No solution within the depth limit. Try a bigger limit."
          : r.status === "node limit reached"
          ? "Stopped: the safety limit on generated nodes was reached."
          : "The whole reachable space was searched and the goal was not found.";
      renderStats({ generated: r.generated, expanded: r.expanded, depth: r.maxDepth }, info);
      showResult();
    } else if (item.type === "path") {
      const i = item.i;
      mainBoard.set(r.path[i], moveMs);
      setPhase("Solution path", "green");
      $("statusText").innerHTML =
        i === 0
          ? `Solution path, step 0 of ${fmt(r.moveCount)}: the initial state.`
          : `Solution path, step ${fmt(i)} of ${fmt(r.moveCount)}: the blank moves <b>${r.moves[i - 1]}</b>.${i === r.moveCount ? " Goal reached!" : ""}`;
      showResult();
      highlightPath(i);
    }
    updateButtons();
  }

  function frontierWord(algo) {
    return { bfs: "queue, front first", dfs: "stack, top first", dls: "stack, top first", iddls: "stack, top first" }[algo] || "priority queue, best first";
  }

  function nodeVals(n, info, algo) {
    const parts = [`g=${n.g}`];
    if (info.informed) parts.push(`h=${n.h}`, `f=${n.f}`);
    return parts.join(" · ");
  }

  function renderNode(n, info) {
    $("currentNode").innerHTML = `${mini(n.state, "md hl")}
      <div class="text-sm space-y-0.5">
        <div><span class="text-slate-500">Depth:</span> <b>${n.depth}</b></div>
        <div><span class="text-slate-500">Reached by:</span> <b>${n.move ? "blank " + n.move : "start"}</b></div>
        <div><span class="text-slate-500">Path cost g(n):</span> <b>${n.g}</b></div>
        ${info.informed ? `<div><span class="text-slate-500">h(n):</span> <b>${n.h}</b> &nbsp; <span class="text-slate-500">f(n):</span> <b>${n.f}</b></div>` : ""}
      </div>`;
    $("parentNode").innerHTML = n.parent
      ? `${mini(n.parent, "md")}<div class="text-sm text-slate-600">The board this node came from.</div>`
      : '<span class="text-sm text-slate-400">None, this is the root (initial state).</span>';
  }

  function renderSucc(list, info) {
    if (!list || !list.length) {
      $("successors").innerHTML = '<span class="text-sm text-slate-400">No successors (depth limit reached).</span>';
      return;
    }
    $("successors").innerHTML = list
      .map((s) => {
        const tagCls = s.status.startsWith("goal") ? "tag-goal" : s.status.startsWith("added") || s.status.startsWith("cheaper") ? "tag-add" : "tag-skip";
        const vals = info.informed && s.h !== undefined && s.h !== null ? `g=${s.g} · h=${s.h} · f=${s.f}` : `g=${s.g}`;
        return `<div class="succ-card">${mini(s.state, s.status.startsWith("goal") ? "goal" : "")}
          <div class="vals"><b>${s.move}</b><br>${vals}</div>
          <span class="tag ${tagCls}">${s.status}</span></div>`;
      })
      .join("");
  }

  function renderList(id, nodes, size, info, noteId, word) {
    $(noteId).textContent = `(${fmt(size)} node${size === 1 ? "" : "s"}; ${word})`;
    if (!nodes.length) {
      $(id).innerHTML = '<span class="text-sm text-slate-400">Empty</span>';
      return;
    }
    const more = size - nodes.length;
    $(id).innerHTML =
      nodes.map((n, k) => `<div class="front-card">${mini(n.state, k === 0 ? "hl" : "")}<div class="vals">d=${n.depth} · ${nodeVals(n, info)}</div></div>`).join("") +
      (more > 0 ? `<div class="flex items-center text-sm text-slate-400 px-2">+ ${fmt(more)} more</div>` : "");
  }

  function renderExplored(ev) {
    const isTree = ev.limit !== undefined;
    $("exploredNote").textContent = isTree ? `(${fmt(ev.exploredSize)} expanded in this pass; latest first)` : `(${fmt(ev.exploredSize)} states; latest first)`;
    $("explored").innerHTML = ev.explored.length ? ev.explored.map((s) => `<div class="front-card">${mini(s)}</div>`).join("") : '<span class="text-sm text-slate-400">Empty</span>';
  }

  function stat(label, value) {
    return `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value">${value}</div></div>`;
  }

  function renderStats(ev, info) {
    if (!ev) {
      $("statsGrid").innerHTML = ["Nodes generated", "Nodes expanded", "Frontier size", "Explored size", "Current depth", "Path cost g(n)"].map((l) => stat(l, "–")).join("");
      return;
    }
    const n = ev.node;
    let html =
      stat("Nodes generated", fmt(ev.generated)) +
      stat("Nodes expanded", fmt(ev.expanded)) +
      stat("Frontier size", fmt(ev.frontierSize)) +
      stat("Explored size", fmt(ev.exploredSize)) +
      stat("Current depth", n ? n.depth : ev.depth !== undefined ? fmt(ev.depth) : "–") +
      stat("Path cost g(n)", n ? n.g : "–");
    if (info && info.informed) html += stat("Heuristic h(n)", n ? n.h : "–") + stat("f(n)", n ? n.f : "–");
    if (ev.limit !== undefined) html += stat("Depth limit", ev.limit);
    $("statsGrid").innerHTML = html;
  }

  function showResult() {
    const r = P.run;
    const t = P.timed;
    if (!$("summaryCard").classList.contains("hidden")) return;
    $("summaryCard").classList.remove("hidden");
    $("summaryBadge").textContent = r.found ? "Solution Found" : "Solution Not Found";
    $("summaryBadge").className = "badge " + (r.found ? "badge-green" : "badge-red");
    $("summaryGrid").innerHTML =
      stat("Solution", r.found ? "Found" : "Not found") +
      stat("Total moves", fmt(r.moveCount)) +
      stat("Nodes generated", fmt(r.generated)) +
      stat("Nodes expanded", fmt(r.expanded)) +
      stat("Max search depth", fmt(r.maxDepth)) +
      stat("Execution time", fmtTime(t.timeMs)) +
      stat("Path cost", fmt(r.cost)) +
      stat("Memory (approx.)", `${fmtBytes(r.memoryBytes)} <span class="text-xs font-medium text-slate-500">${r.memoryLabel}</span>`);
    const bits = [`${r.algoName}`];
    if (Search.ALGORITHMS[r.algo].informed) bits.push(Puzzle.HEURISTICS[r.options.heuristic].label);
    if (r.algo === "dls") bits.push(`depth limit ${r.options.depthLimit}`);
    if (r.algo === "iddls" && r.finalLimit !== null) bits.push(`${r.iterations} passes (limits 0 to ${r.finalLimit})`);
    bits.push(r.options.costModel === "tile" ? "move cost = tile number" : "every move costs 1");
    if (!r.found) bits.push("result: " + r.status);
    $("summaryNote").textContent = bits.join(" · ") + ". Time is from a separate run without the step recording.";
    if (r.found) $("pathCard").classList.remove("hidden");
  }
  function hideResult() {
    $("summaryCard").classList.add("hidden");
    $("pathCard").classList.add("hidden");
  }

  const PATH_SHOW = 80;
  function renderPathList() {
    const r = P.run;
    if (!r.found) {
      $("pathList").innerHTML = "";
      return;
    }
    const n = r.path.length;
    const idxs = n <= PATH_SHOW ? [...Array(n).keys()] : [...Array(60).keys(), -1, ...Array.from({ length: 15 }, (_, k) => n - 15 + k)];
    $("pathNote").textContent =
      n <= PATH_SHOW
        ? `${fmt(r.moveCount)} moves. Click any step to jump to it.`
        : `${fmt(r.moveCount)} moves, which is too long to show in full. Showing the first 60 and last 15 steps. Click any step to jump to it.`;
    $("pathList").innerHTML = idxs
      .map((i, k) => {
        if (i === -1) return '<div class="path-arrow px-3">… … …</div>';
        const arrow = k > 0 && idxs[k - 1] !== -1 ? '<div class="path-arrow">→</div>' : "";
        const label = i === 0 ? "Start" : `${i}. ${r.moves[i - 1]}`;
        return `${arrow}<div class="path-step" data-i="${i}">${mini(r.path[i], i === n - 1 ? "goal" : "")}<span class="text-[11px] text-slate-500">${label}</span></div>`;
      })
      .join("");
    $("pathList").querySelectorAll(".path-step").forEach((el) =>
      el.addEventListener("click", () => {
        stop();
        show(P.firstPathIdx + Number(el.dataset.i));
      })
    );
  }
  function highlightPath(i) {
    $("pathList").querySelectorAll(".path-step").forEach((el) => {
      const on = Number(el.dataset.i) === i;
      el.classList.toggle("active", on);
      if (on) el.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    });
  }

  /* ---------- control buttons ---------- */
  $("btnRun").addEventListener("click", runSearch);
  $("btnPause").addEventListener("click", stop);
  $("btnResume").addEventListener("click", play);
  $("btnNext").addEventListener("click", () => {
    stop();
    show(P.idx + 1);
  });
  $("btnPrev").addEventListener("click", () => {
    stop();
    show(P.idx - 1);
  });
  $("btnReset").addEventListener("click", resetPlayback);
  $("btnSkip").addEventListener("click", () => {
    stop();
    show(P.firstPathIdx >= 0 ? P.firstPathIdx : P.timeline.length - 1);
  });
  document.addEventListener("keydown", (e) => {
    if (location.hash !== "#solver" || ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName) || !P.timeline.length) return;
    if (e.code === "Space") {
      e.preventDefault();
      P.playing ? stop() : play();
    } else if (e.key === "ArrowRight") {
      stop();
      show(P.idx + 1);
    } else if (e.key === "ArrowLeft") {
      stop();
      show(P.idx - 1);
    }
  });

  /* =========================================================
   * Comparison page
   * ========================================================= */
  const ORDER = ["bfs", "dfs", "dls", "iddls", "ucs", "gbfs", "astar"];

  function refreshComparePuzzle() {
    const p = readPuzzle();
    const s = Puzzle.isValid(p.start) ? p.start : Puzzle.DEFAULT_START;
    const g = Puzzle.isValid(p.goal) ? p.goal : Puzzle.DEFAULT_GOAL;
    $("cmpStart").innerHTML = mini(s, "md");
    $("cmpGoal").innerHTML = mini(g, "md goal");
  }

  function emptyCompareTable() {
    $("cmpBody").innerHTML = ORDER.map((a) => {
      const A = Search.ALGORITHMS[a];
      const mine = a === "ucs";
      return `<tr class="${mine ? "mine-row" : ""}" id="row-${a}"><td><b>${A.short}</b>${mine ? ' <span class="badge badge-amber ml-1">assigned</span>' : ""}</td>${'<td class="text-slate-300">–</td>'.repeat(8)}</tr>`;
    }).join("");
    $("chartNodes").innerHTML = '<p class="text-sm text-slate-400">Run the comparison to see the chart.</p>';
    $("cmpNotes").innerHTML = '<li class="text-slate-400">Run the comparison first.</li>';
  }

  async function runCompare() {
    const p = readPuzzle();
    refreshComparePuzzle();
    if (!p.ok) {
      $("cmpNotes").innerHTML = `<li class="text-rose-600">${p.msg} Fix it on the Solver page.</li>`;
      return;
    }
    $("btnCompare").disabled = true;
    emptyCompareTable();
    const opts = { heuristic: $("cmpHeuristic").value, depthLimit: Math.max(0, Number($("cmpLimit").value) || 0), costModel: $("cmpCost").value };
    const results = {};
    for (const a of ORDER) {
      $("row-" + a).children[1].innerHTML = '<span class="text-indigo-500">running…</span>';
      await nextFrame();
      const r = Search.solve(a, p.start, p.goal, opts);
      results[a] = r;
      const mine = a === "ucs";
      $("row-" + a).innerHTML = `
        <td><b>${r.short}</b>${mine ? ' <span class="badge badge-amber ml-1">assigned</span>' : ""}</td>
        <td>${r.found ? '<span class="badge badge-green">Yes</span>' : `<span class="badge badge-red">No</span> <span class="text-xs text-slate-400">${r.status}</span>`}</td>
        <td>${fmt(r.moveCount)}</td>
        <td>${fmt(r.cost)}</td>
        <td>${fmt(r.expanded)}</td>
        <td>${fmt(r.generated)}</td>
        <td>${fmt(r.maxDepth)}</td>
        <td>${fmtTime(r.timeMs)}</td>
        <td>${r.memoryLabel} <span class="text-xs text-slate-400">(${fmtBytes(r.memoryBytes)})</span></td>`;
    }
    drawChart(results);
    writeNotes(results, opts);
    $("btnCompare").disabled = false;
  }

  function drawChart(results) {
    const max = Math.max(...ORDER.map((a) => results[a].expanded), 1);
    const scale = (v) => (v <= 0 ? 0 : (Math.log10(v + 1) / Math.log10(max + 1)) * 100);
    $("chartNodes").innerHTML = ORDER.map((a) => {
      const r = results[a];
      const cls = !r.found ? "fail" : a === "ucs" ? "mine" : "";
      return `<div class="bar-row"><span class="font-semibold text-slate-600">${r.short}</span>
        <div><div class="bar ${cls}" style="width:${Math.max(scale(r.expanded), 4)}%">${fmt(r.expanded)}</div></div></div>`;
    }).join("");
  }

  function writeNotes(R, opts) {
    const notes = [];
    const found = ORDER.filter((a) => R[a].found);
    if (found.length) {
      const best = Math.min(...found.map((a) => R[a].cost));
      const optimal = found.filter((a) => R[a].cost === best).map((a) => R[a].short);
      notes.push(`The cheapest solution costs <b>${best}</b>. It was found by: ${optimal.join(", ")}.`);
      const fewest = found.reduce((x, y) => (R[x].expanded <= R[y].expanded ? x : y));
      notes.push(`<b>${R[fewest].short}</b> expanded the fewest nodes (${fmt(R[fewest].expanded)}).`);
    }
    if (R.ucs.found && R.astar.found)
      notes.push(`UCS and A* give the same cost (${R.ucs.cost}), but A* expanded ${fmt(R.astar.expanded)} nodes against ${fmt(R.ucs.expanded)} for UCS. The heuristic saves a lot of work.`);
    if (opts.costModel === "unit" && R.bfs.found && R.ucs.found)
      notes.push("With every move costing 1, UCS returns the same number of moves as BFS. Switch the move cost to “tile number” to see UCS pick a cheaper (not always shorter) path.");
    if (opts.costModel === "tile" && R.bfs.found && R.ucs.found && R.bfs.cost !== R.ucs.cost)
      notes.push(`BFS uses the fewest moves (${R.bfs.moveCount}) but costs ${R.bfs.cost}. UCS pays only ${R.ucs.cost}, using ${R.ucs.moveCount} moves.`);
    if (R.dfs.found && R.bfs.found && R.dfs.moveCount > R.bfs.moveCount)
      notes.push(`DFS found a path, but it is ${fmt(R.dfs.moveCount)} moves long. This shows why DFS is not optimal.`);
    if (!R.dls.found) notes.push(`DLS failed with limit ${opts.depthLimit}, because the solution is deeper than the limit.`);
    if (R.gbfs.found && R.astar.found && R.gbfs.cost > R.astar.cost)
      notes.push(`GBFS was quick but returned cost ${R.gbfs.cost} instead of the best ${R.astar.cost}. Greedy search is not optimal.`);
    $("cmpNotes").innerHTML = notes.map((n) => `<li>${n}</li>`).join("");
  }

  $("btnCompare").addEventListener("click", runCompare);

  /* =========================================================
   * Algorithm information page
   * ========================================================= */
  function renderInfo() {
    $("algoCards").innerHTML = ALGO_INFO.map(
      (a) => `
      <article class="card ${a.mine ? "ring-2 ring-amber-400" : ""}">
        <div class="flex items-start justify-between gap-3">
          <h2 class="card-title">${a.number}. ${a.name}</h2>
          <span class="badge ${a.type === "Informed" ? "badge-indigo" : "badge-slate"}">${a.type}</span>
        </div>
        ${a.mine ? '<span class="badge badge-amber mt-2">My assigned algorithm</span>' : ""}
        <div class="prose-simple text-sm">
          <p><b>Description.</b> ${a.description}</p>
          <p><b>Working principle.</b> ${a.principle}</p>
          <p class="mb-0"><b>Advantages</b></p>
          <ul>${a.advantages.map((x) => `<li>${x}</li>`).join("")}</ul>
          <p class="mb-0"><b>Limitations</b></p>
          <ul>${a.limitations.map((x) => `<li>${x}</li>`).join("")}</ul>
        </div>
        <dl class="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div class="stat"><dt class="stat-label">Time complexity</dt><dd class="font-semibold">${a.time}</dd></div>
          <div class="stat"><dt class="stat-label">Space complexity</dt><dd class="font-semibold">${a.space}</dd></div>
          <div class="stat"><dt class="stat-label">Completeness</dt><dd class="font-semibold">${a.complete}</dd></div>
          <div class="stat"><dt class="stat-label">Optimality</dt><dd class="font-semibold">${a.optimal}</dd></div>
        </dl>
      </article>`
    ).join("");

    const s = Puzzle.DEFAULT_START;
    const g = Puzzle.DEFAULT_GOAL;
    const val = { misplaced: Puzzle.misplacedTiles(s, g), manhattan: Puzzle.manhattan(s, g) };
    $("heuristicInfo").innerHTML = HEURISTIC_INFO.map(
      (h) => `<div>
        <h3 class="font-semibold text-slate-900">${h.name}</h3>
        <p class="text-sm text-slate-700 mt-2 leading-relaxed">${h.text}</p>
        <div class="mt-3 flex items-center gap-3 text-sm text-slate-600">${mini(s)}<span>→</span>${mini(g, "goal")}
          <span>For the example puzzle: <b>h = ${val[h.id]}</b> (real answer: 5 moves)</span></div>
      </div>`
    ).join("");

    $("summaryTable").innerHTML = ALGO_INFO.map(
      (a) => `<tr class="${a.mine ? "mine-row" : ""}"><td><b>${a.name}</b></td><td>${a.structure}</td><td class="whitespace-normal">${a.complete.split(" (")[0].split(",")[0]}</td><td class="whitespace-normal">${a.optimal.split(",")[0]}</td><td>${a.time.split(" ")[0]}</td><td>${a.space.split(" ")[0]}</td></tr>`
    ).join("");
  }

  /* =========================================================
   * Start up
   * ========================================================= */
  onAlgoChange();
  onInputChange();
  emptyCompareTable();
  renderInfo();
  route();
})();
