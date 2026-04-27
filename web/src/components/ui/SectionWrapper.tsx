import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type SectionWrapperProps = {
  id?: string;
  children: ReactNode;
  className?: string;
};

export function SectionWrapper({
  id,
  children,
  className,
}: SectionWrapperProps) {
  return (
    <section
      id={id}
      className={cn(
        "relative mx-auto w-full max-w-7xl px-6 py-20 md:py-28 lg:px-8",
        className,
      )}
    >
      {children}
    </section>
  );
}
