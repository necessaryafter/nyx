import { useState, type ReactNode } from "react";
import {
  Workflow,
  AudioLines,
  Captions,
  Radio,
  Copy,
  Coins,
  ChevronDown,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { SectionWrapper } from "../ui/SectionWrapper";
import { SectionHeading } from "../ui/SectionHeading";
import { AnimatedEntry } from "../ui/AnimatedEntry";
import type { ElementType } from "react";

interface Feature {
  icon: ElementType;
  title: string;
  description: string;
  preview: () => ReactNode;
}

/* ── Mock UI Previews ─────────────────────────────────── */

function NodeEditorMock() {
  const Node = ({ label, className }: { label: string; className: string }) => (
    <div className={`flex items-center rounded-md border border-nyx-border px-2.5 py-1 font-mono text-[10px] ${className}`}>
      {label}
    </div>
  );

  return (
    <div className="relative flex h-full w-full flex-col justify-center p-6">
      {/* Grid dots */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: "radial-gradient(circle, var(--nyx-grid-dot) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />
      {/* Node graph as flex rows */}
      <div className="relative flex items-center justify-between gap-3">
        {/* Column 1: Inputs */}
        <div className="flex flex-col gap-4">
          <Node label="VideoPool" className="bg-nyx-cyan-400/20 text-nyx-cyan-400" />
          <Node label="TTS" className="bg-nyx-orange-400/20 text-nyx-orange-400" />
        </div>
        {/* Connector */}
        <div className="flex h-px flex-1 bg-nyx-border" />
        {/* Column 2: Processing */}
        <div className="flex flex-col gap-4">
          <Node label="Loop" className="bg-nyx-elevated text-nyx-text-secondary" />
          <Node label="Subtitle" className="bg-nyx-elevated text-nyx-text-secondary" />
        </div>
        {/* Connector */}
        <div className="flex h-px flex-1 bg-nyx-border" />
        {/* Column 3: Compose */}
        <div className="flex flex-col items-center">
          <Node label="Layer" className="bg-nyx-elevated text-nyx-text-secondary" />
        </div>
        {/* Connector */}
        <div className="flex h-px flex-1 bg-nyx-border" />
        {/* Column 4: Output */}
        <div className="flex flex-col items-center">
          <Node label="Render" className="bg-nyx-success/20 text-nyx-success" />
        </div>
      </div>
      {/* Label */}
      <div className="mt-6 flex items-center gap-2 text-[9px] text-nyx-text-muted">
        <div className="h-px flex-1 bg-nyx-border" />
        <span className="font-mono">drag & drop pipeline</span>
        <div className="h-px flex-1 bg-nyx-border" />
      </div>
    </div>
  );
}

function TTSWaveformMock() {
  const bars = [3, 5, 8, 12, 7, 15, 10, 18, 6, 13, 9, 16, 4, 11, 14, 8, 17, 5, 12, 7, 15, 9, 6, 13, 10, 18, 4, 11, 8, 16, 5, 14];

  return (
    <div className="flex h-full w-full flex-col justify-center gap-5 p-6">
      {/* Provider selector */}
      <div className="flex items-center gap-2">
        <div className="rounded border border-nyx-border bg-nyx-elevated px-2.5 py-1 font-mono text-[10px] text-nyx-text-primary">
          Talkify
        </div>
        <div className="rounded border border-nyx-border px-2.5 py-1 font-mono text-[10px] text-nyx-text-muted">
          Custom
        </div>
      </div>
      {/* Waveform */}
      <div className="flex items-center gap-[3px]">
        {bars.map((h, i) => (
          <div
            key={i}
            className="w-1.5 rounded-full bg-nyx-cyan-400/60"
            style={{ height: h * 1.8 }}
          />
        ))}
      </div>
      {/* Timestamps */}
      <div className="flex gap-1">
        {["Esse", "vídeo", "foi", "gerado"].map((word, i) => (
          <span
            key={word}
            className={`rounded px-1.5 py-0.5 font-mono text-[9px] ${i === 1 ? "bg-nyx-cyan-400/15 text-nyx-cyan-400" : "bg-nyx-elevated text-nyx-text-muted"}`}
          >
            {word}
          </span>
        ))}
        <span className="font-mono text-[9px] text-nyx-text-muted/40">...</span>
      </div>
    </div>
  );
}

function KaraokeMock() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-6">
      {/* Video frame */}
      <div className="relative flex aspect-video w-full max-w-[280px] items-end justify-center overflow-hidden rounded-lg border border-nyx-border bg-nyx-deep">
        {/* Fake video content - gradient bars */}
        <div className="absolute inset-0 flex items-center justify-center opacity-20">
          <div className="h-16 w-16 rounded-full bg-nyx-text-muted/30" />
        </div>
        {/* Subtitle overlay */}
        <div className="relative mb-4 flex gap-1.5 rounded-md bg-black/60 px-3 py-2 backdrop-blur-sm">
          <span className="font-mono text-xs font-bold text-nyx-orange-400">
            esse vídeo
          </span>
          <span className="font-mono text-xs font-bold text-white/90">
            foi feito
          </span>
        </div>
      </div>
      {/* Style options */}
      <div className="flex items-center gap-2">
        <div className="h-3 w-3 rounded-full border-2 border-nyx-orange-400 bg-nyx-orange-400" />
        <div className="h-3 w-3 rounded-full border-2 border-nyx-cyan-400" />
        <div className="h-3 w-3 rounded-full border-2 border-nyx-text-primary" />
        <span className="ml-1 font-mono text-[9px] text-nyx-text-muted">estilo</span>
      </div>
    </div>
  );
}

