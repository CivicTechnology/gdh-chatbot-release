import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const MAX_COMMENT_LENGTH = 1000;

export type FeedbackDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rating: "up" | "down";
  defaultComment: string;
  defaultChatShared: boolean;
  onSubmit: (input: { comment: string; chatShared: boolean }) => Promise<void>;
};

/**
 * Vervolg-dialog na een duim-klik: optionele toelichting en de keuze om het
 * volledige gesprek met beheerders te delen. Zonder delen zien beheerders
 * alleen de vraag en het beoordeelde antwoord.
 */
export function FeedbackDialog({
  open,
  onOpenChange,
  rating,
  defaultComment,
  defaultChatShared,
  onSubmit,
}: FeedbackDialogProps) {
  const [comment, setComment] = useState(defaultComment);
  const [chatShared, setChatShared] = useState(defaultChatShared);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const commentId = useId();
  const sharedId = useId();

  // Reset het formulier naar de opgeslagen waarden telkens als de dialog
  // opnieuw opent (bv. na een tweede duim-klik op hetzelfde bericht).
  useEffect(() => {
    if (open) {
      setComment(defaultComment);
      setChatShared(defaultChatShared);
    }
  }, [open, defaultComment, defaultChatShared]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit({ comment: comment.trim(), chatShared });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent data-testid="feedback-dialog">
        <DialogHeader>
          <DialogTitle>
            {rating === "up"
              ? "Fijn dat dit antwoord hielp!"
              : "Vervelend dat dit antwoord niet hielp"}
          </DialogTitle>
          <DialogDescription>
            De beoordeling is opgeslagen. Wilt u nog kort toelichten waarom? Dat
            helpt ons de zoektool te verbeteren.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={commentId}>Toelichting (optioneel)</Label>
            <Textarea
              className="min-h-24 resize-none"
              id={commentId}
              maxLength={MAX_COMMENT_LENGTH}
              onChange={(event) => setComment(event.target.value)}
              placeholder={
                rating === "up"
                  ? "Wat was er goed aan dit antwoord?"
                  : "Wat klopte er niet, of wat ontbrak?"
              }
              value={comment}
            />
          </div>

          <div className="flex items-start gap-2.5">
            <Checkbox
              checked={chatShared}
              className="mt-0.5"
              id={sharedId}
              onCheckedChange={(checked) => setChatShared(checked === true)}
            />
            <div className="flex flex-col gap-1">
              <Label className="font-normal" htmlFor={sharedId}>
                Deel dit volledige gesprek met de beheerders
              </Label>
              <p className="text-muted-foreground text-xs">
                Zonder delen zien beheerders alleen de vraag en het beoordeelde
                antwoord.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="ghost"
          >
            Overslaan
          </Button>
          <Button
            data-testid="feedback-dialog-submit"
            disabled={isSubmitting}
            onClick={handleSubmit}
            type="button"
          >
            {isSubmitting ? "Versturen..." : "Feedback versturen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
