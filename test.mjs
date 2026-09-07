/* Regression tests for index.html (Pool Seeder).
 *
 * Pulls the pure helpers straight out of the page and byte-checks the protobuf
 * encoders against @osmosis-labs/proto-codecs (the frontend's generated codecs,
 * resolved from the osmosis-frontend checkout next to this folder). The one
 * encoder written new for this tool is MsgCreatePosition, whose full-range ticks
 * exercise the negative-int64 varint path, so that comparison is the point of
 * the whole file.
 *
 *   node test.mjs
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const HTML = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");

/* brace matching runs on a copy with string literals and comments blanked (same length,
   so indexes line up) — same approach as alloyrebalancer's test. */
const MASK = HTML.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g, s => " ".repeat(s.length));
function extractFrom(startRe, name) {
  const m = startRe.exec(HTML);
  if (!m) throw new Error(`cannot find ${name} in index.html`);
  let start = m.index;
  const paren = MASK.indexOf("(", m.index);
  if (paren >= 0 && paren < MASK.indexOf("{", m.index)) {
    let pd = 0, i = paren;
    for (; i < MASK.length; i++) { if (MASK[i] === "(") pd++; else if (MASK[i] === ")") { pd--; if (!pd) break; } }
    start = i;
  }
  let k = MASK.indexOf("{", start), depth = 0;
  while (k < MASK.length) {
    if (MASK[k] === "{") depth++;
    else if (MASK[k] === "}") { depth--; if (!depth) break; }
    k++;
  }
  if (depth) throw new Error(`unbalanced braces extracting ${name}`);
  return HTML.slice(m.index, k + 1) + (HTML[k + 1] === ";" ? ";" : "");
}
const fn = name => extractFrom(new RegExp("(?:async +)?function " + name + " *\\("), name);
const arrow = name => { const m = new RegExp(`^const ${name}\\s*=`, "m").exec(HTML); if (!m) throw new Error(`cannot find const ${name}`); return HTML.slice(m.index, HTML.indexOf("\n", m.index) + 1); };

const FNS = ["uint64Value", "varint", "cat", "tag", "bytesF", "strF", "u64F", "i64F",
             "SwapAmountInRoute", "MsgSwapExactAmountIn", "MsgCreatePosition", "MsgWithdrawPosition",
             "priceToTick", "decAtomics", "fmtUnits", "divergencePct"];
const src = [
  "const te = new TextEncoder();",
  "const MIN_TICK = -108000000n, MAX_TICK = 342000000n;",
  arrow("U64_MAX"), arrow("Any"), arrow("Coin"), arrow("snapDown"), arrow("snapUp"),
  ...FNS.map(fn),
  `return { ${FNS.join(", ")}, Coin: Coin, Any: Any };`,
].join("\n");
const T = new Function(src)();

let failures = 0;
function check(name, got, want) {
  const g = Buffer.from(got).toString("hex"), w = Buffer.from(want).toString("hex");
  if (g === w) { console.log(`ok   ${name}`); return; }
  failures++;
  console.error(`FAIL ${name}\n  got  ${g}\n  want ${w}`);
}
function checkEq(name, got, want) {
  if (got === want) { console.log(`ok   ${name}`); return; }
  failures++;
  console.error(`FAIL ${name}\n  got  ${got}\n  want ${want}`);
}

/* Reference bytes from @osmosis-labs/proto-codecs, produced by ref-encode.mts under tsx
   (the codecs' extensionless ESM imports resolve only under a bundler-style loader). */
// tsx from whichever sibling checkout has it installed (branch switches prune it)
const TSX = ["../osmosis-frontend/node_modules/tsx/dist/cli.mjs",
             "../fe-content/node_modules/tsx/dist/cli.mjs"]
  .map((rel) => new URL(rel, import.meta.url))
  .find((u) => fs.existsSync(u));
