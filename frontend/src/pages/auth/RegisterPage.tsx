import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { AuthShell, Field, Divider, SocialBtn } from "@/pages/auth/LoginPage";
import { Github, Mail, Check } from "lucide-react";

export default function Register() {
  const [pwd, setPwd] = useState("");
  const score = scorePwd(pwd);
  return (
    <AuthShell title="Create your account" subtitle="Start detecting fraud in under 2 minutes">
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" placeholder="Sara"/>
          <Field label="Last name" placeholder="Amrani"/>
        </div>
        <Field label="Work email" type="email" placeholder="you@bank.io"/>
        <label className="block">
          <span className="text-xs text-muted-foreground">Password</span>
          <div className="mt-1 flex items-center glass rounded-lg px-3 py-2.5">
            <input type="password" value={pwd} onChange={(e)=>setPwd(e.target.value)} placeholder="••••••••" className="flex-1 bg-transparent text-sm outline-none"/>
          </div>
          <div className="mt-2 flex gap-1">
            {[0,1,2,3].map(i => (
              <div key={i} className={`h-1 flex-1 rounded-full ${i < score ? (score>=3?"bg-success":score===2?"bg-warning":"bg-destructive") : "bg-secondary"}`}/>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Use 8+ chars with letters, numbers & symbols.</p>
        </label>
        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input type="checkbox" className="mt-0.5 accent-primary"/>
          I agree to the Terms of Service and Privacy Policy.
        </label>
        <Link to="/app" className="block text-center bg-gradient-primary text-primary-foreground rounded-lg py-3 font-medium ring-glow">
          Create account
        </Link>
        <Divider/>
        <div className="grid grid-cols-2 gap-2">
          <SocialBtn icon={Github} label="GitHub"/>
          <SocialBtn icon={Mail} label="Google"/>
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