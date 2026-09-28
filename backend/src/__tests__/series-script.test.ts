import { describe, it, expect, spyOn, afterEach, mock } from "bun:test";
import {
  applyCta,
  countWords,
  wordBudget,
  assembleParts,
  generateSeriesScript,
} from "../lib/ai/seriesScript";
import * as geminiLib from "../lib/ai/gemini";

afterEach(() => {
  mock.restore();
});

describe("wordBudget", () => {
  it("converts minutes to words at the given rate, minus overhead", () => {
    expect(wordBudget(1, 150, 7)).toBe(143);
  });

  it("handles fractional minutes", () => {
    expect(wordBudget(0.5, 150, 0)).toBe(75);
  });

  it("never goes below 1", () => {
    expect(wordBudget(0.1, 150, 100)).toBe(1);
  });
});

describe("applyCta", () => {
  it("fills {next}, {n} and {total}", () => {
    expect(applyCta("Curta e comente para a parte {next}.", 1, 4)).toBe(
      "Curta e comente para a parte 2.",
    );
    expect(applyCta("Parte {n} de {total}", 2, 4)).toBe("Parte 2 de 4.");
  });

  it("adds a trailing period when missing", () => {
    expect(applyCta("Curta e comente para a parte {next}", 1, 4)).toBe(
      "Curta e comente para a parte 2.",
    );
  });

  it("keeps existing punctuation", () => {
    expect(applyCta("Vem pra parte {next}!", 1, 3)).toBe("Vem pra parte 2!");
  });
});

describe("countWords", () => {
  it("counts whitespace-separated words", () => {
    expect(countWords("Eu sou o babaca por expor")).toBe(6);
  });
});

describe("assembleParts", () => {
  const targetWords = [50, 50, 50];

  it("part 1 opens with the title and ends with cta(1)", () => {
    const parts = assembleParts("Eu sou o babaca?", ["corpo um"], {
      ctaTemplate: "Curta e comente para a parte {next}.",
      targetWords: [50],
    });
    // single part (N=1): no intermediate CTA
    expect(parts[0]!.text).toBe("Eu sou o babaca? corpo um");
  });

  it("multi-part: part 1 has title + cta(1), middle parts say 'Parte n.', final part has finalCta", () => {
    const parts = assembleParts("Eu sou o babaca?", ["corpo 1", "corpo 2", "corpo 3"], {
      ctaTemplate: "Curta e comente para a parte {next}.",
      finalCtaTemplate: "Foi isso, comenta o que achou.",
      targetWords,
    });

    expect(parts).toHaveLength(3);
    expect(parts[0]!.text).toBe("Eu sou o babaca? corpo 1 Curta e comente para a parte 2.");
    expect(parts[1]!.text).toBe("Eu sou o babaca? Parte 2. corpo 2 Curta e comente para a parte 3.");
    expect(parts[2]!.text).toBe("Eu sou o babaca? Parte 3. corpo 3 Foi isso, comenta o que achou.");
  });

  it("non-first parts repeat the title before 'Parte N.'", () => {
    const parts = assembleParts("T", ["a", "b"], {
      ctaTemplate: "Curta e comente para a parte {next}.",
      targetWords: [10, 10],
    });
    expect(parts[1]!.text).toBe("T. Parte 2. b");
  });

  it("adds a trailing period to a title without one", () => {
    const parts = assembleParts("Sem pontuacao", ["corpo"], {
      ctaTemplate: "x",
      targetWords: [10],
    });
    expect(parts[0]!.text.startsWith("Sem pontuacao. corpo")).toBe(true);
  });

  it("keeps a title that already ends in punctuation", () => {
    const parts = assembleParts("Já tem ponto de interrogação?", ["corpo"], {
      ctaTemplate: "x",
      targetWords: [10],
    });
    expect(parts[0]!.text.startsWith("Já tem ponto de interrogação? corpo")).toBe(true);
  });

  it("flags a part as outOfBudget when actual words deviate more than 15%", () => {
    const longBody = new Array(100).fill("palavra").join(" ");
    const parts = assembleParts("T", [longBody], { ctaTemplate: "x", targetWords: [10] });
    expect(parts[0]!.outOfBudget).toBe(true);
  });

  it("does not flag a part within the 15% tolerance", () => {
    const body = new Array(50).fill("palavra").join(" ");
    const parts = assembleParts("T", [body], { ctaTemplate: "x", targetWords: [51] });
    expect(parts[0]!.outOfBudget).toBe(false);
  });
});

