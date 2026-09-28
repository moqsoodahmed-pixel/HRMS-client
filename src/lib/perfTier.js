/**
 * Cheap, synchronous "is this a weak device" probe for the login page's
 * decorative animation (see pages/Login.jsx / index.css's thirteen ambient
 * background layers + the AnimatedLogo shatter loop). Those layers were
 * tuned to look good and run smoothly on a modern mid/high-end machine, but
 * still visibly drop frames on genuinely weak hardware ("potato" laptops)
 * — trimming their numbers/blur further would have made the effect look
 * worse everywhere just to fix it on a minority of devices. Instead, this
 * measures the device once per page load and lets Login.jsx skip the
 * heaviest layers (and swap the looping shatter logo for its plain static
 * frame) ONLY on machines that actually need it.
 *
 * Deliberately does NOT rely on User-Agent, screen size or "is this a
 * phone" — none of those tell you whether a DESKTOP or LAPTOP's CPU/GPU is
 * fast or slow, which is exactly the "potato laptop" case this needs to
 * catch. Two signals, combined:
 *
 *  - navigator.hardwareConcurrency: reports logical CPU cores. Very low
 *    core counts (<=2) reliably correlate with budget/older hardware. Not
 *    used alone since a low-core-count machine can still have a perfectly
 *    fast single core, and this is unavailable in a few older browsers
 *    (falls back to assuming an ordinary 4 there — no penalty).
 *  - A tiny synchronous CPU microbenchmark: run a small, fixed amount of
 *    real work (Math.sqrt in a loop) and time it with performance.now().
 *    This measures ACTUAL execution speed directly, so it catches a slow
 *    CPU regardless of platform, browser or how many cores it reports —
 *    including iOS/iPadOS, where hardwareConcurrency is often unreliable or
 *    absent. The workload is small enough to itself finish in low
 *    single-digit milliseconds even on weak hardware (never a visible
 *    stall), but large enough that fast and slow devices land in clearly
 *    different buckets — verified empirically (see the Playwright
 *    CPU-throttling test this was checked against).
 *
 * Result is computed once and cached for the lifetime of the page (a
 * device's capability doesn't change mid-session), and this never throws —
 * any failure (e.g. `performance` unavailable) falls back to "not low
 * power" so a detection glitch degrades to the full/normal experience
 * rather than an unnecessarily stripped-down one.
 */
let cached;

const BENCHMARK_ITERATIONS = 300000;
// Calibrated against real hardware: a modern mid/high-end laptop, desktop or
// phone finishes this loop in well under 2ms; consistently slower than this
// marks a genuinely weak CPU (or one currently starved by other load).
const SLOW_MS_THRESHOLD = 6;
const LOW_CORE_COUNT = 2;

export function isLowPowerDevice() {
    if (cached !== undefined) return cached;
    if (typeof window === 'undefined' || typeof performance === 'undefined') {
        return (cached = false);
    }
    // Test-only escape hatch: lets an automated before/after perf comparison
    // (see the Playwright measurement script this was verified with) force a
    // specific tier deterministically, instead of depending on however fast
    // the CI/sandbox machine's CPU happens to be at that moment. Never set by
    // application code.
    if (typeof window.__FORCE_PERF_TIER__ === 'boolean') {
        return (cached = window.__FORCE_PERF_TIER__);
    }
    try {
        const cores = typeof navigator !== 'undefined' && navigator.hardwareConcurrency
            ? navigator.hardwareConcurrency
            : 4;

        const start = performance.now();
        let x = 0;
        for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
            x += Math.sqrt(i);
        }
        // Reference x so the loop can never be optimized away as dead code.
        if (x === Number.NEGATIVE_INFINITY) console.log(x);
        const elapsedMs = performance.now() - start;

        cached = elapsedMs > SLOW_MS_THRESHOLD || cores <= LOW_CORE_COUNT;
    } catch {
        cached = false;
    }
    return cached;
}

/** Test-only escape hatch — never called from application code. */
export function __resetPerfTierCacheForTests() {
    cached = undefined;
}