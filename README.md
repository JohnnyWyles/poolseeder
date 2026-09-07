# Pool Seeder

Local browser tool for seeding the allUSDC destination pools of the USDC.noble
position-migration map (fe-content `cms/position-migrations.json`). For each of
the 20 mapped pairs it offers two actions, each behind a confirmation sheet:

- **Swap $50** — buys the counterparty asset with allUSDC. Routing asks SQS
  first (it can cross deeper markets, which matters for thin assets); if SQS
  does not answer — the endpoint is bot-gated and sometimes 403s — it falls
  back to a fixed, auditable route: allUSDC → USDC.noble through the
  transmuter (pool 3497, 1:1, zero spread), then USDC.noble → asset through
  the deepest USDC.noble pool for that asset. Either way the route is only a
  path: the quote and the on-chain output floor (1.5% under the fill) come
  from simulating the actual swap, and the sheet shows how far the fill sits
  below spot, warning above 5%.
- **Add full-range LP** — creates a full-range position in the destination
  pool from the wallet's counterparty balance (capped at ~$55, valued at the
  source pool's spot) plus up to $50 of allUSDC. Minimums are zero: in a
  near-empty pool the depositor is the depth. Before signing, the pool is
  re-read from the chain and the add is refused if its denoms, spread factor
  or tick spacing differ from the map's pinned values.
- **Align** — one swap inside the destination pool that moves its price onto
  the source pool's, sized from the destination's in-range liquidity
  (`dy = L·Δ√P` up, `dx = L·Δ(1/√P)` down) and grossed up for the spread.
  Full-range LP adds depth but never moves price, so this is the step that
  actually closes a divergence; fees make the landing approximate, so refresh
  and repeat if a residual remains.
- **Rebal ½** — atomically withdraws half of the wallet's full-range position
  and redeploys it as a concentrated band 10% around the **source** pool's
  price (the intended price, not the destination's current one), in a single
  transaction: if the create fails, the withdraw reverts with it. The
  withdrawn amounts are read from a prior simulation of the withdraw. If the
  destination's current price is outside the band, the sheet warns that the
  new position starts single-sided — align first.

The table shows each pair's live price divergence against the 0.1% migration
gate. Adding full-range liquidity at the destination's current price does
**not** move that price: a pair outside the gate stays outside until the
price aligns (the sheet warns when this applies).

Signing (Keplr direct + amino/Ledger), protobuf encoding and endpoint proving
are lifted from alloyrebalancer. `MsgCreatePosition` is new here and
byte-checked against `@osmosis-labs/proto-codecs` (from the osmosis-frontend
checkout) by the tests, including the negative-int64 tick path.

```
node test.mjs   # run before changes
serve.cmd      # http://localhost:8901/ — 127.0.0.1 only, on purpose
```

Local-only, not a git repo. Unaudited; amounts are deliberately small.
