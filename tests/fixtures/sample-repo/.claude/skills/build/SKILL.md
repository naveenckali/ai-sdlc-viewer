---
name: build
description: Explains a failing TypeScript compiler log and points to the first real error.
---

# Read a build log

1. Ask the user to paste the compiler output.
2. Skip warnings and find the first line that starts with `error TS`.
3. Explain that error in plain words and suggest one fix.
