import { writeFile } from "fs/promises";
import { BaseNodeExecutor, type HandleData, type HandleInputs } from "./executor";
import type { WordTimestamp } from "../graph";
import { logger } from "@nyx/shared";

// Inputs:  timestamps (WordTimestamp[])
// Outputs: filter (string — filtro FFmpeg)
export class SubtitleExecutor extends BaseNodeExecutor<"Subtitle"> {
  async execute(inputs: HandleInputs): Promise<Record<string, HandleData>> {
    const timestamps = inputs.timestamps as WordTimestamp[];
    const { wordsPerGroup, style } = this.config;

    const groups = groupWords(timestamps, wordsPerGroup);
    const width = this.context.renderWidth;
    const height = this.context.renderHeight;
    if (!width || !height) throw new Error("Subtitle: renderWidth/renderHeight não definidos no contexto");
    const assContent = buildASS(groups, style, width, height);
    const outFile = this.outPath("subs.ass");

    await writeFile(outFile, assContent, "utf-8");

    logger.info(
      { nodeId: this.nodeId, groups: groups.length, outFile },
      "Subtitle: ASS generated",
    );

    // FFmpeg has two escaping levels: filtergraph (consumes '\') then option level (':' is separator).
    // To get a literal ':' in an option value, need '\\:' — filtergraph consumes first '\',
    // leaving '\:' for the option parser which then escapes ':'.
    const normalizedPath = outFile.replace(/\\/g, "/").replace(/:/g, "\\\\:");
    return { filter: `ass=filename=${normalizedPath}:original_size=${width}x${height}` };
  }
}

interface WordGroup {
  words: WordTimestamp[];
  startMs: number;
  endMs: number;
}

function groupWords(timestamps: WordTimestamp[], perGroup: number): WordGroup[] {
  const groups: WordGroup[] = [];

  for (let i = 0; i < timestamps.length; i += perGroup) {
    const chunk = timestamps.slice(i, i + perGroup);

    groups.push({
      words: chunk,
      startMs: chunk[0]!.startMs,
      endMs: chunk[chunk.length - 1]!.endMs,
    });
  }

  return groups;
}

function msToASS(ms: number): string {
  const totalSeconds = ms / 1000;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  return `${h}:${String(m).padStart(2, "0")}:${s
    .toFixed(2)
    .padStart(5, "0")}`;
}

function hexToASSColor(hex: string): string {
  // "#RRGGBB" -> "&H00BBGGRR&"
  const r = hex.slice(1, 3);
  const g = hex.slice(3, 5);
  const b = hex.slice(5, 7);
  return `&H00${b}${g}${r}&`;
}

const positionAlign: Record<string, string> = {
  top: "\\an8",
  center: "\\an5",
  bottom: "\\an2",
};

function buildASS(
  groups: WordGroup[],
  style: {
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    highlightColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    position?: "top" | "center" | "bottom";
  } | undefined,
  playResX: number,
  playResY: number,
): string {
  const fontName = style?.fontFamily ?? "Arial";
  const fontSize = style?.fontSize ?? 72;

  const primaryColor = style?.color
    ? hexToASSColor(style.color)
    : "&H00FFFFFF&";

  const highlightASSColor = style?.highlightColor
    ? hexToASSColor(style.highlightColor)
    : null;

  const outlineColor = style?.strokeColor
    ? hexToASSColor(style.strokeColor)
    : "&H00000000&";

  const outlineWidth = style?.strokeWidth ?? 4;

  const alignment =
    style?.position === "top" ? 8 : style?.position === "center" ? 5 : 2;

  const header = `[Script Info]
Title: Subtitles
ScriptType: v4.00+
PlayResX: ${playResX}
PlayResY: ${playResY}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},${primaryColor},${primaryColor},${outlineColor},&H00000000&,-1,0,0,0,100,100,0,0,1,${outlineWidth},1,${alignment},10,10,60,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

  const pos = positionAlign[style?.position ?? "bottom"] ?? "\\an2";

  const eventLines: string[] = [];

  for (const g of groups) {
    if (!highlightASSColor) {
      // No highlight — one line per group
      const text = g.words.map((w) => w.word).join(" ");
      eventLines.push(
        `Dialogue: 0,${msToASS(g.startMs)},${msToASS(g.endMs)},Default,,0,0,0,,{${pos}}${text}`,
      );
    } else {
      // Word-by-word highlight: one dialogue line per word, showing the full
      // group but with only the current word in the highlight color.
      for (let i = 0; i < g.words.length; i++) {
        const word = g.words[i]!;
        const lineStart = word.startMs;
        // Extend each word display to the next word's start (avoids flicker gaps)
        const lineEnd = i < g.words.length - 1
          ? g.words[i + 1]!.startMs
          : g.endMs;

        const text = g.words
          .map((w, j) =>
            j === i
              ? `{\\c${highlightASSColor}}${w.word}{\\c${primaryColor}}`
              : w.word,
          )
          .join(" ");

        eventLines.push(
          `Dialogue: 0,${msToASS(lineStart)},${msToASS(lineEnd)},Default,,0,0,0,,{${pos}}${text}`,
        );
      }
    }
  }

  return `${header}\n${eventLines.join("\n")}\n`;
}