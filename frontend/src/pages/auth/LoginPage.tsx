import { Link, useNavigate } from "@tanstack/react-router";
import { Brand } from "@/components/common/Brand";
import { useState } from "react";
import { Eye, EyeOff, Github, Mail } from "lucide-react";
import { authService } from "@/services/authService";

export default function Login() {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("admin@credit.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const result = await authService.signIn(email, password);
      void navigate({ to: result.redirectTo, replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your FraudGuard workspace">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Field
          label="Email"
          type="email"
          placeholder="you@bank.io"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
        />
        <div>
          <Field
            label="Password"
            type={show ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            rightIcon={
              <button type="button" onClick={() => setShow(s => !s)} className="text-muted-foreground hover:text-foreground">
                {show ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
              </button>
            }
          />
          <div className="flex justify-between mt-2 text-xs">
            <label className="flex items-center gap-2 text-muted-foreground"><input type="checkbox" className="accent-primary"/> Remember me</label>
            <Link to="/forgot-password" className="text-primary hover:underline">Forgot password?</Link>
          </div>
        </div>
        <div className="glass rounded-lg p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Demo credentials</p>
          <p>User: user@credit.com / user123</p>
          <p>Admin: admin@credit.com / admin123</p>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <button type="submit" disabled={isSubmitting} className="block w-full text-center bg-gradient-primary text-primary-foreground rounded-lg py-3 font-medium ring-glow disabled:opacity-60">
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
        <Divider/>
        <div className="grid grid-cols-2 gap-2">
          <SocialBtn icon={Github} label="GitHub"/>
          <SocialBtn icon={Mail} label="Google"/>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          New here? <Link to="/register" className="text-primary hover:underline">Create an account</Link>
        </p>
      </form>
    </AuthShell>
  );
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-mesh">
      <div className="hidden md:flex flex-col justify-between p-12 relative overflow-hidden border-r border-border">
        <div className="absolute inset-0 grid-bg opacity-30"/>
        <div className="relative">
          <Link to="/"><Brand size="lg"/></Link>
        </div>
        <div className="relative">
          <h2 className="text-4xl font-display font-semibold leading-tight">Fraud doesn't sleep. <span className="text-gradient">Neither does our AI.</span></h2>
          <p className="mt-4 text-muted-foreground max-w-md">Trusted by risk teams to score 1.2M+ transactions a day with 99.41% precision.</p>
          <div className="mt-8 glass rounded-2xl p-5 max-w-md">
            <p className="text-sm">"FraudGuard cut our chargeback rate by 71% in three months."</p>
            <p className="mt-3 text-xs text-muted-foreground">Maya Lindgren, Head of Risk, NORDBANK</p>
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
} & React.InputHTMLAttributes<HTMLInputElement>;

export function Field({
  label, rightIcon, hint, className: _className, ...inputProps
}: FieldProps) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="mt-1 flex items-center glass rounded-lg px-3 py-2.5 focus-within:ring-1 focus-within:ring-primary/60">
        <input {...inputProps} className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"/>
        {rightIcon}
      </div>
      {hint && <span className="text-[10px] text-muted-foreground mt-1 block">{hint}</span>}
    </label>
  );
}

export function Divider() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <div className="flex-1 h-px bg-border"/> or continue with <div className="flex-1 h-px bg-border"/>
    </div>
  );
}

export function SocialBtn({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <button type="button" className="flex items-center justify-center gap-2 glass rounded-lg py-2.5 text-sm hover:ring-1 hover:ring-primary/40">
      <Icon className="h-4 w-4"/> {label}
    </button>
  );
}
