//import { Asset } from "@stellar/stellar-sdk"
//import { server } from "./stellar"
//
//export async function getStrictSendQuote(
//  sendAssetCode: string,
//  sendAmount: string,
//  destAssetCode: string
//) {
//  const sendAsset =
//    sendAssetCode === "XLM"
//      ? Asset.native()
//      : new Asset(sendAssetCode, "TEST_ISSUER_PUBLIC_KEY")
//
//  const destAsset =
//    destAssetCode === "XLM"
//      ? Asset.native()
//      : new Asset(destAssetCode, "TEST_ISSUER_PUBLIC_KEY")
//
//  const paths = await server.strictSendPaths(
//    sendAsset,
//    sendAmount,
//    [destAsset]
//  ).call()
//
//  return paths.records
//}