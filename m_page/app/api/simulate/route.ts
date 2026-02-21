import {
  Asset,
  Operation,
  TransactionBuilder,
  Networks
} from "@stellar/stellar-sdk"

import { testnetServer } from "@/lib/stellar"

export async function POST(req: Request) {
  const body = await req.json()
  const { sourcePublicKey, amount } = body

  const account = await testnetServer.loadAccount(sourcePublicKey)

  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.payment({
        destination: sourcePublicKey,
        asset: Asset.native(),
        amount: amount,
      })
    )
    .setTimeout(30)
    .build()

  return Response.json({
    xdr: tx.toXDR(),
  })
}