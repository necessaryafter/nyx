import { describe, it, expect, spyOn, afterEach, mock } from "bun:test";
import {
  applyCta,
  countWords,
  wordBudget,
  assembleParts,
  generateSeriesScript,
  findRepeatedTitle,
  expandThemeChoices,
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

describe("expandThemeChoices", () => {
  it("picks one option per {a|b|c} group, trimmed", () => {
    expect(expandThemeChoices("O traidor é {minha esposa | meu irmão | meu sócio}.", () => 0)).toBe("O traidor é minha esposa.");
    expect(expandThemeChoices("O traidor é {minha esposa | meu irmão | meu sócio}.", () => 0.99)).toBe("O traidor é meu sócio.");
  });

  it("draws each group independently", () => {
    const rolls = [0, 0.99];
    expect(expandThemeChoices("{a|b} e {c|d}", () => rolls.shift()!)).toBe("a e d");
  });

  it("leaves text without a pipe group untouched", () => {
    expect(expandThemeChoices("Sem sorteio {aqui} nem ali.", () => 0)).toBe("Sem sorteio {aqui} nem ali.");
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

  it("finalPartEnabled=true: last part says 'Parte final.' instead of 'Parte N.'", () => {
    const parts = assembleParts("Eu sou o babaca?", ["corpo 1", "corpo 2", "corpo 3"], {
      ctaTemplate: "Curta e comente para a parte {next}.",
      finalPartEnabled: true,
      targetWords,
    });

    expect(parts[1]!.text).toBe("Eu sou o babaca? Parte 2. corpo 2 Curta e comente para a parte 3.");
    expect(parts[2]!.text.startsWith("Eu sou o babaca? Parte final. corpo 3")).toBe(true);
  });

  it("finalPartLabel troca o texto da última parte e aceita {n}/{total}", () => {
    const base = { ctaTemplate: "Curta e comente para a parte {next}.", finalPartEnabled: true, targetWords };
    const custom = assembleParts("Eu sou o babaca?", ["corpo 1", "corpo 2", "corpo 3"], { ...base, finalPartLabel: "Encerrando a história" });
    expect(custom[2]!.text.startsWith("Eu sou o babaca? Encerrando a história. corpo 3")).toBe(true);
    const withVars = assembleParts("T", ["a", "b", "c"], { ...base, finalPartLabel: "Parte {n} de {total}, a última!" });
    expect(withVars[2]!.text.startsWith("T. Parte 3 de 3, a última! c")).toBe(true);
    expect(withVars[1]!.text).toBe("T. Parte 2. b Curta e comente para a parte 3."); // intermediárias não mudam
  });

  it("finalPartLabel vazio/em branco cai em 'Parte final.' e é ignorado com finalPartEnabled=false", () => {
    const empty = assembleParts("T", ["a", "b"], { ctaTemplate: "x {next}", finalPartEnabled: true, finalPartLabel: "   ", targetWords: [10, 10] });
    expect(empty[1]!.text.startsWith("T. Parte final. b")).toBe(true);
    const off = assembleParts("T", ["a", "b"], { ctaTemplate: "x {next}", finalPartEnabled: false, finalPartLabel: "Fim", targetWords: [10, 10] });
    expect(off[1]!.text.startsWith("T. Parte 2. b")).toBe(true);
  });

  it("finalPartEnabled=false (default): last part still says 'Parte N.'", () => {
    const parts = assembleParts("Eu sou o babaca?", ["corpo 1", "corpo 2", "corpo 3"], {
      ctaTemplate: "Curta e comente para a parte {next}.",
      finalPartEnabled: false,
      targetWords,
    });

    expect(parts[2]!.text.startsWith("Eu sou o babaca? Parte 3. corpo 3")).toBe(true);
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

  it("pede outra história quando a IA repete um título já usado, e manda o histórico no prompt", async () => {
    const body = new Array(140).fill("palavra").join(" ");
    const usedTitle = "Minha esposa financiava a vida secreta do irmão com a minha herança";
    const titles = [usedTitle, "Meu sócio sumiu com o dinheiro da empresa e deixou um bilhete"];
    const fakeClient = {
      models: {
        generateContent: mock((_req: { contents: Array<{ parts: Array<{ text: string }> }> }) =>
          Promise.resolve({ text: JSON.stringify({ title: titles.shift(), card: FAKE_CARD, parts: [{ text: body }] }) }),
        ),
      },
    };
    spyOn(geminiLib, "createGemini").mockReturnValue(fakeClient as never);

    const result = await generateSeriesScript({
      apiKey: "key",
      model: "gemini-3.1-flash-lite",
      theme: "tema",
      parts: 1,
      minutesPerPart: 1,
      avoidTitles: [usedTitle],
      avoidPremises: ["O eco dos passos da minha esposa"],
    });

    expect(fakeClient.models.generateContent).toHaveBeenCalledTimes(2);
    expect(result.title).toBe("Meu sócio sumiu com o dinheiro da empresa e deixou um bilhete");
    const firstPrompt = fakeClient.models.generateContent.mock.calls[0]![0].contents[0]!.parts[0]!.text;
    expect(firstPrompt).toContain(usedTitle);
    expect(firstPrompt).toContain("O eco dos passos da minha esposa");
    const secondPrompt = fakeClient.models.generateContent.mock.calls[1]![0].contents[0]!.parts[0]!.text;
    expect(secondPrompt).toContain("história repetida");
  });

  it("falha com erro claro se a IA insistir na mesma história 3 vezes", async () => {
    const body = new Array(140).fill("palavra").join(" ");
    const usedTitle = "Minha esposa financiava a vida secreta do irmão com a minha herança";
    const fakeClient = mockGeminiResponse(JSON.stringify({ title: usedTitle, card: FAKE_CARD, parts: [{ text: body }] }));
    spyOn(geminiLib, "createGemini").mockReturnValue(fakeClient as never);

    await expect(
      generateSeriesScript({ apiKey: "key", model: "m", theme: "tema", parts: 1, minutesPerPart: 1, avoidTitles: [usedTitle] }),
    ).rejects.toThrow(/repetiu uma história/);
    expect(fakeClient.models.generateContent).toHaveBeenCalledTimes(3);
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

describe("assembleParts: separadores do Gemini", () => {
  it("remove ---ROTEIRO--- / ---FIM--- do corpo", () => {
    const [part] = assembleParts("Título", ["---ROTEIRO---\n\nCorpo da história.\n---FIM---"], { ctaTemplate: "", targetWords: [10] });
    expect(part!.body).toBe("Corpo da história.");
  });
});

describe("findRepeatedTitle", () => {
  const used = ["Eu descobri que a minha esposa financiava a vida secreta do próprio irmão usando a minha herança."];

  it("mesmo título exato é repetido", () => {
    expect(findRepeatedTitle(used[0]!, used)).toBe(used[0]);
  });

  it("mesmo título com pontuação/acentos/caixa diferentes é repetido", () => {
    expect(findRepeatedTitle("eu descobri que minha esposa financiava a vida secreta do proprio irmao usando minha heranca", used)).toBe(used[0]);
  });

  it("história diferente no mesmo tema não é repetida", () => {
    expect(findRepeatedTitle("Meu melhor amigo dormia com a minha noiva há dois anos e eu descobri pelo GPS do carro.", used)).toBeUndefined();
  });

  it("sem histórico nunca é repetido", () => {
    expect(findRepeatedTitle(used[0]!, [])).toBeUndefined();
  });
});
