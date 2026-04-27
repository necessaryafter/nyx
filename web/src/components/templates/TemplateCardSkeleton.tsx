import { Skeleton } from "../ui/Skeleton";

export function TemplateCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-nyx-border bg-nyx-surface">
      <div className="h-[3px] bg-nyx-border" />
      <div className="p-4">
        <Skeleton className="h-4 w-3/4" />
        <div className="mt-3 flex gap-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
    </div>
  );
}
