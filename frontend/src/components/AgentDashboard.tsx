import { useReadContracts, useReadContract, useBalance } from "wagmi";
import { ADDRESSES, factoryAbi, treasuryAbi } from "../lib/contracts";
import { arcTestnet } from "../lib/chain";
import { formatUsdc, formatNative, shortAddress } from "../lib/format";

export function AgentDashboard() {
  const agent = useReadContract({
    address: ADDRESSES.factory,
    abi: factoryAbi,
    functionName: "agent",
  });

  const treasury = useReadContracts({
    contracts: [
      { address: ADDRESSES.treasury, abi: treasuryAbi, functionName: "totalSpreadEarned" },
      { address: ADDRESSES.treasury, abi: treasuryAbi, functionName: "totalAllocatedToUSYC" },
      { address: ADDRESSES.treasury, abi: treasuryAbi, functionName: "simulatedYieldEarned" },
      { address: ADDRESSES.treasury, abi: treasuryAbi, functionName: "usdcBalance" },
      { address: ADDRESSES.treasury, abi: treasuryAbi, functionName: "SIMULATED_USYC_APY_BPS" },
    ],
    query: { refetchInterval: 12_000 },
  });

  const agentBalance = useBalance({
    address: agent.data,
    chainId: arcTestnet.id,
    query: { refetchInterval: 12_000 },
  });

  const [spread, allocated, simYield, vault, apyBps] = (treasury.data ?? []).map(
    (r) => r.result as bigint | undefined
  );
  const apyPct = apyBps ? Number(apyBps) / 100 : 4.5;

  return (
    <aside className="card p-6 space-y-6">
      <div>
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-dim mb-1">
          The Agent
        </div>
        <div className="font-serif text-xl">FORUM bookmaker</div>
        <div className="font-mono text-xs text-ink-dim mt-1">
          {agent.data ? shortAddress(agent.data, 6) : "—"}
        </div>
      </div>

      <KV
        label="Wallet"
        value={agentBalance.data ? formatNative(agentBalance.data.value, 2) : "—"}
        suffix="USDC"
      />
      <KV
        label="Treasury (USDC held)"
        value={vault !== undefined ? formatUsdc(vault, { decimals: 2, suffix: "" }) : "—"}
        suffix="USDC"
      />
      <KV
        label="Spread earned"
        value={spread !== undefined ? formatUsdc(spread, { decimals: 4, suffix: "" }) : "—"}
        suffix="USDC"
      />

      <div className="pt-2 border-t border-line">
        <div className="flex items-center justify-between mb-1">
          <div className="text-[10px] uppercase tracking-[0.22em] text-ink-dim">
            USYC yield
          </div>
          <span className="chip text-[10px] py-0.5 px-2 bg-gold/10 border-gold/30 text-gold">
            Simulated · mainnet feature
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-2xl">
            {simYield !== undefined
              ? formatUsdc(simYield, { decimals: 4, suffix: "" })
              : "—"}
          </span>
          <span className="text-xs text-ink-dim">USDC</span>
        </div>
        <div className="text-xs text-ink-dim mt-1">
          <span className="font-mono">{apyPct.toFixed(2)}%</span> APY ·{" "}
          {allocated !== undefined
            ? `${formatUsdc(allocated, { decimals: 2, suffix: "" })} allocated`
            : "—"}
        </div>
      </div>
    </aside>
  );
}

function KV({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.22em] text-ink-dim mb-0.5">
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-xl text-ink">{value}</span>
        {suffix && <span className="text-xs text-ink-dim">{suffix}</span>}
      </div>
    </div>
  );
}
