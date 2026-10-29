export { initialState };
import {
    Observable,
    filter,
    fromEvent,
    interval,
    map,
    scan,
    merge,
    switchMap,
    startWith,
    of,
    from,
    timer,
    mergeMap,
    takeWhile,
    concatWith,
} from "rxjs";
import { createRngStreamFromSource, RNG, clamp } from "./util";
import { State, Constants, Viewport, Pipe } from "./types";

const initialState: State = {
    birdY: Viewport.CANVAS_HEIGHT / 3,
    birdVy: 0,
    score: 0,
    lives: 5,
    gameEnd: false,
    pipes: [],
    expiredPipes: [],
    nextPipeId: 0,
    rngSeed: Constants.SEED,
    wasColliding: false,
    won: false,
    allPipesSpawned: false,
};

const BIRD_X = Viewport.CANVAS_WIDTH * 0.2;

const pipeRightEdge = (p: Pipe) => p.x + p.width;

const tick$ = interval(Constants.TICK_RATE_MS).pipe(
    map(() => (s: State) => {
        const nextVY = s.birdVy + Constants.GRAVITY;
        const previousY = s.birdY;
        const nextY = s.birdY + s.birdVy;

        // move pipes first
        const movedPipes = s.pipes.map(p => ({
            ...p,
            x: p.x - Constants.PIPE_SPEED,
        }));

        const hit = movedPipes.find(p => {
            const inX = BIRD_X > p.x && BIRD_X < p.x + p.width;
            const inY = nextY > p.y && nextY < p.y + p.height;
            // uses nextY so we can forecast a collision happening in case of large changes in velocity
            return inX && inY;
        });

        const collidedPipeID = hit?.pairId;

        const collidedPipes =
            collidedPipeID != null
                ? movedPipes.map(p =>
                      p.pairId === collidedPipeID
                          ? { ...p, collided: true }
                          : p,
                  )
                : movedPipes;
        // if there is a collision with a pipe, changes all of the pipes collided with to be true for collided

        // scoring: right edge crossing birb
        const justPassed = collidedPipes.filter(
            p =>
                p.type === "bottom-pipe" && //use bottom pipe to count once per pair
                !p.collided &&
                pipeRightEdge(p) <= BIRD_X &&
                // checks if pipe’s right edge has gone past or equal to the bird’s x
                pipeRightEdge(p) + Constants.PIPE_SPEED > BIRD_X,
            // checks if pipe’s right edge was still to the right of the bird in the last frame
        ).length; // Altogether, checks if pipe has JUST PASSED the bird by taking into account the last frame

        const score = s.score + justPassed;

        // off-screen
        const expiredPipes = collidedPipes.filter(p => pipeRightEdge(p) <= 0);
        const pipes = collidedPipes.filter(p => pipeRightEdge(p) > 0);

        // collision (treat bird as a point at BIRD_X, yNext)

        const hitCeiling = nextY < 0;
        const hitFloor = nextY > Constants.GROUND;

        const anyBounce = !!hit || hitCeiling || hitFloor;
        // !! forces value to be a boolean (truthy/falsy), used on hit as it could return undefined.
        // ! converts to boolean and flips value, ! flips it back
        const newSeed = anyBounce ? RNG.hash(s.rngSeed) : s.rngSeed;
        const rawScaled = anyBounce ? RNG.scale(newSeed) : 0;
        const rngBounceFactor = clamp(
            anyBounce ? (rawScaled + 1) / 2 : 0,
            0.3,
            0.7,
        );
        // clamps the rngBounceFactor
        const bounceMultipler = 1.5;
        const rngBounceFactorScaled = rngBounceFactor * bounceMultipler;

        const wallCollision = hitCeiling
            ? { y: 0, vy: Math.abs(nextVY) * rngBounceFactorScaled } // bounce downwards
            : hitFloor
              ? {
                    y: Constants.GROUND,
                    vy: -Math.abs(nextVY) * rngBounceFactorScaled,
                } // bounce upwards
              : null;

        // pipe faces (use previous vs next to detect which face was crossed)
        const pipeResolution = hit
            ? (() => {
                  const topFace = hit.y; // top side of the collided pipe
                  const bottomFace = hit.y + hit.height; // bottom side of the collided pipe

                  // crossed top face (came from above)
                  const crossedTop = previousY <= topFace && nextY >= topFace;
                  // crossed bottom face (came from below)
                  const crossedBottom =
                      previousY >= bottomFace && nextY <= bottomFace;

                  return crossedTop
                      ? {
                            y: topFace,
                            vy: -Math.abs(nextVY) * rngBounceFactorScaled,
                        } // bounce upward (invert to upward)
                      : crossedBottom
                        ? {
                              y: bottomFace,
                              vy: Math.abs(nextVY) * rngBounceFactorScaled,
                          } // bounce downward
                        : { y: nextY, vy: nextVY }; // fallback (shouldn’t really happen)
              })()
            : null;

        const resolution = pipeResolution ??
            wallCollision ?? { y: nextY, vy: nextVY };

        // const lives = hit || hitCeiling || hitFloor ? s.lives - 1 : s.lives;

        const isColliding = !!hit || hitCeiling || hitFloor;
        const lives = !s.wasColliding && isColliding ? s.lives - 1 : s.lives;

        const won = s.allPipesSpawned && pipes.length === 0;
        // game is won when there are no more pipes on screen, and theres no more pipes to spawn.
        const gameEnd = lives <= 0 || won;

        return {
            ...s,
            birdVy: resolution.vy,
            birdY: resolution.y,
            pipes,
            expiredPipes,
            score,
            lives,
            rngSeed: newSeed,
            gameEnd,
            wasColliding: isColliding,
            won,
        };
    }),
);

