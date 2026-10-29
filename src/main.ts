/**
 * Connects keyboard input and the reactive game state to an SVG renderer.
 * Rendering updates the bird, pipe elements, score, lives, and end-game overlays.
 * Original reactive-game reference: https://tgdwyer.github.io/asteroids/
 */

import "./style.css";
import birdUrl from "../assets/bird.svg?url";
import csvUrl from "../assets/map.csv?url";

import {
    catchError,
    filter,
    fromEvent,
    map,
    switchMap,
    take,
    pairwise,
} from "rxjs";
import { fromFetch } from "rxjs/fetch";

import { State, Constants, Birb, Viewport, Pipe } from "./types"
import { state$ } from "./state";
import { RNG, attr, isNotNullOrUndefined, createRngStreamFromSource 

} from "./util"



/**
 * Updates the state by proceeding with one time step.
 *
 * @param s Current state
 * @returns Updated state
 */
const tick = (s: State) => s;

// Rendering (side effects)

/**
 * Brings an SVG element to the foreground.
 * @param elem SVG element to bring to the foreground
 */
const bringToForeground = (elem: SVGElement): void => {
    elem.parentNode?.appendChild(elem);
};

/**
 * Displays a SVG element on the canvas. Brings to foreground.
 * @param elem SVG element to display
 */
const show = (elem: SVGElement): void => {
    elem.setAttribute("visibility", "visible");
    bringToForeground(elem);
};

/**
 * Hides a SVG element on the canvas.
 * @param elem SVG element to hide
 */
const hide = (elem: SVGElement): void => {
    elem.setAttribute("visibility", "hidden");
};

/**
 * Creates an SVG element with the given properties.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/SVG/Element for valid
 * element names and properties.
 *
 * @param namespace Namespace of the SVG element
 * @param name SVGElement name
 * @param props Properties to set on the SVG element
 * @returns SVG element
 */
const createSvgElement = (
    namespace: string | null,
    name: string,
    props: Record<string, string> = {},
): SVGElement => {
    const elem = document.createElementNS(namespace, name) as SVGElement;
    Object.entries(props).forEach(([k, v]) => elem.setAttribute(k, v));
    return elem;
};

/**
 * render
 * -------
 * Creates SVG elements and returns a frame renderer `(State) => void`.
 * 
 * - This renderer owns SVG updates; input subscriptions are created separately.
 *   Game state transitions happen upstream in Observables and pure reducers.
 *
 * Contracts / assumptions:
 * - `State` is immutable and fully describes everything needed to draw a frame.
 * - Pipe identifiers are unique and stable for the lifetime of a pipe.
 * - The caller owns subscription lifecycles; SVG elements are reused between frames.
 * @returns A function `(s: State) => void` that projects `s` onto the SVG.
 */

const render = (): ((s: State) => void) => {

    // Canvas elements
    const gameOver = document.querySelector("#gameOver") as SVGElement;
    const gameWin = document.querySelector("#gameWin") as SVGElement;
    const container = document.querySelector("#main") as HTMLElement;

    // Text fields
    const livesText = document.querySelector("#livesText") as HTMLElement;
    const scoreText = document.querySelector("#scoreText") as HTMLElement;

    const svg = document.querySelector("#svgCanvas") as SVGSVGElement;

    svg.setAttribute(
        "viewBox",
        `0 0 ${Viewport.CANVAS_WIDTH} ${Viewport.CANVAS_HEIGHT}`,
    );

    /**
     * Renders the current state to the canvas.
     *
     * In MVC terms, this updates the View using the Model.
     *
     * @param s Current state
     */

    const birdImg = createSvgElement(svg.namespaceURI, "image", {
        id: "birb",
        href: birdUrl,
        x: `${Viewport.CANVAS_WIDTH * 0.2 - Birb.WIDTH / 2}`,
        y: `${Viewport.CANVAS_HEIGHT / 2 - Birb.HEIGHT / 2}`,
        width: `${Birb.WIDTH}`,
        height: `${Birb.HEIGHT}`,
    });
    svg.appendChild(birdImg);

    /**
     * Creates a new group element for the pipes if they do not exist
     */
    const pipesLayer =
        (svg.querySelector('#pipes') as SVGGElement) ??
        (() => {
            const g = document.createElementNS(svg.namespaceURI, 'g');
            g.setAttribute('id', 'pipes');
            svg.appendChild(g);
            return g;
        })();


    /**
     * If a pipe does not exist, create a new element on the svg for the pipe. Else, modify the
     * pipe's x position. 
     * @param rootSVG 
     * @returns 
     */
    const updatePipesView = (rootSVG: SVGSVGElement) => (p: Pipe) => {
        function createPipeView() {
            const pipe = document.createElementNS(rootSVG.namespaceURI, "rect");
            pipe.classList.add("pipe");
            attr(pipe, 
                { id: p.id, x: p.x , y: p.y , width: `${Constants.PIPE_WIDTH}`, 
                height: `${p.height}`, fill: "green"});
            pipesLayer.appendChild(pipe)
            return pipe; 
        }
        const pipe = document.getElementById(String(p.id)) || createPipeView(); 
        attr(pipe, { x: p.x });
    };
    
    return (s: State) => {
        hide(gameOver)
        hide(gameWin)
        s.pipes.forEach(updatePipesView(svg));
        // Checks and removed expired pipes (pipes that left the viewport)
        s.expiredPipes.map(p => document.getElementById(String(p.id)))
            .filter(isNotNullOrUndefined)
            .forEach(v => v.remove());
        if (s.gameEnd) {
            s.won ? show(gameWin) : show(gameOver);
        }
        birdImg.setAttribute("y", String(s.birdY - Birb.HEIGHT));
        scoreText.textContent = String(s.score)
        livesText.textContent = String(s.lives)
    };

};


// Load the level and start the reactive game after the first Space keypress.
if (typeof window !== "undefined") {

    // Get the file from URL
    const csv$ = fromFetch(csvUrl).pipe(
        switchMap(response => {
            if (response.ok) {
                return response.text();
            } else {
                throw new Error(`Fetch error: ${response.status}`);
            }
        }),
        catchError(err => {
            console.error("Error fetching the CSV file:", err);
            throw err;
        }),
    );

    // Observable: wait for first user click
    const click$ = fromEvent(document.body, "mousedown").pipe(take(1));
    const Space$ = fromEvent<KeyboardEvent>(document.body, "keydown").
    pipe(filter(event => event.code === "Space"), take(1));
    
    const draw = render(); 

    const game$ = csv$.pipe(
        switchMap(contents => Space$.pipe(switchMap(() => state$(contents)))),
    )

    const svg = document.querySelector("#svgCanvas") as SVGSVGElement;
        const pipesLayer =
            (svg.querySelector('#pipes') as SVGGElement) ??
            (() => {
            const g = document.createElementNS(svg.namespaceURI, 'g');
            g.setAttribute('id', 'pipes');
            svg.appendChild(g);
            return g;
    })()


    // Stream that checks whether we are at the start of a run by the pipes id changing
    const isStart$ = game$.pipe(
        map(s => s.nextPipeId === 0)
    );

    // Use pairwise to get [prev, curr] for each emission, turns emissions into a tuple
    const firstFrameOfRun$ = isStart$.pipe(
        pairwise(),
        filter(([prev, curr]) => !prev && curr), 
        // "detects" when isStart changes from false → true, meaning game has started
    );

    firstFrameOfRun$.subscribe(() => {
        pipesLayer.replaceChildren();
        // if game started, clear pipes layer to discard lingering pipes on restart
    })

    game$.subscribe(draw)
}
