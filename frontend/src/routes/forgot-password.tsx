import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthShell, Field } from "./login";

export const Route = createFileRoute("/forgot-password")({
  component: Forgot,
});

function Forgot() {
  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a secure recovery link">
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <Field label="Email" type="email" placeholder="you@bank.io"/>
        <button className="w-full bg-gradient-primary text-primary-foreground rounded-lg py-3 font-medium ring-glow">Send reset link</button>
        <p className="text-center text-sm text-muted-foreground">
          Remembered it? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </form>
    </AuthShell>
  );
}
