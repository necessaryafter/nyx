  import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type SectionHeadingProps = {
  children: ReactNode;
  subtitle?: ReactNode;
  className?: string;
  align?: "center" | "left";
};

export function SectionHeading({
  children,
  subtitle,
  className,
  align = "center",
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "mb-10",
        align === "center" && "text-center",
        className,
      )}
    >
      <h2 className="font-display text-2xl font-bold text-nyx-text-primary md:text-3xl">
        {children}
      </h2>
      {subtitle && (
        <p className="mx-auto mt-3 max-w-xl text-base text-nyx-text-muted">
          {subtitle}
        </p>
      )}
    </div>
  );
}