const FAKE_CARD = { subreddit: "r/relatos", username: "u/anonimo123", flair: "RELATO" };

function mockGeminiResponse(text: string) {
  return {
    models: {
      generateContent: mock(() => Promise.resolve({ text })),
    },
  };
}

describe("generateSeriesScript", () => {
  it("calls Gemini once when every part is within budget", async () => {
    const body = new Array(140).fill("palavra").join(" ");
    const fakeClient = mockGeminiResponse(
      JSON.stringify({ title: "Um título qualquer", card: FAKE_CARD, parts: [{ text: body }] }),
    );
    const createGeminiSpy = spyOn(geminiLib, "createGemini").mockReturnValue(fakeClient as never);

    const result = await generateSeriesScript({
      apiKey: "key",
      model: "gemini-3.1-flash-lite",
      theme: "tema de teste",
      parts: 1,
      minutesPerPart: 1,
    });

    expect(result.parts).toHaveLength(1);
    expect(fakeClient.models.generateContent).toHaveBeenCalledTimes(1);
    expect(createGeminiSpy).toHaveBeenCalledWith("key");
  });

  it("retries only the offending part when one is out of budget", async () => {
    const shortBody = "corpo curto";
    const fixedBody = new Array(140).fill("palavra").join(" ");
    let call = 0;
    const fakeClient = {
      models: {
        generateContent: mock(() => {
          call++;
          const body = call === 1 ? shortBody : fixedBody;
          return Promise.resolve({
            text: JSON.stringify({ title: "T", card: FAKE_CARD, parts: [{ text: body }] }),
          });
        }),
      },
    };
    spyOn(geminiLib, "createGemini").mockReturnValue(fakeClient as never);

    const result = await generateSeriesScript({
      apiKey: "key",
      model: "gemini-3.1-flash-lite",
      theme: "tema",
      parts: 1,
      minutesPerPart: 1,
    });

    expect(fakeClient.models.generateContent).toHaveBeenCalledTimes(2);
    expect(result.parts[0]!.outOfBudget).toBe(false);
  });

  it("throws a clear error when Gemini returns the wrong number of parts", async () => {
    const fakeClient = mockGeminiResponse(
      JSON.stringify({ title: "T", card: FAKE_CARD, parts: [{ text: "só uma" }] }),
    );
    spyOn(geminiLib, "createGemini").mockReturnValue(fakeClient as never);

    await expect(
      generateSeriesScript({
        apiKey: "key",
        model: "gemini-3.1-flash-lite",
        theme: "tema",
        parts: 2,
        minutesPerPart: 1,
      }),
    ).rejects.toThrow(/2 partes/);
  });

  it("parses a response wrapped in a ```json code fence", async () => {
    const body = new Array(140).fill("palavra").join(" ");
    const fenced = "```json\n" + JSON.stringify({ title: "T", card: FAKE_CARD, parts: [{ text: body }] }) + "\n```";
    const fakeClient = mockGeminiResponse(fenced);
    spyOn(geminiLib, "createGemini").mockReturnValue(fakeClient as never);

    const result = await generateSeriesScript({
      apiKey: "key",
      model: "gemini-3.1-flash-lite",
      theme: "tema",
      parts: 1,
      minutesPerPart: 1,
    });

    expect(result.title).toBe("T");
  });
});
