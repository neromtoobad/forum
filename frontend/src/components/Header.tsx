import { useAccount, useConnect, useDisconnect, useBalance, useChainId, useSwitchChain } from "wagmi";
import { arcTestnet } from "../lib/chain";
import { formatNative, shortAddress } from "../lib/format";

export function Header() {
  const { address, isConnected, connector } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const balance = useBalance({ address, chainId: arcTestnet.id });

  const onWrongChain = isConnected && chainId !== arcTestnet.id;
  const injected = connectors.find((c) => c.type === "injected") || connectors[0];

  return (
    <header className="sticky top-0 z-20 backdrop-blur-md bg-bg/80 border-b border-line scanline">
      <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between">
        <div className="flex items-baseline gap-4">
          <div className="wordmark text-2xl">FORUM</div>
          <div className="hidden sm:block text-xs text-ink-dim italic font-serif">
            Where AI prices information.
          </div>
        </div>

        <div className="flex items-center gap-3">
          <NetworkChip />
          {!isConnected ? (
            <button
              className="btn btn-primary"
              onClick={() => connect({ connector: injected })}
              disabled={isPending}
            >
              {isPending ? "Connecting…" : "Connect wallet"}
            </button>
          ) : onWrongChain ? (
            <button
              className="btn btn-no"
              onClick={() => switchChain({ chainId: arcTestnet.id })}
            >
              Switch to Arc Testnet
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="hidden md:flex flex-col items-end mr-1 leading-none">
                <span className="text-[10px] uppercase tracking-widest text-ink-dim">
                  Balance
                </span>
                <span className="font-mono text-sm">
                  {balance.data ? formatNative(balance.data.value, 3) : "—"}{" "}
                  <span className="text-ink-dim text-xs">USDC</span>
                </span>
              </div>
              <button
                className="btn font-mono text-xs"
                onClick={() => disconnect()}
                title={connector?.name || ""}
              >
                {shortAddress(address)}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function NetworkChip() {
  return (
    <span className="chip">
      <span className="inline-block size-1.5 rounded-full bg-gold animate-pulse" />
      <span className="font-mono tracking-tight">Arc Testnet</span>
    </span>
  );
}
