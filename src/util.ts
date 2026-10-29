export { RNG, flatMap, not, elem, except, attr, isNotNullOrUndefined, createRngStreamFromSource, clamp }
import { Observable } from "rxjs";
import { map, scan } from "rxjs/operators";

/**
 * A random number generator which provides two pure functions
 * `hash` and `scale`. Call `hash` repeatedly to generate the
 * sequence of hashes.
 */
abstract class RNG {
    private static m = 0x80000000; // 2^31
    private static a = 1103515245;
    private static c = 12345;

    /**
     * Call `hash` repeatedly to generate the sequence of hashes.
     * @param seed 
     * @returns a hash of the seed
     */
    public static hash = (seed: number) => (RNG.a * seed + RNG.c) % RNG.m;

    /**
     * Takes hash value and scales it to the range [-1, 1]
     */
    public static scale = (hash: number) => (2 * hash) / (RNG.m - 1) - 1;
    // hash / (RNG.m - 1) generates [0, 1], (2 * hash) / (RNG.m - 1) - 1; generates [0, 2] - 1 which is [-1, 1]
}

/**
 * apply f to every element of a and return the result in a flat array
 * @param a an array
 * @param f a function that produces an array
 */
function flatMap<T, U>(
    a: ReadonlyArray<T>,
    f: (a: T) => ReadonlyArray<U>
): ReadonlyArray<U> {
    return Array.prototype.concat(...a.map(f));
}

const
    /**
     * Composable not: invert boolean result of given function
     * @param f a function returning boolean
     * @param x the value that will be tested with f
     */
    not = <T>(f: (x: T) => boolean) => (x: T) => !f(x),
    /**
     * is e an element of a using the eq function to test equality?
     * @param eq equality test function for two Ts
     * @param a an array that will be searched
     * @param e an element to search a for
     */
    elem =
        <T>(eq: (_: T) => (_: T) => boolean) =>
            (a: ReadonlyArray<T>) =>
                (e: T) => a.findIndex(eq(e)) >= 0,
    /**
     * array a except anything in b
     * @param eq equality test function for two Ts
     * @param a array to be filtered
     * @param b array of elements to be filtered out of a
     */
    except =
        <T>(eq: (_: T) => (_: T) => boolean) =>
            (a: ReadonlyArray<T>) =>
                (b: ReadonlyArray<T>) => a.filter(not(elem(eq)(b))),
    /**
     * set a number of attributes on an Element at once
     * @param e the Element
     * @param o a property bag
     */
    attr = (e: Element, o: { [p: string]: unknown }) => { for (const k in o) e.setAttribute(k, String(o[k])) }
/**
 * Type guard for use in filters
 * @param input something that might be null or undefined
 */
function isNotNullOrUndefined<T extends object>(input: null | undefined | T): input is T {
    return input != null;
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(n, max));

/**
 * Create a deterministic random number stream based on a source stream and seed.
 * Returns values scaled to [-1, 1].
 */
function createRngStreamFromSource<T>(source$: Observable<T>) {
  return function createRngStream(
    seed: number = 0,
  ): Observable<number> {
    const randomNumberStream = source$.pipe(
      scan((acc, _) => {
        const nextSeed = RNG.hash(acc.seed);
        return { seed: nextSeed, value: RNG.scale(nextSeed) };
      }, { seed, value: RNG.scale(seed) }),
      map(k => k.value)
    );
    return randomNumberStream;
  };
}
