const { expect } = require("chai");
const scanner = require("../agent/scanner");

const MAY_21_2026 = Math.floor(new Date("2026-05-21T12:00:00Z").getTime() / 1000);

describe("agent/scanner", function () {
  it("fetch returns events with future resolutionDate at our reference time", function () {
    const events = scanner.fetch({ now: MAY_21_2026 });
    expect(events.length).to.be.greaterThan(0);
    for (const e of events) {
      expect(e.id).to.be.a("string");
      expect(e.category).to.be.oneOf(["crypto", "macro", "onchain"]);
      expect(e.question).to.be.a("string");
      const ts = scanner.deadlineFor(e);
      expect(ts).to.be.greaterThan(MAY_21_2026);
    }
  });

  it("filters out events past their resolutionDate", function () {
    const future = Math.floor(new Date("2030-01-01T00:00:00Z").getTime() / 1000);
    const events = scanner.fetch({ now: future });
    expect(events.length).to.equal(0);
  });

  it("excludeIds removes specific candidates", function () {
    const all = scanner.fetch({ now: MAY_21_2026 });
    const skipId = all[0].id;
    const filtered = scanner.fetch({ now: MAY_21_2026, excludeIds: [skipId] });
    expect(filtered.length).to.equal(all.length - 1);
    expect(filtered.find((e) => e.id === skipId)).to.equal(undefined);
  });

  it("categories acts as an allowlist", function () {
    const cryptoOnly = scanner.fetch({ now: MAY_21_2026, categories: ["crypto"] });
    expect(cryptoOnly.length).to.be.greaterThan(0);
    for (const e of cryptoOnly) expect(e.category).to.equal("crypto");
  });

  it("next returns the first eligible event, or null when exhausted", function () {
    const e = scanner.next({ now: MAY_21_2026 });
    expect(e).to.not.be.null;
    const exhausted = scanner.next({ now: Math.floor(new Date("2030-01-01T00:00:00Z").getTime() / 1000) });
    expect(exhausted).to.be.null;
  });

  it("deadlineFor returns a Unix timestamp", function () {
    const e = scanner.WATCHLIST[0];
    const ts = scanner.deadlineFor(e);
    expect(ts).to.equal(Math.floor(new Date(e.resolutionDate + "T00:00:00Z").getTime() / 1000));
  });

  it("getWatchlist returns a copy, not a reference", function () {
    const copy = scanner.getWatchlist();
    copy.push({ id: "intruder" });
    expect(scanner.WATCHLIST.find((e) => e.id === "intruder")).to.equal(undefined);
  });
});
