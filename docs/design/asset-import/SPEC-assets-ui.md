# Spec: `assets-ui` — Botão, revisão e grupo na tela de Assets

> Módulo do mapa `capability-map.md`. Depende de `asset-import` (API).
> Status: rascunho para revisão.

## Objetivo

Sem sair da tela de Assets: subir um vídeo longo, ver os cortes detectados, escolher quais quer, e ver o resultado agrupado junto dos outros assets — copiando o estilo que já existe (`AssetsPage.tsx`: grid de cards, drop zone, barra de progresso de upload).

## Fluxo

1. Botão novo **"Importar vídeo longo"** ao lado do "Upload" que já existe.
2. Escolhe o arquivo → sobe em chunks (reusa a mesma barra de progresso que o upload normal já tem) → `POST /api/asset-imports/upload/*`.
3. Enquanto `status = detecting`: um item de "processando" aparece no topo da grid (spinner + "Analisando cortes de {nome}...").
4. Se cair em `awaiting_fallback_choice`: modal simples — "Não encontramos cortes de cena neste vídeo. O que fazer?" com dois botões (dividir em pedaços de 45s / manter como 1 vídeo só).
5. Quando `awaiting_review`: abre a **tela de revisão** (modal cheio ou rota própria) — grid dos segmentos candidatos, cada um com miniatura, duração, checkbox marcado por padrão, campo de nome opcional. Botões "Cancelar importação" e "Confirmar (N selecionados)".
6. Confirmado: volta pra tela de Assets; os novos assets aparecem dentro de um **card de grupo** — "{nome do vídeo original} (N vídeos)" — que expande inline mostrando os `AssetCard` de cada um (mesmo componente que já existe, sem mudança).

## Estrutura

```
web/src/components/assets/ImportButton.tsx       → botão + upload em chunks (espelha a lógica de upload já em AssetsPage.tsx)
web/src/components/assets/ImportReviewModal.tsx  → grid de segmentos, checkboxes, confirmar/cancelar
web/src/components/assets/FallbackChoiceModal.tsx→ "dividir em pedaços" vs "manter como 1"
web/src/components/assets/AssetGroupCard.tsx     → card colapsável (nome do lote + N vídeos), expande em AssetCard[]
web/src/hooks/useAssetImports.ts                 → useStartImport, useImport(batchId) [polling/WS], useConfirmImport,
                                                     useFallbackChoice, useDiscardImport, usePendingImports
web/src/pages/AssetsPage.tsx                      → + botão de import, + agrupamento na renderização da grid
```

## Contratos consumidos

```ts
interface ImportBatch {
  id: string;
  sourceName: string;
  status: "detecting" | "awaiting_fallback_choice" | "awaiting_review" | "done" | "discarded" | "failed";
  segments: Array<{
    index: number; startMs: number; endMs: number;
    thumbnailUrl: string; // já vem pré-assinada do backend
    selected: boolean; name?: string;
  }>;
  error: string | null;
}
```

## Agrupamento na grid (`AssetsPage.tsx`)

Hoje `assets.data.data` é uma lista plana. Pra agrupar sem reescrever a paginação: no `useAssets`, os assets com `importBatchId` igual e consecutivos na mesma página viram 1 `AssetGroupCard`; os demais (importBatchId nulo) continuam como `AssetCard` direto, igual hoje. Assets do mesmo lote em páginas diferentes (paginação cortou o grupo ao meio) — aceito como limitação de v1, não vale a complexidade de agrupar entre páginas.

```tsx
// padrão de hook (igual useSchedulers.ts)
export function useStartImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadInChunks("/api/asset-imports/upload", file, onProgress),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["asset-imports"] }),
  });
}
```

## Estilo

Reaproveitar sem reescrever: `AssetCard`, `Skeleton`, `Button`, a lógica de `DropZone`/`UploadProgress` de `AssetsPage.tsx` (a parte de progresso de chunk é idêntica ao upload multipart que assets já faz — só muda o endpoint de destino).

## Testes

- `bunx tsc -b` e `bun run lint` verdes.
- Checklist manual: subir vídeo com cortes reais → revisão mostra N miniaturas → desmarcar 1 → confirmar → grupo aparece na grid com N-1 → expandir mostra os assets certos → excluir 1 asset do grupo não afeta os outros nem quebra o card.
- Vídeo sem corte → modal de fallback aparece → escolher "dividir em pedaços" → revisão mostra os pedaços de 45s.

## Limites

- **Sempre:** usar os componentes que já existem (`AssetCard`, `Button`, `Skeleton`) sem duplicar estilo.
- **Nunca:** deixar a tela de Assets travada enquanto o vídeo está em `detecting` — o resto da grid continua navegável, só o item de progresso mostra o status.

## Critérios de sucesso

1. Fluxo completo (upload → revisão → confirmar → ver agrupado) sem recarregar a página nem sair da tela de Assets.
2. Card de grupo mostra visualmente que aqueles assets vieram do mesmo vídeo, sem precisar abrir cada um pra descobrir.
3. Cancelar a importação em qualquer etapa da revisão não deixa nada pela metade na tela.

## Decisões (eram perguntas abertas, resolvidas com o usuário)

1. ~~Card de grupo expandido ou fechado?~~ → resolvido: fechado por padrão, expande no clique.

## Fora de escopo (v2)

- "Baixar todos"/"Selecionar todos do grupo" pra apagar o lote inteiro de uma vez — não foi pedido, fica pra depois se fizer falta.