function RealtimeStatusMock() {
  const jobs = [
    { name: "video_031.mp4", progress: 100, status: "done" },
    { name: "video_032.mp4", progress: 67, status: "rendering" },
    { name: "video_033.mp4", progress: 0, status: "queued" },
  ];

  return (
    <div className="flex h-full w-full flex-col justify-center gap-3 p-6">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-nyx-text-muted">Jobs ativos</span>
        <span className="flex h-2 w-2 rounded-full bg-nyx-success animate-pulse" />
      </div>
      {jobs.map((job) => (
        <div key={job.name} className="flex flex-col gap-1.5 rounded-lg border border-nyx-border bg-nyx-deep p-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-nyx-text-secondary">{job.name}</span>
            <span
              className={`font-mono text-[9px] ${
                job.status === "done"
                  ? "text-nyx-success"
                  : job.status === "rendering"
                    ? "text-nyx-orange-400"
                    : "text-nyx-text-muted"
              }`}
            >
              {job.status === "done" ? "concluido" : job.status === "rendering" ? "renderizando" : "na fila"}
            </span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-nyx-elevated">
            <div
              className={`h-full rounded-full transition-all ${
                job.status === "done"
                  ? "bg-nyx-success"
                  : job.status === "rendering"
                    ? "bg-nyx-orange-400"
                    : "bg-nyx-text-muted/30"
              }`}
              style={{ width: `${job.progress}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function TemplatesMock() {
  const templates = [
    { name: "Reddit Story", count: "142 usos" },
    { name: "Horror Dark", count: "89 usos" },
    { name: "Facts & Tips", count: "67 usos" },
    { name: "AITA Thread", count: "54 usos" },
  ];

  return (
    <div className="flex h-full w-full flex-col justify-center gap-3 p-6">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-nyx-text-muted">Seus templates</span>
        <span className="rounded border border-dashed border-nyx-border px-2 py-0.5 font-mono text-[9px] text-nyx-text-muted">
          + novo
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {templates.map((t) => (
          <div
            key={t.name}
            className="flex flex-col gap-1 rounded-lg border border-nyx-border bg-nyx-deep p-3"
          >
            <div className="mb-1 flex h-6 items-center gap-1">
              <div className="h-4 w-4 rounded bg-nyx-elevated" />
              <div className="h-4 w-4 rounded bg-nyx-elevated" />
              <div className="h-1 w-4 rounded bg-nyx-border" />
              <div className="h-4 w-4 rounded bg-nyx-elevated" />
            </div>
            <span className="text-[10px] font-medium text-nyx-text-secondary">{t.name}</span>
            <span className="font-mono text-[9px] text-nyx-text-muted">{t.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreditsMock() {
  const rows = [
    { item: "Render (3:24)", credits: "34", type: "debit" },
    { item: "TTS Talkify", credits: "12", type: "debit" },
    { item: "Recarga +500", credits: "500", type: "credit" },
    { item: "Render (2:11)", credits: "22", type: "debit" },
  ];

  return (
    <div className="flex h-full w-full flex-col justify-center gap-3 p-6">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-nyx-text-muted">Saldo</span>
        <span className="font-mono text-sm font-semibold text-nyx-text-primary">432 cr</span>
      </div>
      <div className="flex flex-col rounded-lg border border-nyx-border overflow-hidden">
        {rows.map((row, i) => (
          <div
            key={i}
            className={`flex items-center justify-between px-3 py-2 ${i !== rows.length - 1 ? "border-b border-nyx-border" : ""} bg-nyx-deep`}
          >
            <span className="font-mono text-[10px] text-nyx-text-secondary">{row.item}</span>
            <span
              className={`font-mono text-[10px] font-medium ${
                row.type === "credit" ? "text-nyx-success" : "text-nyx-text-muted"
              }`}
            >
              {row.type === "credit" ? "+" : "-"}{row.credits}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 w-1.5 rounded-full bg-nyx-success" />
        <span className="font-mono text-[9px] text-nyx-text-muted">~43 min de render restante</span>
      </div>
    </div>
  );
}

/* ── Feature data ─────────────────────────────────────── */

const FEATURES: Feature[] = [
  {
    icon: Workflow,
    title: "Editor Visual de Nodes",
    description:
      "Drag & drop. Conecte VideoPool, TTS, Subtitle, Layer e Render em um pipeline visual. Sem código, sem fricção.",
    preview: NodeEditorMock,
  },
  {
    icon: AudioLines,
    title: "TTS Multi-provider",
    description:
      "Talkify ou seu próprio áudio. Timestamps word-level automáticos via WhisperX para sincronização perfeita.",
    preview: TTSWaveformMock,
  },
  {
    icon: Captions,
    title: "Legendas Karaokê",
    description:
      "3-4 palavras por grupo, estilo customizável, perfeitamente sincronizadas com o áudio. Estilo TikTok nativo.",
    preview: KaraokeMock,
  },
  {
    icon: Radio,
    title: "Status em Tempo Real",
    description:
      "WebSocket integrado. Acompanhe o progresso de cada render ao vivo no seu dashboard.",
    preview: RealtimeStatusMock,
  },
  {
    icon: Copy,
    title: "Templates Reutilizáveis",
    description:
      "Crie uma vez, produza infinitas vezes. Duplique, edite, compartilhe com seu time.",
    preview: TemplatesMock,
  },
  {
    icon: Coins,
    title: "Créditos Transparentes",
    description:
      "Pague por minuto de vídeo renderizado. Sem mensalidade fixa. Sem surpresas na fatura.",
    preview: CreditsMock,
  },
];

/* ── Accordion ────────────────────────────────────────── */

function AccordionItem({
  feature,
  isOpen,
  onToggle,
}: {
  feature: Feature;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-nyx-border">
      <button
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center justify-between py-4 text-left transition-colors"
      >
        <span
          className={`text-base font-semibold transition-colors ${isOpen ? "text-nyx-text-primary" : "text-nyx-text-muted"}`}
        >
          {feature.title}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-nyx-text-muted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-4 text-sm leading-relaxed text-nyx-text-muted">
              {feature.description}
            </p>
            {/* Mobile preview */}
            <div className="mb-4 overflow-hidden rounded-xl border border-nyx-border bg-nyx-surface md:hidden" style={{ minHeight: 200 }}>
              <feature.preview />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Main component ───────────────────────────────────── */

export function Features() {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <SectionWrapper id="features">
      <AnimatedEntry>
        <SectionHeading>Vídeo automatizado, do seu jeito.</SectionHeading>
      </AnimatedEntry>

      <AnimatedEntry>
        <div className="mx-auto mt-12 flex max-w-4xl flex-col items-start gap-12 md:flex-row">
          {/* Accordion */}
          <div className="w-full md:w-1/2">
            {FEATURES.map((feature, index) => (
              <AccordionItem
                key={feature.title}
                feature={feature}
                isOpen={index === activeIndex}
                onToggle={() => setActiveIndex(index)}
              />
            ))}
          </div>

          {/* Desktop preview */}
          <div className="sticky top-28 hidden w-1/2 md:block">
            <div className="overflow-hidden rounded-xl border border-nyx-border bg-nyx-surface" style={{ minHeight: 320 }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeIndex}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  style={{ minHeight: 320 }}
                >
                  {FEATURES[activeIndex].preview()}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </AnimatedEntry>
    </SectionWrapper>
  );
}
