import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";
import { AuthForm } from "@/components/auth-form";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, isAuthenticated, isAnonymous } = useAuth();

  const [email, setEmail] = useState("");
  const [isSuccessful, setIsSuccessful] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already logged in as non-guest
  useEffect(() => {
    if (isAuthenticated && !isAnonymous) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, isAnonymous, navigate]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const emailValue = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!(emailValue && password)) {
      toast({
        type: "error",
        description: "Vul alle velden in",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        type: "error",
        description: "Wachtwoord moet minimaal 6 tekens bevatten",
      });
      return;
    }

    setEmail(emailValue);
    setIsSubmitting(true);

    const result = await register(emailValue, password);

    setIsSubmitting(false);

    if (result.success) {
      setIsSuccessful(true);
      toast({
        type: "success",
        description: "Account succesvol aangemaakt!",
      });
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 500);
    } else {
      toast({
        type: "error",
        description: result.error || "Account aanmaken mislukt!",
      });
    }
  };

  return (
    <div className="flex h-dvh w-screen items-start justify-center bg-background pt-12 md:items-center md:pt-0">
      <div className="flex w-full max-w-sm flex-col gap-8 px-4">
        <div className="flex flex-col items-center gap-6 text-center">
          <img
            alt="Gemeente Den Haag"
            className="size-12"
            height={48}
            src="/images/Compact_Logo_gemeente_Den_Haag.svg"
            width={48}
          />
          <div className="flex flex-col gap-1">
            <h1 className="font-semibold text-xl">Registreren</h1>
            <p className="text-muted-foreground text-sm">
              KID-platform - Gemeente Den Haag
            </p>
          </div>
        </div>
        <AuthForm defaultEmail={email} onSubmit={handleSubmit}>
          <SubmitButton isPending={isSubmitting} isSuccessful={isSuccessful}>
            Registreren
          </SubmitButton>
          <p className="mt-4 text-center text-muted-foreground text-sm">
            {"Al een account? "}
            <Link className="text-primary hover:underline" to="/login">
              Inloggen
            </Link>
          </p>
        </AuthForm>
      </div>
    </div>
  );
}
