# AGENTS.md

## Project context

This project is an interactive simulator for small quantum circuits under physical/environmental constraints.

The original motivation was to build something lower-level than a typical logical quantum circuit simulator.  
Instead of focusing only on abstract circuit execution, this project aims to show how environmental conditions such as temperature, magnetic field, and noise affect the effective behavior of a small quantum circuit over time.

The project is **not** intended to be:
- a full general-purpose quantum SDK,
- a full reimplementation of QuTiP,
- a production-grade research simulator,
- or a game-first product.

The current direction is:
- beginner-friendly,
- interactive,
- visually understandable,
- physically motivated,
- and useful as a bridge between abstract circuits and low-level physical constraints.

This project should help users understand things like:
- why a circuit loses effectiveness under noise,
- how decoherence changes state evolution,
- how physical/environmental parameters affect usable circuit lifetime,
- and how simple circuit structure interacts with noisy open-system dynamics.

## Product positioning

This product should be treated as:

**a beginner-friendly interactive simulator for understanding physically constrained quantum circuits**

More specifically:
- it should be easy to try,
- easy to compare conditions,
- easy to see why a state degrades,
- and deep enough that expert-oriented details can later be added.

It should not drift toward:
- a generic library,
- a broad research platform,
- a high-fidelity pulse-level simulator,
- or an unfocused educational toy.

## Current development stage

We are building a 1-week MVP first.

The MVP exists to validate:
1. whether the internal model is understandable,
2. whether environmental parameters visibly affect the result,
3. whether the UI can communicate “effective circuit lifetime” intuitively.

The remaining full development period is about 4+ months, but current work should stay strictly within MVP scope unless explicitly expanded.

## Core design philosophy

The central value is **understanding**, not just computation.

If a feature only increases mathematical/general simulation power, but does not improve:
- interpretability,
- comparison,
- beginner accessibility,
- or visible cause-and-effect,

then it is probably not a priority.

When in doubt, prefer:
- clarity over completeness,
- scope control over feature growth,
- and interpretable outputs over raw internal complexity.

## Known constraints
- Development time is limited.
- MVP duration is 1 week.
- The final product should remain lightweight.
- The project should prioritize a strong UX and understandable outputs.
- The simulator should remain small-scale and not attempt large-system generality.

## UI philosophy
- Beginner mode should avoid unnecessary jargon.
- Expert-facing information may exist, but should not define the MVP.
- Outputs should explain degradation in an intuitive way.
- The user should always be able to see what changed and why.

## Destructive commands
Never run destructive commands without explicit user approval:
- rm -rf
- git clean -xfd
- git reset --hard
- git push --force
- database DROP/TRUNCATE/DELETE-all operations

## Secrets rule
- Never paste tokens, keys, or passwords into prompts.
- Never commit .env files.
- Read secrets only from environment variables or local secret stores.
- If a task seems to require a secret, stop and ask for approval.

## Retry policy
- No infinite retry loops.
- All retries must use a shared retry utility.
- Default max_attempts = 3.
- External requests must define a timeout.