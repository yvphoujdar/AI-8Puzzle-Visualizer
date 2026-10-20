/*
 * info.js
 * Text shown on the "Algorithms" page.
 */

const ALGO_INFO = [
  {
    id: "bfs",
    number: 1,
    name: "Breadth First Search (BFS)",
    type: "Uninformed",
    structure: "FIFO queue",
    description:
      "BFS searches the puzzle level by level. It first looks at every board one move away from the start, then every board two moves away, and so on until it reaches the goal.",
    principle:
      "Nodes wait in a first-in-first-out queue. The oldest node is taken out and expanded, and its new children are added to the back of the queue. A set of already seen boards stops the same board from being added twice. BFS checks for the goal as soon as a child is created.",
    advantages: [
      "Always finds the solution with the fewest moves.",
      "Simple to understand and to code.",
    ],
    limitations: [
      "Has to keep a whole level of the search in memory, which grows very fast.",
      "Becomes slow for puzzles that need many moves.",
      "Does not look at move costs, so it is not the cheapest when moves cost different amounts.",
    ],
    time: "O(b^d)",
    space: "O(b^d)",
    complete: "Yes (the branching factor is finite)",
    optimal: "Yes, when every move costs the same",
  },
  {
    id: "dfs",
    number: 2,
    name: "Depth First Search (DFS)",
    type: "Uninformed",
    structure: "LIFO stack",
    description:
      "DFS keeps going deeper along one line of moves and only backs up when it gets stuck. It explores one branch completely before trying the next.",
    principle:
      "Nodes are kept on a last-in-first-out stack, so the newest node is expanded first. In this project DFS also keeps an explored set, so it never expands the same board twice and cannot loop forever.",
    advantages: [
      "In its basic (tree) form it only needs memory for the current path.",
      "Can sometimes stumble on a solution quickly.",
    ],
    limitations: [
      "The solution it finds is usually very long (often thousands of moves for the 8-puzzle).",
      "Not optimal.",
      "Without an explored set it can go round in circles; with one, memory use grows a lot.",
    ],
    time: "O(b^m)",
    space: "O(bm) for the tree version (more here because of the explored set)",
    complete: "Yes here, because the puzzle has a finite number of states and repeated states are skipped. Not in general.",
    optimal: "No",
  },
  {
    id: "dls",
    number: 3,
    name: "Depth Limited Search (DLS)",
    type: "Uninformed",
    structure: "LIFO stack with a depth limit",
    description:
      "DLS is DFS with a stopping depth l. It never goes deeper than l moves from the start.",
    principle:
      "It works like DFS, but a node at depth l is only checked for the goal and is not expanded. Within one run it also remembers the smallest depth at which each board was reached, so it does not search the same board again from a deeper level.",
    advantages: [
      "Never wanders off into very deep branches.",
      "Uses little memory.",
      "Good when you roughly know how many moves the answer needs.",
    ],
    limitations: [
      "If l is smaller than the real solution depth, it reports a cutoff and finds nothing.",
      "If l is much bigger than needed, the answer may be longer than the best one.",
    ],
    time: "O(b^l)",
    space: "O(bl)",
    complete: "Only if l is at least the solution depth d",
    optimal: "No",
  },
  {
    id: "iddls",
    number: 4,
    name: "Iterative Deepening Depth Limited Search (IDDLS)",
    type: "Uninformed",
    structure: "Repeated DLS runs (stack)",
    description:
      "IDDLS runs DLS again and again with limits 0, 1, 2, 3 and so on, until a run finds the goal.",
    principle:
      "Each run is a fresh DLS with a limit one bigger than the last. Because the limit grows one step at a time, the first time the goal appears it is at the smallest possible depth.",
    advantages: [
      "Finds the shortest solution like BFS.",
      "Uses memory like DFS, so it works well when memory is tight.",
    ],
    limitations: [
      "The top levels are searched again in every run, so some work is repeated.",
      "Gets slow for deep puzzles.",
    ],
    time: "O(b^d)",
    space: "O(bd)",
    complete: "Yes",
    optimal: "Yes, when every move costs the same",
  },
  {
    id: "ucs",
    number: 5,
    name: "Uniform Cost Search (UCS)",
    type: "Uninformed",
    structure: "Priority queue ordered by g(n)",
    mine: true,
    description:
      "UCS always expands the node with the lowest total path cost g(n) so far. It is like BFS, but it spreads out by cost instead of by number of moves.",
    principle:
      "Nodes wait in a priority queue sorted by g(n), the cost from the start. The cheapest node is taken out first. If a cheaper way to reach a board is found, its cost is updated. The goal is checked when a node is taken out of the queue, not when it is created. This is what guarantees the cheapest answer, because by then no cheaper path can still be waiting.",
    advantages: [
      "Always finds the cheapest path, even when moves have different costs.",
      "Does not need a heuristic.",
      "Equal to BFS when all moves cost 1, so it is a safe general choice.",
    ],
    limitations: [
      "Spreads out evenly in every direction, so it can expand a huge number of nodes.",
      "Keeps every frontier node in memory.",
      "The priority queue makes each step a little slower than BFS.",
    ],
    time: "O(b^(1 + C*/ε))",
    space: "O(b^(1 + C*/ε))",
    complete: "Yes, if every move costs at least some ε > 0",
    optimal: "Yes",
  },
  {
    id: "gbfs",
    number: 6,
    name: "Greedy Best First Search (GBFS)",
    type: "Informed",
    structure: "Priority queue ordered by h(n)",
    description:
      "GBFS always expands the board that looks closest to the goal, using only the heuristic h(n).",
    principle:
      "Nodes are kept in a priority queue sorted by h(n) (Misplaced Tiles or Manhattan Distance). It does not care how much it has already spent, only how close the board looks to the goal.",
    advantages: [
      "Usually very fast and expands very few nodes.",
      "Low memory use in practice.",
    ],
    limitations: [
      "Not optimal: the answer can be much longer than the best one.",
      "Can be misled by a heuristic that looks good but leads away from the goal.",
    ],
    time: "O(b^m) in the worst case",
    space: "O(b^m) in the worst case",
    complete: "Yes here (finite states, repeated states skipped)",
    optimal: "No",
  },
  {
    id: "astar",
    number: 7,
    name: "A* Search",
    type: "Informed",
    structure: "Priority queue ordered by f(n) = g(n) + h(n)",
    description:
      "A* mixes UCS and GBFS. It ranks each node by f(n) = g(n) + h(n): the cost so far plus a guess of the cost still left.",
    principle:
      "Nodes are kept in a priority queue sorted by f(n). The goal is checked when a node is taken out. Both heuristics used here never over-estimate the real remaining cost (they are admissible), so A* always returns the cheapest solution.",
    advantages: [
      "Optimal, like UCS.",
      "Expands far fewer nodes than UCS or BFS thanks to the heuristic.",
      "The better the heuristic, the faster it gets (Manhattan beats Misplaced Tiles).",
    ],
    limitations: [
      "Still keeps all generated nodes in memory.",
      "Its speed depends a lot on how good the heuristic is.",
    ],
    time: "O(b^d) in the worst case (much less with a good heuristic)",
    space: "O(b^d)",
    complete: "Yes",
    optimal: "Yes, with an admissible heuristic",
  },
];

const HEURISTIC_INFO = [
  {
    id: "misplaced",
    name: "h1: Misplaced Tiles",
    text:
      "Counts how many tiles are not in their goal square. The blank is not counted. Every misplaced tile needs at least one move, so this never over-estimates the real number of moves (it is admissible).",
  },
  {
    id: "manhattan",
    name: "h2: Manhattan Distance",
    text:
      "For each tile, count how many rows plus columns it is away from its goal square, then add these up. A tile can only move one square at a time, so this is also admissible. It is never smaller than Misplaced Tiles, so it gives better guidance and A* expands fewer nodes with it.",
  },
];
