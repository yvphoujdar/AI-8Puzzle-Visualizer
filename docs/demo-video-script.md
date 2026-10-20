# Demo Video Script (about 4 minutes)

Use this as a guide while screen recording. Speak normally; you don't need to read it word for word.

---

## 0:00 – 0:25 · Introduction (Home page)

- "Hi, I'm Yash Phoujdar, registration number 24BCE2152. This is my Artificial Intelligence digital assignment: an interactive 8-puzzle solver using AI search algorithms."
- "My assigned algorithm is number 5, Uniform Cost Search. I have also built the other six so they can be compared."
- Point at the animated board: "The 8-puzzle is a 3 by 3 board with eight tiles and one blank. We move the blank up, down, left or right until we reach the goal."

## 0:25 – 0:50 · Puzzle input (Solver page)

- Open **Solver**. "Here I can type the initial and goal states, or press *Use example* for the one in the question."
- Press **Generate Random Puzzle** once. "This makes a random puzzle that is always solvable, because it starts from the goal and makes random moves."
- Change one cell to make it unsolvable and show the red message. "The app checks inversion parity and tells me if a puzzle can't be solved." Press **Use example** again.

## 0:50 – 2:00 · Uniform Cost Search step by step

- Select **Uniform Cost Search**, cost = *Every move costs 1*, press **Run**, then **Pause**.
- Use **Next Step** a few times and explain:
  - "The highlighted board is the node being expanded, and next to it is its parent."
  - "These are the generated successors. Each one shows its path cost g, and whether it was added to the frontier or skipped because it was already explored."
  - "The frontier is a priority queue sorted by g(n), so the cheapest node always comes out first. Below it is the explored list."
  - "The counters show nodes generated, expanded, frontier size and current depth."
- Press **Previous Step** once to show you can go back, then change the **speed** and press **Resume**.
- When the goal is reached: "The summary shows the solution was found in 5 moves, with nodes generated, expanded, max depth, time, path cost and memory."
- Point at the final path: "The blank's movement is animated along this path."

## 2:00 – 2:40 · Why UCS matters (tile cost)

- Set the start to `4 1 3 / 8 2 5 / 7 6 _`, set cost to **Move cost = number on the tile**.
- "Now each move costs the number on the tile that slides. BFS only counts moves, but UCS looks at the real cost."
- Go to **Comparison** and press **Run comparison**.
- "BFS finds 12 moves but the cost is 62. UCS takes 14 moves but the cost is only 48, which is the cheapest. A* gets the same cost but expands fewer nodes because of its heuristic."

## 2:40 – 3:30 · Comparison and heuristics

- Switch cost back to *Every move = 1* and run again.
- "BFS, IDDLS, UCS and A* all find the optimal 14 moves. DFS finds a path that is thousands of moves long, so it is not optimal. DLS with limit 10 fails because the solution is deeper than the limit. GBFS is the fastest but gives a longer path."
- Go to **Solver**, choose **A\***, run it, and point at h, g and f.
- "There are two heuristics. Misplaced Tiles counts tiles in the wrong place. Manhattan Distance adds up how far each tile is from its goal. Both never over-estimate, so A* stays optimal, and Manhattan expands fewer nodes."

## 3:30 – 4:00 · Algorithm page and wrap up

- Open **Algorithms** and scroll. "This page explains every algorithm: how it works, its advantages, limitations, time and space complexity, completeness and optimality."
- Show the GitHub repository and README briefly.
- "The site is built with HTML, Tailwind CSS and plain JavaScript, and it is deployed on GitHub Pages. Thank you."
