import { createConfig, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { CHAIN_ID, RPC_URL } from "./chain";

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  transports: {
    [CHAIN_ID]: http(RPC_URL),
  },
  ssr: false,
});

export default wagmiConfig;
