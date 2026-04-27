import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { authClient } from "../lib/auth";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { OAuthButtons } from "../components/auth/OAuthButtons";
import { Separator } from "../components/auth/Separator";
import { ErrorBanner } from "../components/auth/ErrorBanner";
import { PasswordStrength } from "../components/auth/PasswordStrength";
import { AuthVisualPanel } from "../components/auth/AuthVisualPanel";

type AuthMode = "login" | "register";

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 12 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as const },
});

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function mapError(error: { code?: string; message?: string } | null): string {
  if (!error) return "Erro desconhecido. Tente novamente.";
  const code = error.code ?? "";
  if (code === "USER_ALREADY_EXISTS" || code.includes("already"))
    return "Este email já está cadastrado.";
  if (code === "INVALID_EMAIL_OR_PASSWORD" || code.includes("credential"))
    return "Email ou senha incorretos.";
  if (code.includes("rate") || code.includes("too_many"))
    return "Muitas tentativas. Aguarde alguns minutos.";
  return error.message ?? "Erro desconhecido. Tente novamente.";
}

export function AuthPage({ initialMode }: { initialMode: AuthMode }) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);

  // Redirect if already authenticated
  useEffect(() => {
    if (session && !isPending) {
      navigate("/dashboard", { replace: true });
    }
  }, [session, isPending, navigate]);

  // Sync mode with URL on initial mount
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  function validate(): boolean {
    const errs: Record<string, string> = {};

    if (mode === "register" && !name.trim()) {
      errs.name = "Nome é obrigatório.";
    }
    if (!email.trim()) {
      errs.email = "Email é obrigatório.";
    } else if (!validateEmail(email)) {
      errs.email = "Email inválido.";
    }
    if (!password) {
      errs.password = "Senha é obrigatória.";
    } else if (mode === "register" && password.length < 8) {
      errs.password = "Mínimo 8 caracteres.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setAuthError(null);

    if (mode === "register") {
      const { error } = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      if (error) {
        setAuthError(mapError(error));
        setLoading(false);
        return;
      }
      navigate("/dashboard");
    } else {
      const { error } = await authClient.signIn.email({
        email: email.trim(),
        password,
      });
      if (error) {
        setFailedAttempts((prev) => prev + 1);
        setAuthError(mapError(error));
        setLoading(false);
        return;
      }
      navigate("/dashboard");
    }
  }

  function toggleMode() {
    const next = mode === "login" ? "register" : "login";
    setMode(next);
    setAuthError(null);
    setErrors({});
    window.history.replaceState(null, "", `/${next}`);
  }

  function switchToLoginWithEmail() {
    setMode("login");
    setAuthError(null);
    setErrors({});
    window.history.replaceState(null, "", "/login");
  }

  // Show nothing while checking session to avoid flash
  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-nyx-void">
        <Loader2 className="h-6 w-6 animate-spin text-nyx-text-muted" />
      </div>
    );
  }

  const isRegister = mode === "register";

  return (
    <div className="flex min-h-screen bg-nyx-deep">
      {/* Visual panel — desktop only */}
      <div className="hidden lg:block lg:w-1/2">
        <div className="sticky top-0 h-screen">
          <AuthVisualPanel />
        </div>
      </div>

      {/* Form side */}
      <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
        <motion.div
          className="w-full max-w-sm"
          key={mode}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Mobile logo */}
          <motion.div className="mb-8 lg:hidden" {...fade(0)}>
            <span className="font-logo text-xl tracking-[0.2em] text-nyx-cyan-500">
              NYX
            </span>
          </motion.div>

          {/* Header */}
          <motion.div className="mb-8" {...fade(0.05)}>
            <h1 className="font-display text-2xl font-bold text-nyx-text-primary">
              {isRegister ? "Crie sua conta" : "Bem-vindo de volta"}
            </h1>
            <p className="mt-1.5 text-sm text-nyx-text-secondary">
              {isRegister
                ? "10 créditos grátis para seu primeiro vídeo."
                : "Entre para continuar produzindo."}
            </p>
          </motion.div>

          {/* Error banner */}
          <motion.div className="mb-4" {...fade(0.1)}>
            <ErrorBanner
              message={authError}
              action={
                authError?.includes("já está cadastrado")
                  ? {
                      label: "Entrar com esta conta →",
                      onClick: switchToLoginWithEmail,
                    }
                  : undefined
              }
            />
          </motion.div>

          {/* OAuth */}
          <motion.div {...fade(0.15)}>
            <OAuthButtons disabled={loading} />
          </motion.div>

          {/* Separator */}
          <motion.div className="my-6" {...fade(0.2)}>
            <Separator />
          </motion.div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Name field (register only) */}
            <AnimatePresence initial={false}>
              {isRegister && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <Input
                    label="Nome"
                    type="text"
                    placeholder="Seu nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    error={errors.name}
                    autoComplete="name"
                    autoFocus
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div {...fade(0.25)}>
              <Input
                label="Email"
                type="email"
                placeholder="email@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                autoComplete="email"
                autoFocus={!isRegister}
              />
            </motion.div>

            <motion.div {...fade(0.3)}>
              <div className="space-y-2">
                <Input
                  label="Senha"
                  type="password"
                  placeholder={
                    isRegister ? "Mínimo 8 caracteres" : "Sua senha"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={errors.password}
                  autoComplete={
                    isRegister ? "new-password" : "current-password"
                  }
                />
                {isRegister && <PasswordStrength password={password} />}
                {!isRegister && (
                  <div className="text-right">
                    <button
                      type="button"
                      className="cursor-pointer text-xs text-nyx-cyan-500 hover:underline"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Rate limit warning */}
            {failedAttempts >= 5 && (
              <p className="text-xs text-nyx-error">
                Muitas tentativas. Aguarde alguns minutos.
              </p>
            )}

            {/* Submit */}
            <motion.div className="pt-2" {...fade(0.35)}>
              <Button
                size="lg"
                className="w-full"
                disabled={loading || failedAttempts >= 5}
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    {isRegister ? "Criar conta" : "Entrar"}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </motion.div>
          </form>

          {/* Toggle link */}
          <motion.p
            className="mt-6 text-center text-sm text-nyx-text-muted"
            {...fade(0.4)}
          >
            {isRegister ? "Já tem conta? " : "Não tem conta? "}
            <button
              onClick={toggleMode}
              className="cursor-pointer text-nyx-cyan-500 hover:underline"
            >
              {isRegister ? "Entrar" : "Criar conta"}
            </button>
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
