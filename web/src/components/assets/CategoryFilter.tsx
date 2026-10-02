import { cn } from "../../lib/cn";
import { useAssetCategories } from "../../hooks/useAssets";
import { NO_CATEGORY } from "../../lib/types";

type AssetType = "video" | "audio" | "text" | "image";

/**
 * Chips de categoria: "Todas", "Avulsos" e uma por categoria, com contagem.
 * value: undefined = todas, NO_CATEGORY = só avulsos, senão o nome da categoria.
 */
export function CategoryFilter({
  type,
  value,
  onChange,
  size = "md",
}: {
  type?: AssetType;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  size?: "sm" | "md";
}) {
  const { data } = useAssetCategories(type);
  if (!data || (data.categories.length === 0 && data.none === data.total)) return null; // sem categorias: nada a filtrar

  const chips: { label: string; value: string | undefined; count: number }[] = [
    { label: "Todas", value: undefined, count: data.total },
    { label: "Avulsos", value: NO_CATEGORY, count: data.none },
    ...data.categories.map((c) => ({ label: c.category, value: c.category as string | undefined, count: c.count })),
  ];

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((chip) => {
        const active = value === chip.value;
        return (
          <button
            key={chip.value ?? "__all__"}
            type="button"
            onClick={() => onChange(chip.value)}
            className={cn(
              "rounded-full border transition-colors",
              size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
              active
                ? "border-nyx-cyan-500 bg-nyx-cyan-500/10 text-nyx-text-primary"
                : "border-nyx-border text-nyx-text-secondary hover:border-nyx-hover hover:text-nyx-text-primary",
            )}
          >
            {chip.label} <span className="text-nyx-text-muted">({chip.count})</span>
          </button>
        );
      })}
    </div>
  );
}
