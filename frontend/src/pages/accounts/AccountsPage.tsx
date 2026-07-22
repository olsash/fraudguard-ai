import { FraudSelect } from "@/components/common/FraudSelect";
import { Topbar } from "@/components/layout/Topbar";
import { AUTH_USER_CHANGED_EVENT, authService, type AuthUser } from "@/services/authService";
import { bankingService } from "@/services/bankingService";
import type {
  Bank,
  BankAccount,
  ConnectBankAccountInput,
  DevelopmentSimulatedBankCredentials,
} from "@/types/banking";
import { formatCurrency } from "@/utils/formatters";
import { Building2, CreditCard, Loader2, Plus, X } from "lucide-react";
import { FormEvent, useEffect, useState, type InputHTMLAttributes } from "react";
import { toast } from "sonner";

const initialForm = {
  bankId: "",
  accountHolderName: "",
  accountNumber: "",
  iban: "",
  verificationCode: "",
};

type FormErrors = Partial<Record<keyof typeof initialForm, string>>;

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() =>
    authService.getCurrentUser(),
  );

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const handleUserChanged = (event: Event) => {
      const user = (event as CustomEvent<AuthUser | null>).detail ?? authService.getCurrentUser();
      setCurrentUser(user);
      setForm(createInitialForm(user));
      setFormErrors({});
      setSubmitError(null);
      setShowDialog(false);
    };

    window.addEventListener(AUTH_USER_CHANGED_EVENT, handleUserChanged);
    return () => window.removeEventListener(AUTH_USER_CHANGED_EVENT, handleUserChanged);
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [accountRows, bankRows] = await Promise.all([
        bankingService.getAccounts(),
        bankingService.getBanks(),
      ]);
      setAccounts(accountRows);
      setBanks(bankRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load bank accounts.");
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateForm(form);
    setFormErrors(validation.errors);
    setSubmitError(null);

    if (validation.firstInvalid) {
      focusField(validation.firstInvalid);
      return;
    }

    const payload: ConnectBankAccountInput = {
      bankId: Number(form.bankId),
      accountHolderName: form.accountHolderName.trim(),
      accountNumber: normalizeAccountNumber(form.accountNumber),
      iban: normalizeIban(form.iban),
      verificationCode: form.verificationCode,
    };

    setSaving(true);
    setError(null);
    try {
      await bankingService.connectAccount(payload);
      toast.success("Bank account connected successfully.");
      setShowDialog(false);
      setForm(createInitialForm(currentUser));
      setFormErrors({});
      setSubmitError(null);
      await load();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Unable to connect bank account.");
      setForm((current) => ({ ...current, verificationCode: "" }));
    } finally {
      setSaving(false);
    }
  }

  const canConnectMore = accounts.filter((account) => account.isActive).length < 3;

  return (
    <>
      <Topbar
        title="My Accounts"
        subtitle="Simulated banking verification, no live banking systems"
      />
      <main className="flex-1 p-4 md:p-8 space-y-4">
        {loading && (
          <StatePanel title="Loading accounts" message="Fetching your simulated bank accounts." />
        )}
        {!loading && error && (
          <StatePanel title="Accounts unavailable" message={error} destructive />
        )}
        {!loading && !error && accounts.length === 0 && (
          <EmptyState onConnect={() => openConnectDialog(currentUser, setForm, setShowDialog)} />
        )}
        {!loading && !error && accounts.length > 0 && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                This academic environment simulates bank verification and does not connect to live
                banking systems.
              </p>
              {canConnectMore ? (
                <button
                  onClick={() => openConnectDialog(currentUser, setForm, setShowDialog)}
                  className="bg-gradient-primary text-primary-foreground rounded-lg px-4 py-2 text-sm flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" /> Connect Another Bank Account
                </button>
              ) : (
                <p className="rounded-lg bg-secondary px-4 py-2 text-sm text-muted-foreground">
                  You have reached the maximum of 3 connected accounts.
                </p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {accounts.map((account) => (
                <div key={account.id} className="glass rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15 text-primary">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <span
                      className={`rounded-md px-2 py-1 text-[10px] uppercase tracking-wider ${account.isActive ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}
                    >
                      {account.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="mt-4 font-display font-semibold">{account.bankName}</p>
                  <p className="text-sm font-medium">{account.accountHolderName}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatAccountType(account.accountType)}
                  </p>
                  <div className="mt-4 space-y-2 text-sm">
                    <Row label="Account" value={account.maskedAccountNumber} />
                    <Row label="IBAN" value={account.maskedIban} />
                    <Row label="Currency" value={account.currency} />
                  </div>
                  <div className="mt-5 rounded-xl border border-border/60 bg-background/30 p-4">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Current balance
                    </p>
                    <p className="mt-1 font-mono text-2xl font-semibold">
                      {formatCurrency(account.currentBalance, account.currency)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
      {showDialog && (
        <ConnectAccountDialog
          banks={banks}
          form={form}
          errors={formErrors}
          submitError={submitError}
          saving={saving}
          onChange={(nextForm) => {
            setForm(nextForm);
            setFormErrors((current) => clearResolvedErrors(nextForm, current));
            setSubmitError(null);
          }}
          onSubmit={submit}
          onClose={() => {
            if (!saving) {
              setForm(createInitialForm(currentUser));
              setFormErrors({});
              setSubmitError(null);
              setShowDialog(false);
            }
          }}
        />
      )}
    </>
  );
}

function EmptyState({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="glass rounded-2xl p-10 text-center">
      <Building2 className="mx-auto h-10 w-10 text-primary" />
      <h2 className="mt-4 font-display text-xl font-semibold">No bank accounts connected</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
        Connect one of your simulated banking accounts to start analysing transactions.
      </p>
      <p className="mx-auto mt-3 max-w-xl text-xs text-muted-foreground">
        This academic environment simulates bank verification and does not connect to live banking
        systems.
      </p>
      <button
        onClick={onConnect}
        className="mx-auto mt-6 bg-gradient-primary text-primary-foreground rounded-lg px-4 py-2 text-sm flex items-center gap-2"
      >
        <Plus className="h-4 w-4" /> Connect Bank Account
      </button>
    </div>
  );
}

function ConnectAccountDialog({
  banks,
  form,
  errors,
  submitError,
  saving,
  onChange,
  onSubmit,
  onClose,
}: {
  banks: Bank[];
  form: typeof initialForm;
  errors: FormErrors;
  submitError: string | null;
  saving: boolean;
  onChange: (form: typeof initialForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const update = (key: keyof typeof initialForm, value: string) =>
    onChange({ ...form, [key]: value });
  const updateBank = (value: string) => {
    onChange({
      ...form,
      bankId: value,
      accountNumber: "",
      iban: "",
      verificationCode: "",
    });
    setCredentials(null);
    setCredentialsError(null);
    setShowTestCredentials(false);
  };
  const [showTestCredentials, setShowTestCredentials] = useState(false);
  const selectedBankId = Number(form.bankId);
  const [credentials, setCredentials] = useState<DevelopmentSimulatedBankCredentials | null>(null);
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [credentialsError, setCredentialsError] = useState<string | null>(null);

  async function loadCredentials() {
    if (!Number.isInteger(selectedBankId) || selectedBankId <= 0) {
      setCredentialsError("Select a banking institution first.");
      return;
    }

    setShowTestCredentials(true);
    setCredentialsLoading(true);
    setCredentialsError(null);
    try {
      const result = await bankingService.getDevelopmentSimulatedCredentials(selectedBankId);
      setCredentials(result);
    } catch (err) {
      setCredentials(null);
      setCredentialsError(
        err instanceof Error ? err.message : "Unable to load development test credentials.",
      );
    } finally {
      setCredentialsLoading(false);
    }
  }

  function fillCredentials() {
    if (
      !credentials ||
      credentials.isAlreadyLinked ||
      !credentials.accountNumber ||
      !credentials.iban ||
      !credentials.verificationCode
    ) {
      return;
    }

    onChange({
      ...form,
      bankId: String(credentials.bankId),
      accountHolderName: credentials.accountHolderName,
      accountNumber: credentials.accountNumber,
      iban: credentials.iban,
      verificationCode: credentials.verificationCode,
    });
  }

  const accountAlreadyLinked = credentials?.isAlreadyLinked === true;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/60 p-2 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <div
        className="glass-strong relative flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl shadow-2xl sm:max-w-xl"
        style={{ maxHeight: "calc(100dvh - 2rem)" }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-bank-account-title"
        aria-describedby="connect-bank-account-description"
      >
        <div className="shrink-0 border-b border-border/70 px-4 py-4 pr-12 sm:px-6">
          <div>
            <p id="connect-bank-account-title" className="font-display text-lg font-semibold">
              Connect Bank Account
            </p>
            <p id="connect-bank-account-description" className="text-xs text-muted-foreground">
              Verify a seeded simulated account. No live bank systems are contacted.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </div>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div
            data-connect-bank-scroll
            className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6"
          >
            <div className="space-y-4">
              <label className="block">
                <span className="text-xs text-muted-foreground">Bank</span>
                <div className="mt-1">
                  <FraudSelect
                    value={form.bankId}
                    onValueChange={updateBank}
                    options={banks.map((bank) => ({
                      value: String(bank.id),
                      label: `${bank.name} - ${bank.country}`,
                    }))}
                    placeholder="Select a banking institution"
                    ariaLabel="Bank"
                    triggerClassName="min-h-10 w-full px-3 py-2.5 text-sm"
                  />
                </div>
                {errors.bankId && <FieldError message={errors.bankId} />}
              </label>
              <Field
                fieldName="accountHolderName"
                label="Account holder name"
                value={form.accountHolderName}
                onChange={(value) => update("accountHolderName", value)}
                placeholder="Current user name"
                error={errors.accountHolderName}
                maxLength={150}
                readOnly
              />
              <Field
                fieldName="accountNumber"
                label="Account number"
                value={form.accountNumber}
                onChange={(value) => update("accountNumber", value.toUpperCase())}
                placeholder="1000 123456"
                error={errors.accountNumber}
                mono
              />
              <Field
                fieldName="iban"
                label="IBAN"
                value={form.iban}
                onChange={(value) => update("iban", value.toUpperCase())}
                placeholder="XK05 1234 5678 9012 3456"
                error={errors.iban}
                mono
              />
              <Field
                fieldName="verificationCode"
                label="Verification code"
                value={form.verificationCode}
                onChange={(value) => update("verificationCode", value.slice(0, 6))}
                placeholder="6 digits"
                type="password"
                inputMode="numeric"
                error={errors.verificationCode}
                maxLength={6}
                mono
              />
              {import.meta.env.DEV && (
                <div className="rounded-xl border border-border/60 bg-background/30 p-3">
                  <button
                    type="button"
                    onClick={
                      showTestCredentials ? () => setShowTestCredentials(false) : loadCredentials
                    }
                    disabled={!form.bankId || credentialsLoading}
                    className="text-xs font-medium text-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {showTestCredentials
                      ? "Hide test credentials"
                      : credentialsLoading
                        ? "Loading test credentials..."
                        : "Show Test Credentials"}
                  </button>
                  {showTestCredentials && (
                    <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                      <p>Test credentials for selected bank. Local development only.</p>
                      {credentialsLoading && <p>Loading credentials...</p>}
                      {credentialsError && <p className="text-destructive">{credentialsError}</p>}
                      {credentials && (
                        <div className="grid gap-1">
                          <CredentialRow label="Bank" value={credentials.bankName} />
                          <CredentialRow label="Holder" value={credentials.accountHolderName} />
                          {credentials.isAlreadyLinked ? (
                            <p className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-primary">
                              This simulated bank account is already connected to your profile.
                            </p>
                          ) : (
                            <>
                              <CredentialRow
                                label="Account"
                                value={credentials.accountNumber ?? ""}
                                mono
                              />
                              <CredentialRow label="IBAN" value={credentials.iban ?? ""} mono />
                              <CredentialRow
                                label="Code"
                                value={credentials.verificationCode ?? ""}
                                mono
                              />
                            </>
                          )}
                          <CredentialRow
                            label="Type"
                            value={formatAccountType(credentials.accountType)}
                          />
                          <CredentialRow label="Currency" value={credentials.currency} />
                          <CredentialRow
                            label="Balance"
                            value={formatCurrency(credentials.currentBalance, credentials.currency)}
                          />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={fillCredentials}
                        disabled={!credentials || credentials.isAlreadyLinked}
                        className="glass rounded-lg px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Fill Test Credentials
                      </button>
                    </div>
                  )}
                </div>
              )}
              {submitError && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {submitError}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                This academic environment simulates bank verification and does not connect to live
                banking systems.
              </p>
            </div>
          </div>
          <div className="shrink-0 border-t border-border/70 bg-card/95 px-4 py-3 backdrop-blur-xl sm:px-6">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="glass w-full rounded-lg px-4 py-2 text-sm disabled:opacity-50 sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || accountAlreadyLinked}
                className="bg-gradient-primary text-primary-foreground w-full rounded-lg px-4 py-2 text-sm disabled:opacity-60 sm:w-auto"
              >
                {saving ? "Connecting..." : "Connect Bank Account"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  fieldName,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  maxLength,
  inputMode,
  error,
  readOnly,
  mono,
}: {
  fieldName: keyof typeof initialForm;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  maxLength?: number;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  error?: string;
  readOnly?: boolean;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        name={fieldName}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        maxLength={maxLength}
        inputMode={inputMode}
        readOnly={readOnly}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${fieldName}-error` : undefined}
        placeholder={placeholder}
        className={`mt-1 w-full glass rounded-lg bg-transparent px-3 py-2.5 text-sm outline-none focus:ring-1 ${error ? "ring-1 ring-destructive/50 focus:ring-destructive/70" : "focus:ring-primary/60"} ${readOnly ? "cursor-not-allowed text-muted-foreground" : ""} ${mono ? "font-mono" : ""}`}
      />
      {error && <FieldError id={`${fieldName}-error`} message={error} />}
    </label>
  );
}

function CredentialRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0">{label}</span>
      <span className={`min-w-0 break-all text-right ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function FieldError({ message, id }: { message: string; id?: string }) {
  return (
    <p id={id} className="mt-1 text-xs text-destructive">
      {message}
    </p>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function StatePanel({
  title,
  message,
  destructive,
}: {
  title: string;
  message: string;
  destructive?: boolean;
}) {
  return (
    <div
      className={`glass rounded-2xl p-10 text-center ${destructive ? "ring-1 ring-destructive/40" : ""}`}
    >
      {destructive ? (
        <Building2 className="mx-auto h-10 w-10 text-destructive" />
      ) : (
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
      )}
      <h2 className="mt-4 font-display text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function formatAccountType(value: string) {
  return value.endsWith("Account") ? value : `${value} Account`;
}

function normalizeAccountNumber(value: string) {
  return value.trim().replace(/[ -]/g, "").toUpperCase();
}

function normalizeIban(value: string) {
  return value.trim().replace(/[ -]/g, "").toUpperCase();
}

function validateForm(form: typeof initialForm): {
  errors: FormErrors;
  firstInvalid?: keyof typeof initialForm;
} {
  const errors: FormErrors = {};
  const bankId = Number(form.bankId);
  const accountNumber = normalizeAccountNumber(form.accountNumber);
  const iban = normalizeIban(form.iban);

  if (!Number.isInteger(bankId) || bankId <= 0) {
    errors.bankId = "Select a banking institution.";
  }

  if (!/^[A-Za-z][A-Za-z .'-]{1,149}$/.test(form.accountHolderName.trim())) {
    errors.accountHolderName = "Enter the account holder name.";
  }

  if (!/^[A-Z0-9]{8,20}$/.test(accountNumber)) {
    errors.accountNumber = "Enter a valid simulated account number.";
  }

  if (!/^XK05[A-Z0-9]{14,20}$/.test(iban)) {
    errors.iban = "Enter a valid simulated IBAN.";
  }

  if (!/^\d{6}$/.test(form.verificationCode)) {
    errors.verificationCode = "Enter the 6-digit verification code.";
  }

  const firstInvalid = (
    ["bankId", "accountHolderName", "accountNumber", "iban", "verificationCode"] as Array<
      keyof typeof initialForm
    >
  ).find((field) => errors[field]);

  return { errors, firstInvalid };
}

function clearResolvedErrors(form: typeof initialForm, current: FormErrors): FormErrors {
  if (Object.keys(current).length === 0) {
    return current;
  }

  const next = { ...current };
  const validation = validateForm(form).errors;

  (Object.keys(next) as Array<keyof typeof initialForm>).forEach((field) => {
    if (!validation[field]) {
      delete next[field];
    }
  });

  return next;
}

function focusField(field: keyof typeof initialForm) {
  const selector = field === "bankId" ? "[aria-label='Bank']" : `[name='${field}']`;
  window.requestAnimationFrame(() => {
    const target = document.querySelector<HTMLElement>(selector);
    if (!target) {
      return;
    }

    target.scrollIntoView({ block: "center", behavior: "smooth" });
    target.focus({ preventScroll: true });
  });
}

function createInitialForm(user: AuthUser | null) {
  return {
    ...initialForm,
    accountHolderName: user?.name ?? "",
  };
}

function openConnectDialog(
  user: AuthUser | null,
  setForm: (form: typeof initialForm) => void,
  setShowDialog: (show: boolean) => void,
) {
  setForm(createInitialForm(user));
  setShowDialog(true);
}
