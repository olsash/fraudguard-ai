import { Link, useNavigate } from "@tanstack/react-router";
import { Brand } from "@/components/common/Brand";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { AuthApiError, authService } from "@/services/authService";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type LoginFieldErrors = {
  email?: string;
  password?: string;
};

export default function Login() {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateForm() {
    const nextErrors: LoginFieldErrors = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      nextErrors.email = "Email is required.";
    } else if (!emailPattern.test(trimmedEmail)) {
      nextErrors.email = "Please enter a valid email address.";
    }

    if (!password) {
      nextErrors.password = "Password is required.";
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await authService.signIn(email.trim(), password);
      void navigate({ to: result.redirectTo, replace: true });
    } catch (err) {
      if (err instanceof AuthApiError) {
        if (err.code === "EMAIL_NOT_FOUND" || err.field === "email") {
          setFieldErrors((current) => ({
            ...current,
            email: "No account was found with this email.",
          }));
          return;
        }

        if (err.code === "INVALID_PASSWORD" || err.field === "password") {
          setFieldErrors((current) => ({
            ...current,
            password: "Incorrect password. Please try again.",
          }));
          return;
        }

        if ((err.status ?? 500) >= 500 || err.status === 0) {
          setFormError("Login service is currently unavailable. Please try again.");
          return;
        }

        setFormError(err.message || "Unable to sign in.");
        return;
      }

      setFormError("Login service is currently unavailable. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your FraudGuard workspace">
      <form className="space-y-4" onSubmit={handleSubmit} autoComplete="off" noValidate>
        <Field
          label="Email"
          type="email"
          id="fg-login-email-input"
          name="fg-login-email-input"
          placeholder="you@bank.io"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setFieldErrors((current) => ({ ...current, email: undefined }));
            setFormError("");
          }}
          autoComplete="off"
          error={fieldErrors.email}
        />
        <div>
          <Field
            label="Password"
            type={show ? "text" : "password"}
            id="fg-login-passphrase-input"
            name="fg-login-passphrase-input"
            placeholder="Password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setFieldErrors((current) => ({ ...current, password: undefined }));
              setFormError("");
            }}
            autoComplete="new-password"
            error={fieldErrors.password}
            rightIcon={
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="text-muted-foreground hover:text-foreground"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />
          <div className="flex justify-end mt-2 text-xs">
            <Link to="/forgot-password" className="text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>
        {formError && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {formError}
          </p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="block w-full text-center bg-gradient-primary text-primary-foreground rounded-lg py-3 font-medium ring-glow disabled:opacity-60"
        >
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
        <p className="text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link to="/register" className="text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-mesh">
      <div className="hidden md:flex flex-col justify-between p-12 relative overflow-hidden border-r border-border">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="relative">
          <Link to="/">
            <Brand size="lg" />
          </Link>
        </div>
        <div className="relative">
          <h2 className="text-4xl font-display font-semibold leading-tight">
            FraudGuard-AI detects online payment fraud with{" "}
            <span className="text-gradient">machine learning.</span>
          </h2>
          <p className="mt-4 text-muted-foreground max-w-md">
            Sign in to run transaction predictions, inspect history, review alerts, and compare the
            exported machine learning models.
          </p>
          <div className="mt-8 glass rounded-2xl p-5 max-w-md">
            <p className="text-sm">
              FraudGuard-AI combines a React/Vite interface, ASP.NET Core Web API, ONNX Runtime ML
              service, and scikit-learn model artifacts.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Online payment fraud detection using machine learning
            </p>
          </div>
        </div>
        <p className="relative text-xs text-muted-foreground">(c) 2026 FraudGuard Research</p>
      </div>
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm glass rounded-2xl p-8">
          <h1 className="text-2xl font-display font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

type FieldProps = {
  label: string;
  rightIcon?: React.ReactNode;
  hint?: string;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>;

export function Field({
  label,
  rightIcon,
  hint,
  error,
  className: _className,
  id,
  ...inputProps
}: FieldProps) {
  const errorId = id ? `${id}-error` : undefined;

  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div
        className={`mt-1 flex items-center glass rounded-lg px-3 py-2.5 focus-within:ring-1 ${
          error
            ? "border-destructive/60 focus-within:ring-destructive/50"
            : "focus-within:ring-primary/60"
        }`}
      >
        <input
          {...inputProps}
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : inputProps["aria-describedby"]}
          className={`flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground ${_className ?? ""}`}
        />
        {rightIcon}
      </div>
      {error && (
        <span id={errorId} className="mt-1 block text-xs text-destructive">
          {error}
        </span>
      )}
      {hint && <span className="text-[10px] text-muted-foreground mt-1 block">{hint}</span>}
    </label>
  );
}
