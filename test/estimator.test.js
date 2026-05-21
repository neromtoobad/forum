// Pure-logic tests for estimator helpers (no API calls).
const { expect } = require("chai");
const { validate, extractJson, buildUserPrompt } = require("../agent/estimator");

describe("agent/estimator (pure)", function () {
  describe("validate", function () {
    const valid = {
      probability: 0.62,
      reasoning: "Recent inflation prints suggest the Fed is unlikely to hike.",
      confidence: "medium",
      keyFactors: ["CPI cooling", "Powell dovish tone"],
    };

    it("accepts a valid response", function () {
      expect(() => validate(valid)).to.not.throw();
    });

    it("rejects probability=0", function () {
      expect(() => validate({ ...valid, probability: 0 })).to.throw(/in \(0, 1\)/);
    });

    it("rejects probability=1", function () {
      expect(() => validate({ ...valid, probability: 1 })).to.throw(/in \(0, 1\)/);
    });

    it("rejects non-numeric probability", function () {
      expect(() => validate({ ...valid, probability: "0.5" })).to.throw(/finite number/);
    });

    it("rejects NaN probability", function () {
      expect(() => validate({ ...valid, probability: NaN })).to.throw(/finite number/);
    });

    it("rejects empty reasoning", function () {
      expect(() => validate({ ...valid, reasoning: "" })).to.throw(/non-empty string/);
    });

    it("rejects bad confidence value", function () {
      expect(() => validate({ ...valid, confidence: "very-high" })).to.throw(/low\|medium\|high/);
    });

    it("rejects empty keyFactors", function () {
      expect(() => validate({ ...valid, keyFactors: [] })).to.throw(/non-empty array/);
    });

    it("rejects null", function () {
      expect(() => validate(null)).to.throw(/not an object/);
    });
  });

  describe("extractJson", function () {
    it("parses a clean JSON object", function () {
      const text = '{"probability":0.5,"reasoning":"x","confidence":"low","keyFactors":["a"]}';
      const out = extractJson(text);
      expect(out.probability).to.equal(0.5);
    });

    it("parses JSON inside ```json fences", function () {
      const text = '```json\n{"probability":0.7,"reasoning":"y","confidence":"high","keyFactors":["b"]}\n```';
      const out = extractJson(text);
      expect(out.probability).to.equal(0.7);
    });

    it("parses JSON inside generic ``` fences", function () {
      const text = '```\n{"probability":0.4,"reasoning":"z","confidence":"medium","keyFactors":["c"]}\n```';
      const out = extractJson(text);
      expect(out.probability).to.equal(0.4);
    });

    it("tolerates leading/trailing prose", function () {
      const text = 'Here is my estimate:\n{"probability":0.55,"reasoning":"q","confidence":"low","keyFactors":["d"]}\nLet me know if you need more.';
      const out = extractJson(text);
      expect(out.probability).to.equal(0.55);
    });

    it("throws when no JSON is present", function () {
      expect(() => extractJson("definitely no json here")).to.throw(/no JSON object/);
    });
  });

  describe("buildUserPrompt", function () {
    it("includes all event fields when provided", function () {
      const prompt = buildUserPrompt({
        headline: "BTC tests $100k support",
        description: "Bitcoin price action over the past 48 hours...",
        category: "crypto",
        resolutionDate: "2026-06-01",
        question: "Will BTC close above $100k on 2026-06-01?",
      });
      expect(prompt).to.include("BTC tests $100k");
      expect(prompt).to.include("48 hours");
      expect(prompt).to.include("crypto");
      expect(prompt).to.include("2026-06-01");
      expect(prompt).to.include("Return JSON only");
    });

    it("works with only a headline", function () {
      const prompt = buildUserPrompt({ headline: "Fed holds rates" });
      expect(prompt).to.include("Fed holds rates");
    });
  });

  describe("estimate (mocked client)", function () {
    it("returns structured output from a mocked Claude client", async function () {
      const { estimate } = require("../agent/estimator");
      const mock = {
        messages: {
          create: async () => ({
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  probability: 0.68,
                  reasoning: "Strong macro tailwinds; price action confirms.",
                  confidence: "medium",
                  keyFactors: ["TVL trending up", "Spot ETF flows positive"],
                }),
              },
            ],
            usage: { input_tokens: 100, output_tokens: 50 },
          }),
        },
      };
      const result = await estimate(
        { headline: "BTC > $100k by EOM?" },
        { client: mock }
      );
      expect(result.probability).to.equal(0.68);
      expect(result.confidence).to.equal("medium");
      expect(result.keyFactors).to.have.lengthOf(2);
      expect(result.usage.input_tokens).to.equal(100);
    });

    it("surfaces validation errors when Claude returns bad JSON", async function () {
      const { estimate } = require("../agent/estimator");
      const mock = {
        messages: {
          create: async () => ({
            content: [{ type: "text", text: '{"probability": 1.5}' }],
            usage: {},
          }),
        },
      };
      let err;
      try {
        await estimate({ headline: "x" }, { client: mock });
      } catch (e) {
        err = e;
      }
      expect(err).to.exist;
      expect(err.message).to.match(/in \(0, 1\)/);
    });
  });
});
