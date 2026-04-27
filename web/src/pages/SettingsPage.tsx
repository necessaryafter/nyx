import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  User,
  Settings,
  Shield,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  Loader2,
  Check,
  Bell,
  Plug,
  KeyRound,
  Trash2,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { cn } from "../lib/cn";
import { useIntegrations, useUpsertIntegration, useDeleteIntegration } from "../hooks/useIntegrations";
import { authClient } from "../lib/auth";
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from "../hooks/useApiKeys";

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] as const },
});

type Tab = "profile" | "preferences" | "security" | "integrations" | "api-keys";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "profile", label: "Perfil", icon: User },
  { id: "preferences", label: "Preferências", icon: Settings },
  { id: "security", label: "Segurança", icon: Shield },
  { id: "integrations", label: "Integrações", icon: Plug },
  { id: "api-keys", label: "API Keys", icon: KeyRound },
];

// Toggle switch component
function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
        checked ? "bg-nyx-cyan-500" : "bg-nyx-elevated",
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}

// Profile Tab
function ProfileTab() {
  const { data: sessionData } = authClient.useSession();
  const user = sessionData?.user;

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Sync name from session when loaded
  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  const initials = (name || user?.name || "")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
    : null;

  const handleSave = async () => {
    setError("");
    setSaving(true);
    const result = await authClient.updateUser({ name });
    setSaving(false);
    if (result.error) {
      setError("Erro ao salvar. Tente novamente.");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Avatar + identity */}
      <div className="flex items-center gap-5">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-nyx-cyan-500 to-nyx-orange-500 text-lg font-bold text-white">
          {user?.image ? (
            <img src={user.image} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            initials || "?"
          )}
        </div>
        <div>
          <p className="font-medium text-nyx-text-primary">{user?.name ?? "—"}</p>
          {memberSince && (
            <p className="text-sm text-nyx-text-muted">Membro desde {memberSince}</p>
          )}
        </div>
      </div>

      <div className="h-px bg-nyx-border" />

      {/* Form */}
      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-nyx-text-secondary">
            Nome
          </label>
          <input
            type="text"
            value={name || user?.name || ""}
            onChange={(e) => setName(e.target.value)}
            className="h-10 w-full rounded-lg border border-nyx-border bg-nyx-deep px-3 text-sm text-nyx-text-primary placeholder:text-nyx-text-muted focus:border-nyx-cyan-500 focus:outline-none"
          />
        </div>

        {/* Email (read-only) */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-nyx-text-secondary">
            Email
          </label>
          <div className="flex items-center gap-2">
            <input
              type="email"
              value={user?.email ?? ""}
              readOnly
              className="h-10 w-full rounded-lg border border-nyx-border bg-nyx-elevated px-3 text-sm text-nyx-text-muted"
            />
            <Lock className="h-4 w-4 shrink-0 text-nyx-text-muted" />
          </div>
          <p className="mt-1 text-xs text-nyx-text-muted">
            Gerenciado pelo provedor de autenticação
          </p>
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Save */}
      <div className="flex justify-end">
        <Button
          variant="primary"
          size="md"
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="!bg-nyx-cyan-500 hover:!opacity-90"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="h-4 w-4" />
          ) : null}
          {saved ? "Salvo!" : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
}

