import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useJob, useJobsWebSocket } from "../hooks/useJobs";
import { cn } from "../lib/cn";
import type { Job, SceneSlot } from "../lib/types";
import { Step1_TemplateSelect } from "./wizard/Step1_TemplateSelect";
import { Step2_Narration } from "./wizard/Step2_Narration";
import { Step3_MediaSlots } from "./wizard/Step3_MediaSlots";
import { Step4_Confirm } from "./wizard/Step4_Confirm";

const STEPS = [
  { label: "Template" },
  { label: "Narração" },
  { label: "Mídias" },
  { label: "Renderizar" },
];

function statusToStep(status: Job["status"]): number {
  switch (status) {
    case "draft": return 1;
    case "audio_processing": return 1;
    case "audio_ready": return 2;
    case "ready": return 3;
    default: return 3;
  }
}

/** Stepper horizontal — usado nos steps 1, 3, 4 */
function WizardStepper({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((step, i) => {
        const idx = i + 1;
        const done = idx < current;
        const active = idx === current;
        return (
          <div key={step.label} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                  done && "bg-green-500 text-white",
                  active && "bg-nyx-cyan-500 text-white",
                  !done && !active && "bg-nyx-surface text-nyx-text-muted",
                )}
              >
                {done ? <CheckCircle2 className="w-4 h-4" /> : idx}
              </div>
              <span className={cn("text-xs whitespace-nowrap", active ? "text-nyx-text-primary" : "text-nyx-text-muted")}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("h-px w-12 mx-1 mb-5 transition-colors", done ? "bg-green-500" : "bg-nyx-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Stepper vertical — usado no step 2 (sidebar) */
function WizardStepperVertical({ current }: { current: number }) {
  return (
    <nav className="flex flex-col gap-1">
      {STEPS.map((step, i) => {
        const idx = i + 1;
        const done = idx < current;
        const active = idx === current;
        return (
          <div key={step.label} className="flex flex-col">
            <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
              <div
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold transition-colors",
                  done && "bg-green-500 text-white",
                  active && "bg-nyx-cyan-500 text-white",
                  !done && !active && "bg-nyx-surface text-nyx-text-muted",
                )}
              >
                {done ? <CheckCircle2 className="w-3 h-3" /> : idx}
              </div>
              <span
                className={cn(
                  "text-sm transition-colors",
                  active ? "font-medium text-nyx-text-primary" : done ? "text-nyx-text-muted" : "text-nyx-text-muted",
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("ml-[18px] w-px h-4 mx-2 transition-colors", done ? "bg-green-500/40" : "bg-nyx-border")} />
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function JobWizardPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [audioReadySlots, setAudioReadySlots] = useState<SceneSlot[] | null>(null);

  const { data: job, isLoading } = useJob(id ?? "");

  useJobsWebSocket((jobId, sceneSlots) => {
    if (jobId === id) setAudioReadySlots(sceneSlots);
  });

  const hasSceneSource = job?.graph?.nodes.some((n) => n.type === "SceneSource") ?? true;
  const rawStep = id ? (job ? statusToStep(job.status) : 0) : 0;
  const currentStep = !hasSceneSource && rawStep === 2 ? 3 : rawStep;

  useEffect(() => {
    if (job && (job.status === "rendering" || job.status === "done" || job.status === "failed")) {
      navigate(`/jobs`);
    }
  }, [job, navigate]);

  if (id && isLoading) {
    return (
      <div className="min-h-screen bg-nyx-deep flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-nyx-text-muted" />
      </div>
    );
  }

  /* ── Step 2: layout imersivo com sidebar ── */
  if (currentStep === 1 && id) {
    return (
      <div className="flex h-screen bg-nyx-deep text-nyx-text-primary overflow-hidden">
        {/* Sidebar */}
        <aside className="flex w-52 shrink-0 flex-col border-r border-nyx-border bg-nyx-void px-5 py-8">
          <p className="mb-8 font-display text-sm font-semibold tracking-wide text-nyx-text-muted uppercase">
            Novo vídeo
          </p>
          <WizardStepperVertical current={currentStep + 1} />
        </aside>

        {/* Content */}
        <main className="flex flex-1 min-w-0 flex-col overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key="step2"
              className="flex flex-1 min-h-0 flex-col p-8"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <Step2_Narration jobId={id} status={job?.status ?? "draft"} />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    );
  }

  /* ── Steps 1, 3, 4: layout padrão ── */
  return (
    <div className="min-h-screen bg-nyx-deep text-nyx-text-primary">
      <div className="max-w-3xl mx-auto px-4 pt-12 pb-24">
        <h1 className="text-2xl font-bold mb-6">Novo vídeo</h1>
        <WizardStepper current={currentStep + 1} />

        <AnimatePresence mode="wait">
          {currentStep === 0 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Step1_TemplateSelect onCreated={(newJob) => navigate(`/jobs/${newJob.id}/edit`)} />
            </motion.div>
          )}

          {currentStep === 2 && id && job && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Step3_MediaSlots jobId={id} slots={audioReadySlots ?? job.sceneSlots ?? []} />
            </motion.div>
          )}

          {currentStep === 3 && id && job && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Step4_Confirm job={job} onRendering={() => navigate("/jobs")} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
