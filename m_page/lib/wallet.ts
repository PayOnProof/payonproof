import { isConnected, requestAccess, getAddress } from "@stellar/freighter-api";

export async function connectFreighter() {
    const connected = await isConnected();

    if (!connected) {
        throw new Error("Freighter is not installed");
    }

    await requestAccess();
    const address = await getAddress();
    return address;
}