// Preferences Tab
function PreferencesTab() {
  const [notifs, setNotifs] = useState({
    renderDone: true,
    renderFailed: true,
    lowBalance: false,
    marketing: false,
  });

  const items = [
    {
      key: "renderDone" as const,
      label: "Render concluído",
      desc: "Receber notificação quando um render terminar",
    },
    {
      key: "renderFailed" as const,
      label: "Render falhou",
      desc: "Receber notificação quando um render falhar",
    },
    {
      key: "lowBalance" as const,
      label: "Saldo baixo",
      desc: "Alertar quando créditos estiverem abaixo de 50",
    },
    {
      key: "marketing" as const,
      label: "Email marketing",
      desc: "Novidades, dicas e atualizações do Nyx",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <Bell className="h-4 w-4 text-nyx-text-muted" />
          <p className="text-sm font-semibold text-nyx-text-secondary">
            Notificações
          </p>
        </div>
        <p className="text-xs text-nyx-text-muted">
          Gerencie quais notificações você recebe
        </p>
      </div>

      <div className="space-y-1">
        {items.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between rounded-xl border border-nyx-border bg-nyx-surface px-4 py-4"
          >
            <div>
              <p className="text-sm font-medium text-nyx-text-primary">
                {item.label}
              </p>
              <p className="mt-0.5 text-xs text-nyx-text-muted">{item.desc}</p>
            </div>
            <Toggle
              checked={notifs[item.key]}
              onChange={(v) => setNotifs((n) => ({ ...n, [item.key]: v }))}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// Security Tab
function SecurityTab() {
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const handleChangePassword = async () => {
    setError("");
    if (newPwd.length < 8) {
      setError("A nova senha deve ter pelo menos 8 caracteres");
      return;
    }
    if (newPwd !== confirmPwd) {
      setError("As senhas não coincidem");
      return;
    }
    setSaving(true);
    await new Promise((r) => setTimeout(r, 1000));
    setSaving(false);
    setSaved(true);
    setCurrentPwd("");
    setNewPwd("");
    setConfirmPwd("");
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Change password */}
      <div>
        <h3 className="mb-4 text-sm font-semibold text-nyx-text-secondary">
          Alterar senha
        </h3>
        <div className="space-y-4">
          {[
            { label: "Senha atual", value: currentPwd, onChange: setCurrentPwd },
            { label: "Nova senha", value: newPwd, onChange: setNewPwd, hint: "Mín. 8 caracteres" },
            { label: "Confirmar nova senha", value: confirmPwd, onChange: setConfirmPwd },
          ].map(({ label, value, onChange, hint }) => (
            <div key={label}>
              <label className="mb-1.5 block text-sm font-medium text-nyx-text-secondary">
                {label}
              </label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  className="h-10 w-full rounded-lg border border-nyx-border bg-nyx-deep px-3 pr-10 text-sm text-nyx-text-primary focus:border-nyx-cyan-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-nyx-text-muted hover:text-nyx-text-secondary"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {hint && (
                <p className="mt-1 text-xs text-nyx-text-muted">{hint}</p>
              )}
            </div>
          ))}

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          <div className="flex justify-end">
            <Button
              variant="primary"
              size="md"
              onClick={handleChangePassword}
              disabled={saving || !currentPwd || !newPwd || !confirmPwd}
              className="!bg-nyx-cyan-500 hover:!opacity-90"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : saved ? (
                <Check className="h-4 w-4" />
              ) : null}
              {saved ? "Senha alterada!" : "Alterar senha"}
            </Button>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <h3 className="text-sm font-semibold text-red-400">Zona de Perigo</h3>
        </div>
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5">
          <h4 className="font-medium text-nyx-text-primary">Deletar conta</h4>
          <p className="mt-1 text-sm text-nyx-text-muted">
            Essa ação é permanente e irreversível. Todos os seus dados serão apagados:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-0.5 text-sm text-nyx-text-muted">
            <li>Templates e configurações</li>
            <li>Assets (vídeos, áudios, textos)</li>
            <li>Histórico de jobs e renders</li>
            <li>Créditos restantes (sem reembolso)</li>
          </ul>
          <div className="mt-4 flex justify-end">
            <Button
              variant="primary"
              size="md"
              className="!bg-red-600 hover:!bg-red-700"
              onClick={() => setShowDeleteDialog(true)}
            >
              Deletar minha conta
            </Button>
          </div>
        </div>
      </div>

      {/* Delete dialog */}
      <AnimatePresence>
        {showDeleteDialog && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteDialog(false)}
            />
            <motion.div
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-nyx-border bg-nyx-elevated p-6 shadow-2xl"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18 }}
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                <AlertTriangle className="h-6 w-6 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-nyx-text-primary">
                Deletar conta
              </h3>
              <p className="mt-2 text-sm text-nyx-text-secondary">
                Tem certeza? Essa ação não pode ser desfeita. Todos os seus dados
                serão permanentemente apagados.
              </p>

              <div className="mt-5">
                <label className="mb-2 block text-sm text-nyx-text-secondary">
                  Digite <strong className="text-nyx-text-primary">DELETAR</strong> para confirmar:
                </label>
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  className="h-10 w-full rounded-lg border border-nyx-border bg-nyx-deep px-3 text-sm text-nyx-text-primary focus:border-red-500 focus:outline-none"
                  placeholder="DELETAR"
                />
              </div>

              <div className="mt-5 flex gap-3">
                <Button
                  variant="secondary"
                  size="md"
                  className="flex-1"
                  onClick={() => {
                    setShowDeleteDialog(false);
                    setDeleteConfirm("");
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  className="flex-1 !bg-red-600 hover:!bg-red-700 disabled:!bg-red-900"
                  disabled={deleteConfirm !== "DELETAR"}
                >
                  Confirmar delete
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// Integrations Tab
function IntegrationsTab() {
  const { data: integrations, isLoading } = useIntegrations();
  const upsert = useUpsertIntegration();
  const remove = useDeleteIntegration();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const talkify = integrations?.find((i) => i.provider === "talkify");

  const handleConnect = async () => {
    await upsert.mutateAsync({ provider: "talkify", apiKey });
    setApiKey("");
  };

  const handleRemove = () => remove.mutate("talkify");

  return (
    <div className="space-y-4">
      <motion.div {...fade(0)}>
        <h2 className="text-sm font-semibold text-nyx-text-primary">Integrações</h2>
        <p className="mt-0.5 text-xs text-nyx-text-muted">
          Conecte provedores externos para usar no seu pipeline de vídeo.
        </p>
      </motion.div>

      {/* Talkify card */}
      <motion.div
        {...fade(0.05)}
        className="rounded-xl border border-nyx-border bg-nyx-surface p-4 space-y-3"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-nyx-elevated">
            <KeyRound className="h-4 w-4 text-nyx-cyan-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-nyx-text-primary">Talkify</p>
            <p className="text-xs text-nyx-text-muted">Síntese de voz (TTS)</p>
          </div>
          {talkify && (
            <span className="ml-auto rounded-full bg-nyx-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-nyx-cyan-500">
              Conectado
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-nyx-text-muted">
            <Loader2 className="h-3 w-3 animate-spin" />
            Carregando...
          </div>
        ) : talkify ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg bg-nyx-void/50 px-3 py-2">
              <span className="font-mono text-xs text-nyx-text-secondary">{talkify.maskedKey}</span>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? "text" : "password"}
                  placeholder="Nova API Key (para atualizar)"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full rounded-lg border border-nyx-border bg-nyx-void px-3 py-2 pr-9 text-xs text-nyx-text-primary placeholder:text-nyx-text-muted focus:border-nyx-cyan-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-nyx-text-muted hover:text-nyx-text-primary"
                >
                  {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <Button
                size="sm"
                onClick={handleConnect}
                disabled={!apiKey.trim() || upsert.isPending}
              >
                {upsert.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Atualizar
              </Button>
            </div>
            <button
              onClick={handleRemove}
              disabled={remove.isPending}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
            >
              {remove.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
              Remover integração
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-nyx-text-muted leading-relaxed">
              Você precisa de uma conta <span className="text-nyx-text-secondary">Talkify Premium</span> para obter uma API Key. Acesse{" "}
              <span className="text-nyx-cyan-500">talkifylabs.com</span> para criar sua conta.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? "text" : "password"}
                  placeholder="Cole sua API Key aqui"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full rounded-lg border border-nyx-border bg-nyx-void px-3 py-2 pr-9 text-xs text-nyx-text-primary placeholder:text-nyx-text-muted focus:border-nyx-cyan-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-nyx-text-muted hover:text-nyx-text-primary"
                >
                  {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <Button
                size="sm"
                onClick={handleConnect}
                disabled={!apiKey.trim() || upsert.isPending}
              >
                {upsert.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Conectar
              </Button>
            </div>
            {upsert.isError && (
              <p className="text-xs text-red-400">
                Erro ao salvar. Verifique sua API Key.
              </p>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

// API Keys Tab
function ApiKeysTab() {
  const { data: keys, isLoading } = useApiKeys();
  const create = useCreateApiKey();
  const revoke = useRevokeApiKey();
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    const result = await create.mutateAsync(name.trim());
    setNewKey(result.key);
    setName("");
  };

  const handleCopy = () => {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <motion.div {...fade(0)}>
        <h2 className="text-sm font-semibold text-nyx-text-primary">API Keys</h2>
        <p className="mt-0.5 text-xs text-nyx-text-muted">
          Gere chaves para autenticar integrações externas (ex: Thanatos).
        </p>
      </motion.div>

      {/* Create form */}
      <motion.div {...fade(0.05)} className="rounded-xl border border-nyx-border bg-nyx-surface p-4 space-y-3">
        <p className="text-xs font-medium text-nyx-text-secondary">Nova API Key</p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Nome da key (ex: thanatos)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && !create.isPending && handleCreate()}
            className="h-9 flex-1 rounded-lg border border-nyx-border bg-nyx-void px-3 text-sm text-nyx-text-primary placeholder:text-nyx-text-muted focus:border-nyx-cyan-500 focus:outline-none"
          />
          <Button
            size="sm"
            variant="primary"
            className="!bg-nyx-cyan-500 hover:!opacity-90"
            onClick={handleCreate}
            disabled={!name.trim() || create.isPending}
          >
            {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Gerar
          </Button>
        </div>

        {create.isError && (
          <p className="text-xs text-red-400">
            {(create.error as Error)?.message?.includes("403")
              ? "Sem permissão para gerar API keys."
              : "Erro ao gerar API key."}
          </p>
        )}
      </motion.div>

      {/* One-time key reveal */}
      <AnimatePresence>
        {newKey && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-nyx-cyan-500/30 bg-nyx-cyan-500/5 p-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-nyx-cyan-500" />
              <p className="text-sm font-medium text-nyx-cyan-500">API Key gerada</p>
            </div>
            <p className="text-xs text-nyx-text-muted">
              Copie agora — essa chave não será exibida novamente.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg bg-nyx-void px-3 py-2 font-mono text-xs text-nyx-text-primary">
                {newKey}
              </code>
              <Button size="sm" onClick={handleCopy}>
                {copied ? <Check className="h-3.5 w-3.5" /> : null}
                {copied ? "Copiado!" : "Copiar"}
              </Button>
            </div>
            <button
              onClick={() => setNewKey(null)}
              className="text-xs text-nyx-text-muted hover:text-nyx-text-secondary"
            >
              Fechar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Existing keys */}
      <motion.div {...fade(0.1)} className="space-y-2">
        <p className="text-xs font-medium text-nyx-text-secondary">Keys ativas</p>
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-nyx-text-muted">
            <Loader2 className="h-3 w-3 animate-spin" />
            Carregando...
          </div>
        ) : !keys?.length ? (
          <p className="text-xs text-nyx-text-muted">Nenhuma API key gerada ainda.</p>
        ) : (
          <div className="space-y-2">
            {keys.map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between rounded-xl border border-nyx-border bg-nyx-surface px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-nyx-text-primary">{k.name}</p>
                  <p className="mt-0.5 text-xs text-nyx-text-muted">
                    Criada em {new Date(k.createdAt).toLocaleDateString("pt-BR")}
                    {k.lastUsedAt && (
                      <> · Usada em {new Date(k.lastUsedAt).toLocaleDateString("pt-BR")}</>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => revoke.mutate(k.id)}
                  disabled={revoke.isPending}
                  className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  {revoke.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                  Revogar
                </button>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <motion.h1
        className="font-display text-xl font-bold text-nyx-text-primary"
        {...fade(0)}
      >
        Configurações
      </motion.h1>

      {/* Tabs */}
      <motion.div
        className="flex gap-1 border-b border-nyx-border"
        {...fade(0.05)}
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-2.5 text-sm transition-colors duration-150",
                active
                  ? "text-nyx-text-primary"
                  : "text-nyx-text-secondary hover:text-nyx-text-primary",
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {active && (
                <motion.span
                  layoutId="settings-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-nyx-cyan-500"
                />
              )}
            </button>
          );
        })}
      </motion.div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === "profile" && <ProfileTab />}
          {activeTab === "preferences" && <PreferencesTab />}
          {activeTab === "security" && <SecurityTab />}
          {activeTab === "integrations" && <IntegrationsTab />}
          {activeTab === "api-keys" && <ApiKeysTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
