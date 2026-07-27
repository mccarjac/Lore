## What changed

<!-- One or two sentences. What does this do that the code did not do before? -->

## Why

<!-- The problem, or the issue this closes. "Closes #123" if applicable. -->

## How it was verified

<!-- What you actually ran or clicked. Not "should work". -->

- [ ] `npm run check-all` is green
- [ ] Tests added or updated for the behavior that changed

## Ruleset impact

<!-- Delete the ones that do not apply. -->

- [ ] No effect on rulesets
- [ ] Changes `RulesetDefinition` — schema, validator and
      `docs/ruleset-authoring.md` updated together
- [ ] Changes derived-stat computation — the parity suite still reproduces
      every pinned number
- [ ] Touches storage shapes — migration is idempotent and reads the old shape

## Notes for the reviewer

<!-- Anything non-obvious: a trade-off you made, something you left out, a
     follow-up worth filing. -->
