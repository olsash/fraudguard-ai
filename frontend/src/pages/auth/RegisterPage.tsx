import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthShell, Field } from "@/pages/auth/LoginPage";
import { AuthApiError, authService } from "@/services/authService";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RegisterFieldErrors = {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  terms?: string;
};

export default function Register() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const score = scorePwd(pwd);

  function clearFieldError(field: keyof RegisterFieldErrors) {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormError("");
  }

  function validateForm() {
    const nextErrors: RegisterFieldErrors = {};
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      nextErrors.fullName = "Full name is required.";
    }

    if (!trimmedEmail) {
      nextErrors.email = "Email is required.";
    } else if (!emailPattern.test(trimmedEmail)) {
      nextErrors.email = "Please enter a valid email address.";
    }

    if (!pwd) {
      nextErrors.password = "Password is required.";
    } else if (pwd.length < 6) {
      nextErrors.password = "Password must be at least 6 characters.";
    } else if (!/[A-Za-z]/.test(pwd) || !/\d/.test(pwd)) {
      nextErrors.password = "Password must contain both letters and numbers.";
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = "Please confirm your password.";
    } else if (pwd && pwd !== confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    if (!acceptedTerms) {
      nextErrors.terms = "You must agree to the Terms of Service and Privacy Policy.";
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (isSubmitting || !validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await authService.register(fullName.trim(), email.trim(), pwd);
      void navigate({ to: result.redirectTo, replace: true });
    } catch (err) {
      if (err instanceof AuthApiError) {
        if (err.code === "EMAIL_ALREADY_EXISTS" || err.field === "email") {
          setFieldErrors((current) => ({
            ...current,
            email: "An account with this email already exists.",
          }));
          return;
        }

        if (err.field === "password") {
          setFieldErrors((current) => ({
            ...current,
            password: err.message || "Password must contain both letters and numbers.",
          }));
          return;
        }
      }

      setFormError("Registration service is currently unavailable. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Access the FraudGuard-AI prediction workspace">
      <form className="space-y-4" onSubmit={handleSubmit} autoComplete="off" noValidate>
        <Field
          label="Full name"
          placeholder="FraudGuard User"
          value={fullName}
          onChange={(event) => {
            setFullName(event.target.value);
            clearFieldError("fullName");
          }}
          error={fieldErrors.fullName}
          required
        />
        <Field
          label="Work email"
          type="email"
          placeholder="you@bank.io"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            clearFieldError("email");
          }}
          error={fieldErrors.email}
          autoComplete="off"
          required
        />
        <label className="block">
          <span className="text-xs text-muted-foreground">Password</span>
          <div
            className={`mt-1 flex items-center glass rounded-lg px-3 py-2.5 focus-within:ring-1 ${
              fieldErrors.password
                ? "border-destructive/60 focus-within:ring-destructive/50"
                : "focus-within:ring-primary/60"
            }`}
          >
            <input
              type="password"
              value={pwd}
              onChange={(event) => {
                setPwd(event.target.value);
                clearFieldError("password");
              }}
              placeholder="Enter password"
              className="flex-1 bg-transparent text-sm outline-none"
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? "register-password-error" : undefined}
              required
              minLength={6}
            />
          </div>
          <div className="mt-2 flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full ${i < score ? (score >= 3 ? "bg-success" : score === 2 ? "bg-warning" : "bg-destructive") : "bg-secondary"}`}
              />
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Use at least 6 characters. Letters, numbers, and symbols are recommended.
          </p>
          {fieldErrors.password && (
            <span id="register-password-error" className="mt-1 block text-xs text-destructive">
              {fieldErrors.password}
            </span>
          )}
        </label>
        <Field
          label="Confirm password"
          type="password"
          placeholder="Confirm your password"
          value={confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.target.value);
            clearFieldError("confirmPassword");
          }}
          error={fieldErrors.confirmPassword}
          required
          minLength={6}
        />
        <div>
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="mt-0.5 accent-primary"
              checked={acceptedTerms}
              onChange={(event) => {
                setAcceptedTerms(event.target.checked);
                clearFieldError("terms");
              }}
            />
            I agree to the Terms of Service and Privacy Policy.
          </label>
          {fieldErrors.terms && <p className="mt-1 text-xs text-destructive">{fieldErrors.terms}</p>}
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
          {isSubmitting ? "Creating account..." : "Create account"}
        </button>
        <p className="pt-1 text-center text-sm text-muted-foreground">
          Already have one?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

function scorePwd(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s;
}