const parseCsv = (text: string) =>
    text
        .trim()
        .split("\n")
        .slice(1) // extracts one line, slice(1) is used to skip header
        .map(line => {
            const [gap_y, gap_height, time] = line.split(","); // Splits into array of values
            return {
                gapY: parseFloat(gap_y) * Viewport.CANVAS_HEIGHT,
                gapHeight: parseFloat(gap_height) * Viewport.CANVAS_HEIGHT,
                ms: parseFloat(time) * 1000, // convert to seconds
            };
        });

const jump$: Observable<(s: State) => State> = fromEvent<KeyboardEvent>(
    document,
    "keydown",
).pipe(
    filter(event => event.code === "Space"),
    map(_ => s => ({ ...s, birdVy: -10 })),
);

const rngJump$ = createRngStreamFromSource(jump$)(Constants.SEED);
const randomJump$: Observable<(s: State) => State> = rngJump$.pipe(
    map(i => {
        const normalJump = (i + 1) / 2; // Generates [0,1]
        const scaledJump = -6 + normalJump * 2;

        return s => ({
            ...s,
            birdVy: scaledJump,
        });
    }),
);

const restart$: Observable<Event> = fromEvent<KeyboardEvent>(
    document,
    "keydown",
).pipe(filter(event => event.code === "KeyR"));

/**
 * state$
 * ------
 * Constructs the *pure* game model as an Observable of immutable `State`.
 *
 * Inputs:
 * `csvContents`: Level specification (gap positions/heights with timestamps).
 *
 * Composition:
 * Time: `interval(TICK_RATE_MS)` → reducer that advances physics and collisions.
 * Input: `jump$` (or `randomJump$`) → reducers that modify vertical velocity.
 * Level: `buildPipeSpawn$` schedules pipe-pair insertions via `timer(ms)`.
 *   All three are merged into a stream of `(State) => State` reducers, then accumulated with
 *   `scan` starting at `initialState`.
 *
 *
 * Design choices / rationale:
 * Each upstream stream emits functions that transform State
 * State is readonly record; updates create new arrays/values.
 *  RNG is explicit (seed carried in State; `hash/scale` are pure).
 */

export const state$ = (csvContents: string): Observable<State> => {
    // creates pipe information based on info passed from csv
    const pipePairFromGap = (
        pairId: number,
        x: number,
        gapY: number,
        gapHeight: number,
    ): [Pipe, Pipe] => {
        const topY = 0;
        const topH = gapY - gapHeight / 2;

        const bottomY = gapY + gapHeight / 2;
        const bottomH = Viewport.CANVAS_HEIGHT - (gapY + gapHeight / 2);

        const top: Pipe = {
            id: `${pairId}-top`,
            type: "top-pipe",
            x,
            y: topY,
            width: Constants.PIPE_WIDTH,
            height: topH,
            pairId,
            collided: false,
        };

        const bottom: Pipe = {
            id: `${pairId}-bottom`,
            type: "bottom-pipe",
            x,
            y: bottomY,
            width: Constants.PIPE_WIDTH,
            height: bottomH,
            pairId,
            collided: false,
        };

        return [top, bottom];
    };

    // changes pipes state to build pipes
    const buildPipeSpawn$ = (csv: string) => {
        const rows = parseCsv(csv);

        return from(rows).pipe(
            mergeMap(({ gapY, gapHeight, ms }) =>
                timer(ms).pipe(
                    //delays pipes generation by the timer in csv file
                    map(() => (s: State): State => {
                        const id = s.nextPipeId;
                        const x = Viewport.CANVAS_WIDTH + Constants.PIPE_WIDTH;
                        const [topPipe, botPipe] = pipePairFromGap(
                            s.nextPipeId,
                            x,
                            gapY,
                            gapHeight,
                        );
                        return {
                            ...s,
                            nextPipeId: id + 1,
                            pipes: [...s.pipes, topPipe, botPipe],
                        };
                    }),
                ),
            ),

            // Start the state by telling that all the pipes are not done spawning
            startWith((s: State): State => ({ ...s, allPipesSpawned: false })),

            // After the pipes are done being built, the function emits a state telling all the pipes are spawned.
            concatWith(
                of((s: State): State => ({ ...s, allPipesSpawned: true })),
            ),
        );
    };

    return restart$.pipe(
        startWith(null), // starts the game without pressing r on first load
        switchMap(() => {
            const spawn$ = buildPipeSpawn$(csvContents);
            const reducers$ = merge(tick$, randomJump$, spawn$);
            return reducers$.pipe(
                scan((state, reducerFn) => reducerFn(state), initialState),
                takeWhile(s => !s.gameEnd, true), // mirrors source values and checks if the game ends. If so, then stop the game
            );
        }),
    );
};
