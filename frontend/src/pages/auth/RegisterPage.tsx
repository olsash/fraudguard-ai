import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthShell, Field, Divider, SocialBtn } from "@/pages/auth/LoginPage";
import { Github, Mail } from "lucide-react";
import { authService } from "@/services/authService";

export default function Register() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [pwd, setPwd] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const score = scorePwd(pwd);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!acceptedTerms) {
      setError("Please accept the terms to continue.");
      return;
    }

    if (pwd !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await authService.register(fullName.trim(), email, phoneNumber, pwd);
      void navigate({ to: result.redirectTo, replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create account.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Start detecting fraud in under 2 minutes">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Field label="Full name" placeholder="Sara Amrani" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
        <Field label="Work email" type="email" placeholder="you@bank.io" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <Field label="Phone number" type="tel" placeholder="+1 555 0100" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} maxLength={50} />
        <label className="block">
          <span className="text-xs text-muted-foreground">Password</span>
          <div className="mt-1 flex items-center glass rounded-lg px-3 py-2.5">
            <input type="password" value={pwd} onChange={(event) => setPwd(event.target.value)} placeholder="Enter password" className="flex-1 bg-transparent text-sm outline-none" required minLength={6} />
          </div>
          <div className="mt-2 flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`h-1 flex-1 rounded-full ${i < score ? (score >= 3 ? "bg-success" : score === 2 ? "bg-warning" : "bg-destructive") : "bg-secondary"}`} />
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Use at least 6 characters. Letters, numbers, and symbols are recommended.</p>
        </label>
        <Field label="Confirm password" type="password" placeholder="Confirm your password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={6} />
        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input type="checkbox" className="mt-0.5 accent-primary" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} />
          I agree to the Terms of Service and Privacy Policy.
        </label>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <button type="submit" disabled={isSubmitting} className="block w-full text-center bg-gradient-primary text-primary-foreground rounded-lg py-3 font-medium ring-glow disabled:opacity-60">
          {isSubmitting ? "Creating account..." : "Create account"}
        </button>
        <Divider />
        <div className="grid grid-cols-2 gap-2">
          <SocialBtn icon={Github} label="GitHub" />
          <SocialBtn icon={Mail} label="Google" />
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Already have one? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
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
