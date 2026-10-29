# FlabbyBirb

A Flappy Bird-style browser game built with TypeScript, RxJS, and SVG. Fly through timed pipe obstacles, earn points for clean passes, and keep flying while lives remain.

**Features**

- Keyboard-controlled jumping with seeded variation in jump strength.
- Gravity, pipe and boundary collisions, and collision bounces.
- Five starting lives, with a life deducted when entering a collision.
- One point per pipe pair passed without a collision.
- A CSV-based level timeline, win/loss overlays, and restart support.
- A simple vector bird and matching favicon included in the source.

**Run locally**

Use Node.js 22.12 or later and npm.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Press **Space** to start and jump, and **R** to restart. Clear all scheduled obstacles before losing every life to win.

**Build and preview**

```sh
npm run build
npm run preview
```

The build type-checks the source and writes a static site to `dist/`. Bird artwork and the level CSV are bundled with the application. Relative asset paths support hosting under a repository subpath.

**How it works**

Physics ticks, keyboard input, and scheduled obstacle spawns produce functions of type `(State) => State`. RxJS `merge` combines those updates, and `scan` applies them to the latest state. The SVG renderer displays each emitted state. Restart uses `switchMap` to cancel the current run and begin again from the initial state.

| File | Responsibility |
| --- | --- |
| `src/main.ts` | Level loading, SVG rendering, and application wiring. |
| `src/state.ts` | Physics, collision responses, scoring, lives, input streams, and spawning. |
| `src/types.ts` | State types and game constants. |
| `src/util.ts` | Seeded random-number helpers and shared utilities. |
| `assets/map.csv` | Obstacle layout and spawn timeline. |
| `scripts/generate_pipes.ts` | Random level-generation script. |

State updates use readonly types and create new objects and arrays. The state module also constructs browser input streams, so it currently requires a DOM environment.

**Level format**

```csv
gap_y,gap_height,time
0.5,0.4,2
```

`gap_y` is the gap center as a fraction of canvas height; `gap_height` is its height as a fraction of canvas height; `time` is the spawn time in seconds from the start of a run. Each row creates a top and bottom pipe.

```sh
npm run generate-pipes
```

This command replaces `assets/map.csv` with a newly generated 20-pair level. The generator uses `Math.random()`; gameplay jumping and bouncing use seeded randomness.

**Tests and limitations**

```sh
npm run test:run
```

The existing tests only check that the state factory exists and is callable. The default Node test environment currently fails while importing the browser-dependent state module because `document` is unavailable. Gameplay coverage and separation of browser input from state transitions remain future improvements.

Collision detection treats the bird as a point. Physics advances by fixed increments per timer tick. The renderer and restart-cleanup logic currently subscribe independently to the game stream, creating duplicate executions. These are known limitations of this version.

**Background and references**

This project began from an educational starter project and was extended with gameplay logic. The public copy omits personal submission material and institutional identifiers.

- Reactive-game architecture reference: [Asteroids in FRP](https://tgdwyer.github.io/asteroids/).
- The SVG drop-shadow styling retains its original source reference in `src/style.css`.
