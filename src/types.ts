export { Constants, Birb, Viewport };
export type { State, Pipe };

const Viewport = {
    CANVAS_WIDTH: 600,
    CANVAS_HEIGHT: 400,
} as const;

const Birb = {
    // WIDTH: 42,
    // HEIGHT: 30,
    WIDTH: 63,
    HEIGHT: 45,
} as const;

const Constants = {
    PIPE_WIDTH: 30,
    PIPE_SPEED: 3, // pixels per tick
    TICK_RATE_MS: 1000 / 60, // Might need to change this!
    GRAVITY: 0.5,
    GROUND: Viewport.CANVAS_HEIGHT,
    SEED: 1234,
} as const;

// User input

type Key = "Space";

// State processing

type Pipe = Readonly<GameObject & { pairId: number; collided: boolean }>;

type State = Readonly<{
    birdY: number;
    birdVy: number;
    score: number;
    lives: number;
    gameEnd: boolean;
    pipes: ReadonlyArray<Pipe>;
    expiredPipes: ReadonlyArray<Pipe>;
    nextPipeId: number;
    rngSeed: number;
    wasColliding: boolean;
    won: boolean;
    allPipesSpawned: boolean;
}>;

type GameObject = Readonly<
    Rect & {
        id: string;
        type: objectType;
    }
>;

type Rect = Readonly<{
    x: number;
    y: number;
    width: number;
    height: number;
}>;

type objectType = "birb" | "top-pipe" | "bottom-pipe";
