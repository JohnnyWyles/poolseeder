/* Emits reference encodings from @osmosis-labs/proto-codecs (the frontend's generated
 * codecs, imported from source). Run under tsx, which resolves the extensionless ESM
 * imports the built output uses; invoked by test.mjs, not directly.
 */
import * as clTxMod from "../osmosis-frontend/packages/proto-codecs/src/codegen/osmosis/concentratedliquidity/v1beta1/tx";
import * as pmTxMod from "../osmosis-frontend/packages/proto-codecs/src/codegen/osmosis/poolmanager/v1beta1/tx";

// tsx compiles the codecs to CJS (their package has no "type": "module"), so the
// named exports arrive under the interop default.
const { MsgCreatePosition, MsgWithdrawPosition } = (clTxMod as any).default ?? clTxMod;
const { MsgSwapExactAmountIn } = (pmTxMod as any).default ?? pmTxMod;

const SENDER = "osmo147h5x9pcj7lm0cttlaefx6sqq5vdfnmwfcqxkmjd7exqm9gc7grqhr75m0";
const ALLUSDC =
  "factory/osmo147h5x9pcj7lm0cttlaefx6sqq5vdfnmwfcqxkmjd7exqm9gc7grqhr75m0/alloyed/allUSDC";
const USDY =
  "ibc/23104D411A6EB6031FA92FB75F227422B84989969E91DCAD56A535DD7FF0A373";

const hex = (u: Uint8Array) => Buffer.from(u).toString("hex");

const fullRangeCoins = [
  { denom: ALLUSDC, amount: "50000000" },
  { denom: USDY, amount: "123456789012345678" },
].sort((a, b) => a.denom.localeCompare(b.denom));

console.log(
  JSON.stringify({
    createFullRange: hex(
      MsgCreatePosition.encode(
        MsgCreatePosition.fromPartial({
          poolId: BigInt(3501),
          sender: SENDER,
          lowerTick: BigInt(-108000000),
          upperTick: BigInt(342000000),
          tokensProvided: fullRangeCoins,
          tokenMinAmount0: "0",
          tokenMinAmount1: "0",
        })
      ).finish()
    ),
    createPositive: hex(
      MsgCreatePosition.encode(
        MsgCreatePosition.fromPartial({
          poolId: BigInt(1926),
          sender: SENDER,
          lowerTick: BigInt(100),
          upperTick: BigInt(342000000),
          tokensProvided: [{ denom: "uosmo", amount: "1" }],
          tokenMinAmount0: "12345",
          tokenMinAmount1: "67890",
        })
      ).finish()
    ),
    createExtremes: hex(
      MsgCreatePosition.encode(
        MsgCreatePosition.fromPartial({
          poolId: BigInt(1),
          sender: "a",
          lowerTick: BigInt("-9223372036854775808"),
          upperTick: BigInt("9223372036854775807"),
          tokensProvided: [],
          tokenMinAmount0: "0",
          tokenMinAmount1: "0",
        })
      ).finish()
    ),
    withdrawHalf: hex(
      MsgWithdrawPosition.encode(
        MsgWithdrawPosition.fromPartial({
          positionId: BigInt(123456),
          sender: SENDER,
          liquidityAmount: "1234.567890123456789012",
        })
      ).finish()
    ),
    swapTwoHop: hex(
      MsgSwapExactAmountIn.encode(
        MsgSwapExactAmountIn.fromPartial({
          sender: SENDER,
          routes: [
            { poolId: BigInt(1263), tokenOutDenom: "uosmo" },
            { poolId: BigInt(3501), tokenOutDenom: USDY },
          ],
          tokenIn: { denom: ALLUSDC, amount: "50000000" },
          tokenOutMinAmount: "990000",
        })
      ).finish()
    ),
  })
);
