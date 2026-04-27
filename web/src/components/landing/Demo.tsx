import { SectionWrapper } from "../ui/SectionWrapper";
import { AnimatedEntry } from "../ui/AnimatedEntry";

export function Demo() {
  return (
    <SectionWrapper>
      <AnimatedEntry>
        <div className="mx-auto max-w-4xl overflow-hidden rounded-xl border border-nyx-border bg-nyx-surface">
          <div className="flex aspect-video items-center justify-center bg-nyx-deep">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-nyx-border">
                <div className="ml-0.5 h-0 w-0 border-t-[6px] border-b-[6px] border-l-[10px] border-transparent border-l-nyx-text-muted" />
              </div>
              <p className="mt-4 text-sm text-nyx-text-muted">
                Demo do editor em breve
              </p>
            </div>
          </div>
        </div>
      </AnimatedEntry>
    </SectionWrapper>
  );
}
