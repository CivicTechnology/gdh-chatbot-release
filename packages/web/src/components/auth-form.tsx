import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function AuthForm({
  onSubmit,
  children,
  defaultEmail = "",
}: {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
  children: React.ReactNode;
  defaultEmail?: string;
}) {
  return (
    <form className="flex flex-col gap-4 px-4 sm:px-16" onSubmit={onSubmit}>
      <div className="flex flex-col gap-2">
        <Label className="font-normal text-muted-foreground" htmlFor="email">
          E-mailadres
        </Label>

        <Input
          autoComplete="email"
          autoFocus
          className="bg-muted text-md md:text-sm"
          defaultValue={defaultEmail}
          id="email"
          name="email"
          placeholder="gebruiker@voorbeeld.nl"
          required
          type="email"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label className="font-normal text-muted-foreground" htmlFor="password">
          Wachtwoord
        </Label>

        <Input
          className="bg-muted text-md md:text-sm"
          id="password"
          name="password"
          required
          type="password"
        />
      </div>

      {children}
    </form>
  );
}
