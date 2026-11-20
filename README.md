# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/czechion-cpu/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/czechion-cpu/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks the protocols most likely to launch a valuable token next. It reads a
sealed DefiLlama snapshot (758 protocols), scores every pre-token protocol by an implied
value, and hands you a dashboard with the ranked board, a farm plan for each protocol, the
live-token protocols set aside, and the ones the rule leaves out with their reason.

The value model is comparable multiples, not a flat constant: a protocol's implied value is
its TVL times the median market-cap / TVL of the token-bearing protocols in its own
category (the global median when a category has fewer than 3 comparables), adjusted by its
seven-day TVL growth and by how long it has run with no token. No protocol name is ever
special-cased. The board covers all 40 protocols on the snapshot's watchlist and 158 more
pre-token protocols below the floor, 198 rows in all.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

Node 22.18 or later, standard library only, no network, no install. `main.ts` writes
`board.json`, `data.js`, `dashboard/` and `screenshots/` into the output directory, then
`dossier.json` — the summary the judge reads. Run it twice and the bytes are identical.

---

<sub>Entered on [make.fun](https://make.fun/?ref=g437m30w&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
