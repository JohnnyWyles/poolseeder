# Pool Seeder

Local browser tool for seeding the allUSDC destination pools of the USDC.noble
position-migration map (fe-content `cms/position-migrations.json`). For each of
the mapped pairs (sorted by origin-pool liquidity, both pools valued at the origin's
spot price) it offers these actions, each behind a confirmation sheet:

- **Swap**: buys the counterparty asset with allUSDC; the size is editable in
  the header ($50 default, $1000 max). Routing asks SQS
  first (it can cross deeper markets, which matters for thin assets); if SQS
  does not answer (the endpoint is bot-gated and sometimes 403s), it falls
  back to a fixed, auditable route: allUSDC → USDC.noble through the
  transmuter (pool 3497, 1:1, zero spread), then USDC.noble → asset through
  the deepest USDC.noble pool for that asset. Either way the route is only a
  path: the quote and the on-chain output floor (1.5% under the fill) come
  from simulating the actual swap, and the sheet shows how far the fill sits
  below spot, warning above 5%.
- **Full-range badge** (faded when you hold none): creates a full-range position in the destination
  pool from the wallet's counterparty balance (capped at ~$55, valued at the
  source pool's spot) plus up to $50 of allUSDC. Minimums are zero: in a
  near-empty pool the depositor is the depth. Before signing, the pool is
  re-read from the chain and the add is refused if its denoms, spread factor
  or tick spacing differ from the map's pinned values.
- **Divergence colour**: green inside the 0.1% gate; amber outside it but inside
  the pair's no-arb band (both spreads + the two directional taker fees the gap's
  arb would pay, read from the chain), so arbitrage will never close it; red past
  the band. **Align amber / Align red** in the header sweep those rows one pool at
  a time, each through its own confirmation (Cancel skips; click again to stop).
- **Divergence** (click): re-reads the row, then runs one swap in whichever of the two pools is
  shallower (by USD liquidity), moving its price onto the deeper pool's. When that is the origin
  (asset/USDC.noble) pool, the route adds the 1:1 allUSDC/USDC.noble transmuter hop (3497), so the
  trade still starts and ends in allUSDC. Sized from the moved pool's in-range liquidity
  (`dy = L·Δ√P` up, `dx = L·Δ(1/√P)` down) and grossed up for the spread and that hop's
  directional taker fee.
  Full-range LP adds depth but never moves price, so this is the step that
  actually closes a divergence; fees make the landing approximate, so refresh
  and repeat if a residual remains.
- **Narrow-range badge** (in range / near bounds / out of range, using the
  frontend's 15%-of-width rule; faded "out of range" when you hold none):
  creates a $25-a-side position (allUSDC + the asset valued at the **source**
  pool's spot) in a band 10% around the source price, from the wallet. Any
  existing narrow positions in the pool are withdrawn in full in the same
  transaction, so a failing create reverts them; the full-range position is
  never touched. If the destination's current price is outside the band, the
  sheet warns that only one side goes in: align first.
- **Organic liquidity**: once a destination holds more than $1,000, its
  position badges give way to a green ORGANIC badge. A seeding position still
  in such a pool is ringed in yellow, and clicking it withdraws that position
  in full instead.

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
serve.cmd      # http://localhost:8901/, 127.0.0.1 only, on purpose
```

Local-only by design (see `serve.cmd`). Unaudited; amounts are deliberately small.
