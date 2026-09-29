import { writeFile } from "fs/promises";
import { join } from "path";
import type { WordTimestamp, SubtitleStyle } from "../../graph";

interface WordGroup {
  words: WordTimestamp[];
  startMs: number;
  endMs: number;
}

export async function buildSubtitleFilter(
  timestamps: WordTimestamp[],
  wordsPerGroup: number,
  style: SubtitleStyle | undefined,
  width: number,
  height: number,
  workDir: string,
): Promise<string> {
  const groups = groupWords(timestamps, wordsPerGroup);
  const assContent = buildASS(groups, style, width, height);
  const assPath = join(workDir, "subtitles.ass");
  await writeFile(assPath, assContent, "utf-8");

  const normalized = assPath.replace(/\\/g, "/").replace(/:/g, "\\\\:");
  return `ass=filename=${normalized}:original_size=${width}x${height}`;
}

function groupWords(timestamps: WordTimestamp[], perGroup: number): WordGroup[] {
  const groups: WordGroup[] = [];
  for (let i = 0; i < timestamps.length; i += perGroup) {
    const chunk = timestamps.slice(i, i + perGroup);
    groups.push({ words: chunk, startMs: chunk[0]!.startMs, endMs: chunk[chunk.length - 1]!.endMs });
  }
  return groups;
}

function msToASS(ms: number): string {
  const total = ms / 1000;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`;
}

function hexToASSColor(hex: string): string {
  const r = hex.slice(1, 3);
  const g = hex.slice(3, 5);
  const b = hex.slice(5, 7);
  return `&H00${b}${g}${r}&`;
}

function buildASS(groups: WordGroup[], style: SubtitleStyle | undefined, playResX: number, playResY: number): string {
  const fontName = style?.fontFamily ?? "Arial";
  const fontSize = style?.fontSize ?? 72;
  const primaryColor = style?.color ? hexToASSColor(style.color) : "&H00FFFFFF&";
  const highlightASSColor = style?.highlightColor ? hexToASSColor(style.highlightColor) : null;
  const outlineColor = style?.strokeColor ? hexToASSColor(style.strokeColor) : "&H00000000&";
  const outlineWidth = style?.strokeWidth ?? 4;
  const alignment = style?.position === "top" ? 8 : style?.position === "center" ? 5 : 2;
  const pos = style?.position === "top" ? "\\an8" : style?.position === "center" ? "\\an5" : "\\an2";

  const header = `[Script Info]
Title: Subtitles
ScriptType: v4.00+
PlayResX: ${playResX}
PlayResY: ${playResY}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},${primaryColor},${primaryColor},${outlineColor},&H00000000&,-1,0,0,0,100,100,0,0,1,${outlineWidth},1,${alignment},10,10,60,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

  const lines: string[] = [];

  for (const g of groups) {
    if (!highlightASSColor) {
      const text = g.words.map((w) => w.word).join(" ");
      lines.push(`Dialogue: 0,${msToASS(g.startMs)},${msToASS(g.endMs)},Default,,0,0,0,,{${pos}}${text}`);
    } else {
      for (let i = 0; i < g.words.length; i++) {
        const word = g.words[i]!;
        const lineEnd = i < g.words.length - 1 ? g.words[i + 1]!.startMs : g.endMs;
        const text = g.words
          .map((w, j) =>
            j === i
              ? `{\\c${highlightASSColor}}${w.word}{\\c${primaryColor}}`
              : w.word,
          )
          .join(" ");
        lines.push(`Dialogue: 0,${msToASS(word.startMs)},${msToASS(lineEnd)},Default,,0,0,0,,{${pos}}${text}`);
      }
    }
  }

  return `${header}\n${lines.join("\n")}\n`;
}
