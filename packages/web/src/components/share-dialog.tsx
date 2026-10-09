import { useId, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useChatVisibility } from "@/hooks/use-chat-visibility";
import type { VisibilityType } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  isChatSaved,
  VisibilityUpdateError,
} from "@/services/visibility.service";
import { CheckCircleFillIcon, CopyIcon, ShareIcon } from "./icons";

const COPIED_FEEDBACK_MS = 2000;

const CHECKING_MESSAGE = "Even geduld. We kijken of dit gesprek al klaarstaat.";
const NOT_SAVED_MESSAGE = "Stel eerst een vraag. Daarna kunt u een link maken.";
const GENERIC_ERROR_MESSAGE =
  "Er ging iets mis met het delen van dit gesprek. Probeer het later opnieuw.";

/**
 * Reden waarom "Link maken" nog niet kan. Leeg zodra het wel kan: dan hoeft er
 * geen tekst te staan die de knop toch al uitlegt.
 */
function getBlockedReason(
  isChecking: boolean,
  isSaved: boolean | undefined
): string | null {
  if (isChecking) {
    return CHECKING_MESSAGE;
  }
  if (isSaved === false) {
    return NOT_SAVED_MESSAGE;
  }
  return null;
}

export function ShareDialog({
  chatId,
  initialVisibilityType,
  className,
}: {
  chatId: string;
  initialVisibilityType: VisibilityType;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  // Koppelt de uitleg aan de knop, zodat een schermlezer bij een uitgeschakelde
  // knop ook de reden voorleest.
  const shareStateId = useId();
  const linkId = useId();

  const { visibilityType, setVisibilityType } = useChatVisibility({
    chatId,
    initialVisibilityType,
  });

  const isPublic = visibilityType === "public";
  const shareUrl = `${window.location.origin}/chat/${chatId}`;

  // Een nieuw gesprek staat pas op de server zodra er een vraag is gesteld.
  // Zonder deze controle levert "Deel-link aanmaken" daar altijd een 404 op.
  const { data: isSaved, isLoading: isCheckingChat } = useSWR(
    open ? `share-dialog-chat-saved-${chatId}` : null,
    () => isChatSaved(chatId),
    { revalidateOnFocus: false }
  );

  const canCreateShareLink = isSaved === true && !isUpdating;
  const blockedReason = getBlockedReason(isCheckingChat, isSaved);

  const changeVisibility = async (nextVisibilityType: VisibilityType) => {
    setIsUpdating(true);

    try {
      await setVisibilityType(nextVisibilityType);
    } catch (error) {
      toast.error(
        error instanceof VisibilityUpdateError
          ? error.message
          : GENERIC_ERROR_MESSAGE
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link gekopieerd naar klembord");
      setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch {
      toast.error("Kopiëren mislukt");
    }
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button
          className={cn("h-8 px-2 md:h-fit", className)}
          data-testid="share-dialog-trigger"
          variant="outline"
        >
          <ShareIcon />
          <span>Delen</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Gesprek delen</DialogTitle>
          <DialogDescription>
            {isPublic
              ? "Er staat een link klaar. Iedereen die de link heeft, kan dit gesprek lezen."
              : "Maak een link waarmee u dit gesprek kunt laten lezen door iemand anders."}
          </DialogDescription>
        </DialogHeader>

        {isPublic ? (
          <>
            <div className="flex flex-col gap-2">
              <Label className="font-normal text-xs" htmlFor={linkId}>
                Link naar dit gesprek
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  className="flex-1 font-mono text-xs"
                  id={linkId}
                  onFocus={(event) => event.currentTarget.select()}
                  readOnly
                  value={shareUrl}
                />
                {/*
                  De kopieerknop krijgt de focus bij openen, niet het
                  invoerveld. Enter kopieert dan meteen, en de link wordt niet
                  meteen geselecteerd getoond. Vaste breedte, anders springt de
                  knop bij "Gekopieerd".
                */}
                <Button
                  autoFocus
                  className="w-36 shrink-0"
                  disabled={isUpdating}
                  onClick={handleCopy}
                  type="button"
                >
                  {copied ? <CheckCircleFillIcon /> : <CopyIcon />}
                  <span>{copied ? "Gekopieerd" : "Kopieer link"}</span>
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                Stuur de link alleen naar mensen die dit gesprek mogen lezen.
                Staan er persoonlijke gegevens in? Stop dan met delen.
              </p>
            </div>

            <DialogFooter className="border-border border-t pt-4">
              <Button
                disabled={isUpdating}
                onClick={() => changeVisibility("private")}
                type="button"
                variant="outline"
              >
                Stoppen met delen
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <p className="text-muted-foreground text-sm">
              Zodra u een link maakt, kan iedereen met die link het hele gesprek
              lezen. U kunt het delen op elk moment weer stoppen.
            </p>

            <DialogFooter className="border-border border-t pt-4">
              {blockedReason && (
                <p
                  aria-live="polite"
                  className="mr-auto self-center text-muted-foreground text-xs sm:text-left"
                  id={shareStateId}
                >
                  {blockedReason}
                </p>
              )}
              <Button
                aria-describedby={blockedReason ? shareStateId : undefined}
                data-testid="share-dialog-create-link"
                disabled={!canCreateShareLink}
                onClick={() => changeVisibility("public")}
                type="button"
              >
                <ShareIcon />
                <span>Link maken</span>
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
