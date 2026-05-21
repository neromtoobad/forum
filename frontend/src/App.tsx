import { Header } from "./components/Header";
import { MarketList } from "./components/MarketList";
import { AgentDashboard } from "./components/AgentDashboard";
import { AgentActivity } from "./components/AgentActivity";
import { StatsStrip } from "./components/StatsStrip";
import { EXPLORER } from "./lib/contracts";
import { ADDRESSES } from "./lib/contracts";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-10">
        <Hero />
        <div className="mt-8">
          <StatsStrip />
        </div>
        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_340px]">
          <MarketList />
          <div className="space-y-6">
            <AgentDashboard />
            <AgentActivity />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function Hero() {
  return (
    <section className="border-l-2 border-gold pl-5 py-2">
      <h1 className="font-serif text-4xl md:text-5xl leading-tight text-ink">
        The agent prices.<br />
        <span className="text-ink-muted italic">You take the other side.</span>
      </h1>
      <p className="text-ink-muted mt-3 max-w-xl text-[15px] leading-relaxed">
        An AI bookmaker scans events, estimates probabilities, and opens markets on
        Arc. Bet USDC against its odds. Settlement is sub-second; the only token you
        need is the one in your wallet.
      </p>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line mt-20">
      <div className="mx-auto max-w-6xl px-6 py-8 text-xs text-ink-dim flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-mono">
          <span>Arc Testnet · chainId 5042002</span>
          <span className="text-ink-dim/50">|</span>
          <a
            href={`${EXPLORER}/address/${ADDRESSES.factory}`}
            target="_blank"
            rel="noreferrer"
            className="hover:text-ink transition"
          >
            MarketFactory ↗
          </a>
          <a
            href={`${EXPLORER}/address/${ADDRESSES.pm}`}
            target="_blank"
            rel="noreferrer"
            className="hover:text-ink transition"
          >
            PredictionMarket ↗
          </a>
          <a
            href={`${EXPLORER}/address/${ADDRESSES.treasury}`}
            target="_blank"
            rel="noreferrer"
            className="hover:text-ink transition"
          >
            Treasury ↗
          </a>
        </div>
        <div className="italic font-serif text-ink-dim">
          The agora was where Athens priced information. FORUM is where AI prices it now.
        </div>
      </div>
    </footer>
  );
}
