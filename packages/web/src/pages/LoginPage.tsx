import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { type AuthMethods, authApi } from "@/api/auth";
import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "password" | "mfa" | "enroll";

// Eén loginscherm voor het KID-platform. Alleen beheerders loggen in (gewone
// bezoekers chatten anoniem): primair via Entra SSO, met wachtwoord + TOTP-MFA
// als break-glass-fallback wanneer LOCAL_LOGIN_ENABLED aanstaat.
export default function LoginPage() {
  const navigate = useNavigate();
  const { user, refreshSession } = useAuth();
  const [methods, setMethods] = useState<AuthMethods | null>(null);
  const [step, setStep] = useState<Step>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingToken, setPendingToken] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user?.role === "beheerder") navigate("/admin", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    authApi.getMethods().then((r) => {
      if (r.data) setMethods(r.data);
    });
  }, []);

  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get("error");
    if (err === "geen_toegang")
      setError("Je account heeft geen beheerder-toegang.");
    else if (err === "sso")
      setError("Inloggen via Microsoft mislukt. Probeer opnieuw.");
  }, []);

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await authApi.login({ email, password });
    setBusy(false);
    const data = res.data as
      | { user: unknown }
      | { mfaRequired: true; mfaToken: string }
      | { enrollmentRequired: true; enrollToken: string }
      | undefined;
    if (res.error || !data) {
      setError(res.error ?? "Inloggen mislukt");
      return;
    }
    if ("mfaRequired" in data) {
      setPendingToken(data.mfaToken);
      setCode("");
      setStep("mfa");
      return;
    }
    if ("enrollmentRequired" in data) {
      setPendingToken(data.enrollToken);
      const enroll = await authApi.mfaEnrollStart(data.enrollToken);
      if (enroll.data) setQr(enroll.data.qrDataUrl);
      setCode("");
      setStep("enroll");
      return;
    }
    await refreshSession();
    navigate("/admin", { replace: true });
  };

  const handleMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await authApi.mfaVerify(pendingToken, code);
    setBusy(false);
    if (res.error || !res.data) {
      setError("Ongeldige code");
      return;
    }
    await refreshSession();
    navigate("/admin", { replace: true });
  };

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await authApi.mfaEnrollVerify(pendingToken, code);
    setBusy(false);
    if (res.error || !res.data) {
      setError("Ongeldige code");
      return;
    }
    setBackupCodes(res.data.backupCodes);
  };

  const finishEnroll = async () => {
    await refreshSession();
    navigate("/admin", { replace: true });
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-sm rounded-lg border bg-card p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img
            alt="Gemeente Den Haag"
            className="size-10"
            src="/images/Compact_Logo_gemeente_Den_Haag.svg"
          />
          <div>
            <h1 className="font-semibold text-lg">Beheerportaal</h1>
            <p className="text-muted-foreground text-xs">
              Subsidieregelingen Den Haag
            </p>
          </div>
        </div>

        {backupCodes ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm">
              Bewaar deze backupcodes op een veilige plek. Elke code werkt
              eenmalig.
            </p>
            <ul className="grid grid-cols-2 gap-2 rounded-md border bg-muted/40 p-3 font-mono text-sm">
              {backupCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <Button onClick={finishEnroll} type="button">
              Doorgaan naar beheerportaal
            </Button>
          </div>
        ) : step === "password" ? (
          methods === null ? (
            <div className="flex justify-center py-6 text-muted-foreground text-sm">
              Laden...
            </div>
          ) : (
            <form className="flex flex-col gap-4" onSubmit={handlePassword}>
              {methods.entra ? (
                <>
                  <Button
                    className="w-full"
                    onClick={() => {
                      window.location.href = "/api/auth/entra/login";
                    }}
                    type="button"
                  >
                    Inloggen met Microsoft
                  </Button>
                  {methods.local ? (
                    <div className="text-center text-muted-foreground text-xs">
                      of met e-mail
                    </div>
                  ) : null}
                </>
              ) : null}
              {methods.local ? (
                <>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      autoComplete="email"
                      id="email"
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      type="email"
                      value={email}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="password">Wachtwoord</Label>
                    <Input
                      autoComplete="current-password"
                      id="password"
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      type="password"
                      value={password}
                    />
                  </div>
                  <Button disabled={busy} type="submit">
                    {busy ? "Inloggen..." : "Inloggen"}
                  </Button>
                </>
              ) : null}
              {error ? (
                <p className="text-destructive text-sm">{error}</p>
              ) : null}
            </form>
          )
        ) : step === "enroll" ? (
          <form className="flex flex-col gap-4" onSubmit={handleEnroll}>
            <p className="text-sm">
              Scan de QR-code met je authenticator-app en voer de 6-cijferige
              code in.
            </p>
            {qr ? (
              <img alt="MFA QR-code" className="mx-auto size-44" src={qr} />
            ) : null}
            <div className="flex flex-col gap-2">
              <Label htmlFor="code">Verificatiecode</Label>
              <Input
                autoComplete="one-time-code"
                id="code"
                inputMode="numeric"
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                required
                value={code}
              />
            </div>
            <Button disabled={busy} type="submit">
              {busy ? "Controleren..." : "Activeren"}
            </Button>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
          </form>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={handleMfa}>
            <p className="text-sm">
              Voer de 6-cijferige code uit je authenticator-app in, of een
              backupcode.
            </p>
            <div className="flex flex-col gap-2">
              <Label htmlFor="code">Code of backupcode</Label>
              <Input
                autoComplete="one-time-code"
                id="code"
                inputMode="text"
                onChange={(e) => setCode(e.target.value)}
                placeholder="Code of backupcode"
                required
                value={code}
              />
            </div>
            <Button disabled={busy} type="submit">
              {busy ? "Controleren..." : "Verifiëren"}
            </Button>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
          </form>
        )}
      </div>
    </div>
  );
}
