import { createFileRoute, Link } from "@tanstack/react-router";
import { Brand } from "@/components/brand";
import { useState } from "react";
import { Eye, EyeOff, Github, Mail } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  const [show, setShow] = useState(false);
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your SentinelAI workspace">
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <Field label="Email" type="email" placeholder="you@bank.io"/>
        <div>
          <Field label="Password" type={show ? "text" : "password"} placeholder="••••••••"
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
        <Link to="/app" className="block text-center bg-gradient-primary text-primary-foreground rounded-lg py-3 font-medium ring-glow">
          Sign in
        </Link>
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
            <p className="text-sm">"SentinelAI cut our chargeback rate by 71% in three months."</p>
            <p className="mt-3 text-xs text-muted-foreground">— Maya Lindgren · Head of Risk, NORDBANK</p>
          </div>
        </div>
        <p className="relative text-xs text-muted-foreground">© 2026 SentinelAI Research</p>
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

export function Field({
  label, type = "text", placeholder, rightIcon, hint,
}: { label: string; type?: string; placeholder?: string; rightIcon?: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="mt-1 flex items-center glass rounded-lg px-3 py-2.5 focus-within:ring-1 focus-within:ring-primary/60">
        <input type={type} placeholder={placeholder} className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"/>
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
