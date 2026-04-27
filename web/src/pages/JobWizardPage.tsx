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
    case "audio_processing": return 1; // still on step 2, loading
    case "audio_ready": return 2;
    case "ready": return 3;
    default: return 3;
  }
}

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
                  active && "bg-nyx-cyan-500 text-nyx-900",
                  !done && !active && "bg-white/10 text-white/40",
                )}
              >
                {done ? <CheckCircle2 className="w-4 h-4" /> : idx}
              </div>
              <span
                className={cn(
                  "text-xs whitespace-nowrap",
                  active ? "text-white" : "text-white/40",
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-px w-12 mx-1 mb-5 transition-colors",
                  done ? "bg-green-500" : "bg-white/10",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Wizard de criação de job em etapas.
 *  Rota: /jobs/new (step 1) ou /jobs/:id/edit (steps 2-4)
 */
export function JobWizardPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [audioReadySlots, setAudioReadySlots] = useState<SceneSlot[] | null>(null);

  const { data: job, isLoading } = useJob(id ?? "");

  // Ouve evento audio_ready do WebSocket
  useJobsWebSocket((jobId, sceneSlots) => {
    if (jobId === id) {
      setAudioReadySlots(sceneSlots);
    }
  });

  const currentStep = id
    ? job
      ? statusToStep(job.status)
      : 0
    : 0; // sem id = step 1

  // Redireciona para jobs concluídos/em renderização
  useEffect(() => {
    if (job && (job.status === "rendering" || job.status === "done" || job.status === "failed" || job.status === "pending" || job.status === "processing")) {
      navigate(`/jobs`);
    }
  }, [job, navigate]);

  if (id && isLoading) {
    return (
      <div className="min-h-screen bg-nyx-900 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-nyx-900 text-white">
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
              <Step1_TemplateSelect
                onCreated={(newJob) => navigate(`/jobs/${newJob.id}/edit`)}
              />
            </motion.div>
          )}

          {currentStep === 1 && id && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Step2_Narration
                jobId={id}
                status={job?.status ?? "draft"}
              />
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
              <Step3_MediaSlots
                jobId={id}
                slots={audioReadySlots ?? job.sceneSlots ?? []}
              />
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
              <Step4_Confirm
                job={job}
                onRendering={() => navigate("/jobs")}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
