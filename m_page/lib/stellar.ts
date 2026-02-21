// Aqui con el SDK de Stellar
// La hice asi para consultar el testnet y el publicnet sin tener que cambiar nada mas en el codigo
import { Horizon } from "@stellar/stellar-sdk"

export const testnetServer = new Horizon.Server(
  "https://horizon-testnet.stellar.org"
)

export const publicServer = new Horizon.Server(
  "https://horizon.stellar.org"
)