if (!TSX) { console.error("tsx not found in any sibling checkout; run yarn install in osmosis-frontend"); process.exit(1); }
const ref = spawnSync(process.execPath, [TSX.pathname.replace(/^\//, ""), new URL("./ref-encode.mts", import.meta.url).pathname.replace(/^\//, "")], { encoding: "utf8" });
if (ref.status !== 0) { console.error("ref-encode failed:\n" + ref.stderr); process.exit(1); }
const REF = JSON.parse(ref.stdout.trim());
const refBytes = k => Uint8Array.from(Buffer.from(REF[k], "hex"));

const SENDER = "osmo147h5x9pcj7lm0cttlaefx6sqq5vdfnmwfcqxkmjd7exqm9gc7grqhr75m0";
const ALLUSDC = "factory/osmo147h5x9pcj7lm0cttlaefx6sqq5vdfnmwfcqxkmjd7exqm9gc7grqhr75m0/alloyed/allUSDC";
const USDY = "ibc/23104D411A6EB6031FA92FB75F227422B84989969E91DCAD56A535DD7FF0A373";

/* --- MsgCreatePosition: full-range ticks, negative lower tick is the interesting byte path --- */
{
  const p = {
    poolId: "3501", sender: SENDER, lowerTick: -108000000n, upperTick: 342000000n,
    tokensProvided: [
      { denom: ALLUSDC, amount: "50000000" },
      { denom: USDY, amount: "123456789012345678" },
    ].sort((a, b) => a.denom.localeCompare(b.denom)),
    tokenMinAmount0: "0", tokenMinAmount1: "0",
  };
  check("MsgCreatePosition full-range", T.MsgCreatePosition(p), refBytes("createFullRange"));
}

/* --- MsgCreatePosition: positive ticks and nonzero minimums --- */
{
  const p = {
    poolId: "1926", sender: SENDER, lowerTick: 100n, upperTick: 342000000n,
    tokensProvided: [{ denom: "uosmo", amount: "1" }],
    tokenMinAmount0: "12345", tokenMinAmount1: "67890",
  };
  check("MsgCreatePosition positive ticks + mins", T.MsgCreatePosition(p), refBytes("createPositive"));
}

/* --- MsgSwapExactAmountIn: multi-hop route (already byte-checked in alloyrebalancer; re-pinned here) --- */
{
  const p = {
    sender: SENDER,
    routes: [{ poolId: "1263", tokenOutDenom: "uosmo" }, { poolId: "3501", tokenOutDenom: USDY }],
    tokenIn: { denom: ALLUSDC, amount: "50000000" }, tokenOutMinAmount: "990000",
  };
  check("MsgSwapExactAmountIn 2-hop", T.MsgSwapExactAmountIn(p), refBytes("swapTwoHop"));
}

/* --- i64F edge values --- */
{
  // int64 min/max round-trip through the reference encoder via lowerTick/upperTick
  const p = {
    poolId: "1", sender: "a", lowerTick: -9223372036854775808n, upperTick: 9223372036854775807n,
    tokensProvided: [], tokenMinAmount0: "0", tokenMinAmount1: "0",
  };
  check("int64 extremes", T.MsgCreatePosition(p), refBytes("createExtremes"));
}

/* --- MsgWithdrawPosition: LegacyDec goes over the wire as its 10^18-scaled integer --- */
{
  const got = T.MsgWithdrawPosition({
    positionId: "123456", sender: SENDER,
    liquidityAtomics: "1234567890123456789012",   // = "1234.567890123456789012"
  });
  check("MsgWithdrawPosition half-liquidity", got, refBytes("withdrawHalf"));
}

/* --- tick math: a chain tick's own price must map back to that tick (pool 3501's
   current_tick is -107862100 = price 1.1379e-12), plus the decade edges. A pool's
   recorded current_tick is NOT always the exact tick of its sqrt price (it can sit
   snapped after boundary crossings), so the round-trip is what the formula owes. --- */
checkEq("priceToTick round-trip 3501", T.priceToTick(1e-12 + 137900e-18), -107862100);
checkEq("priceToTick 1.0", T.priceToTick(1), 0);
checkEq("priceToTick 10", T.priceToTick(10), 9000000);
checkEq("priceToTick 0.1", T.priceToTick(0.1), -9000000);
checkEq("decAtomics", T.decAtomics("1234.567890123456789012").toString(), "1234567890123456789012");
checkEq("decAtomics whole", T.decAtomics("7").toString(), "7000000000000000000");

/* --- helpers --- */
checkEq("fmtUnits 18-dec", T.fmtUnits("123456789012345678", 18), "0.123456789012345678");
checkEq("fmtUnits whole", T.fmtUnits("50000000", 6), "50");
checkEq("divergence 0", T.divergencePct("0.001", "0.001"), 0);
checkEq("divergence squares prices", Math.abs(T.divergencePct("2", "3") - 125) < 1e-9, true);

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log("\nall tests passed");
