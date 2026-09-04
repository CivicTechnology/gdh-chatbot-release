import { LoaderIcon } from "@/components/icons";

import { Button } from "./ui/button";

export function SubmitButton({
  children,
  isSuccessful,
  isPending = false,
}: {
  children: React.ReactNode;
  isSuccessful: boolean;
  isPending?: boolean;
}) {
  const isLoading = isPending || isSuccessful;

  return (
    <Button
      aria-disabled={isLoading}
      className="relative"
      disabled={isLoading}
      type="submit"
    >
      {children}

      {isLoading && (
        <span className="absolute right-4 animate-spin">
          <LoaderIcon />
        </span>
      )}

      <output aria-live="polite" className="sr-only">
        {isLoading ? "Laden" : "Verzenden"}
      </output>
    </Button>
  );
}
