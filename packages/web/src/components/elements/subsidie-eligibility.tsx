import { DOORVERWIJZINGEN } from "@gdh-chatbot/shared/doorverwijzing";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
  Check,
  ChevronLeft,
  ExternalLink,
  HelpCircle,
  RotateCcw,
  X,
} from "lucide-react";
import { memo, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type Answer = "ja" | "nee" | "weet-niet";

type EligibilityQuestion = { id: string; vraag: string; voorwaarde: string };

type EligibleRegeling = {
  id: string;
  naam: string;
  maxBedragAanvrager: string | null;
  vervaldatum: string | null;
  bronUrl: string;
  vervangenDoor: { naam: string; bronUrl: string } | null;
};

export type SubsidieEligibilityOutput =
  | { notFound: true; suggestion: string }
  | { notFound: false; inactive: true; status: string; message: string }
  | {
      notFound: false;
      inactive: false;
      regeling: EligibleRegeling;
      questions: EligibilityQuestion[];
    };

type VerdictKind = "ja" | "misschien" | "nee";

const ANSWER_OPTIONS: { value: Answer; label: string }[] = [
  { value: "ja", label: "Ja" },
  { value: "nee", label: "Nee" },
  { value: "weet-niet", label: "Weet ik niet" },
];

const STEP_VARIANTS: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir < 0 ? -16 : 16 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir < 0 ? 16 : -16 }),
};

function formatBedrag(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const num = Number(value);
  if (Number.isNaN(num)) {
    return value;
  }
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(num);
}

/** Kleur van een stapbolletje: afgerond, huidige stap of nog te doen. */
function getStapKleur(index: number, currentStep: number): string {
  if (index < currentStep) {
    return "bg-foreground/70";
  }
  if (index === currentStep) {
    return "bg-foreground/40";
  }
  return "bg-border";
}

/** Verwijzing naar hulp buiten de gemeente, voor als een regeling doodloopt. */
function Doorverwijzing() {
  return (
    <div className="text-muted-foreground text-sm">
      <p>Hulp nodig bij uw plan?</p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {DOORVERWIJZINGEN.map((partij) => (
          <li key={partij.url}>
            <a
              className="inline-flex items-center gap-0.5 underline hover:text-foreground"
              href={partij.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              {partij.label} <ExternalLink className="size-3" />
            </a>{" "}
            <span>({partij.omschrijving})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Bronvermelding: link naar de officiële pagina van de regeling. */
function BronLink({ bronUrl }: { bronUrl: string }) {
  return (
    <a
      className="inline-flex items-center gap-0.5 text-muted-foreground text-xs underline hover:text-foreground"
      href={bronUrl}
      rel="noopener noreferrer"
      target="_blank"
    >
      Naar bron <ExternalLink className="size-3" />
    </a>
  );
}

type Props = {
  output: SubsidieEligibilityOutput;
  onBekijkDetails: (naam: string) => void;
  disabled?: boolean;
};

function SubsidieEligibilityInner({
  output,
  onBekijkDetails,
  disabled = false,
}: Props) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});

  const questions =
    output.notFound === false && output.inactive === false
      ? output.questions
      : [];

  const done = questions.length > 0 && step >= questions.length;

  const verdict: VerdictKind = useMemo(() => {
    if (questions.some((q) => answers[q.id] === "nee")) {
      return "nee";
    }
    if (questions.some((q) => answers[q.id] === "weet-niet")) {
      return "misschien";
    }
    return "ja";
  }, [questions, answers]);

  if (output.notFound) {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-muted-foreground text-sm">
          Deze regeling is niet meer beschikbaar.
        </p>
        <Doorverwijzing />
      </div>
    );
  }
  if (output.inactive) {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-muted-foreground text-sm">
          Deze regeling is niet (meer) actief.
        </p>
        <Doorverwijzing />
      </div>
    );
  }

  const { regeling } = output;

  const answer = (value: Answer) => {
    setAnswers((prev) => ({ ...prev, [questions[step].id]: value }));
    setDirection(1);
    setStep((s) => s + 1);
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-sidebar p-4">
      {regeling.vervangenDoor && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Let op: deze regeling is vervangen door{" "}
          <a
            className="underline"
            href={regeling.vervangenDoor.bronUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            {regeling.vervangenDoor.naam}
          </a>
        </p>
      )}

      <AnimatePresence custom={direction} initial={false} mode="wait">
        {done ? (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            initial={{ opacity: 0, y: 8 }}
            key="recap"
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <Recap
              answers={answers}
              bedrag={formatBedrag(regeling.maxBedragAanvrager)}
              disabled={disabled}
              onBekijkDetails={() => onBekijkDetails(regeling.naam)}
              onOpnieuw={() => {
                setDirection(-1);
                setAnswers({});
                setStep(0);
              }}
              questions={questions}
              verdict={verdict}
            />
          </motion.div>
        ) : (
          <motion.div
            animate="center"
            className="flex flex-col gap-3"
            custom={direction}
            exit="exit"
            initial="enter"
            key={`step-${step}`}
            transition={{ duration: 0.18, ease: "easeOut" }}
            variants={STEP_VARIANTS}
          >
            <p className="font-medium text-foreground">
              {questions[step].vraag}
            </p>
            <div className="flex flex-wrap gap-2">
              {ANSWER_OPTIONS.map((opt, i) => (
                <motion.button
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border border-border px-4 py-2 text-foreground text-sm transition-colors hover:bg-muted"
                  initial={{ opacity: 0, y: 6 }}
                  key={opt.value}
                  onClick={() => answer(opt.value)}
                  transition={{
                    duration: 0.18,
                    delay: 0.08 + i * 0.05,
                    ease: "easeOut",
                  }}
                  type="button"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                >
                  {opt.label}
                </motion.button>
              ))}
            </div>
            {step > 0 && (
              <button
                className="flex items-center gap-1 self-start text-muted-foreground text-xs hover:text-foreground"
                onClick={() => {
                  setDirection(-1);
                  setStep((s) => Math.max(0, s - 1));
                }}
                type="button"
              >
                <ChevronLeft className="size-3" /> Vorige
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {done ? null : (
        <div className="flex gap-1.5">
          {questions.map((q, i) => (
            <motion.span
              animate={{ scale: i === step ? 1.35 : 1 }}
              className={cn(
                "size-2 rounded-full transition-colors",
                getStapKleur(i, step)
              )}
              key={q.id}
              transition={{ duration: 0.2, ease: "easeOut" }}
            />
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 border-border/60 border-t pt-2.5">
        <BronLink bronUrl={regeling.bronUrl} />
      </div>
    </div>
  );
}

function Recap({
  questions,
  answers,
  verdict,
  bedrag,
  onOpnieuw,
  onBekijkDetails,
  disabled = false,
}: {
  questions: EligibilityQuestion[];
  answers: Record<string, Answer>;
  verdict: VerdictKind;
  bedrag: string | null;
  onOpnieuw: () => void;
  onBekijkDetails: () => void;
  disabled?: boolean;
}) {
  const banner = {
    ja: {
      cls: "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200",
      text: "U komt waarschijnlijk in aanmerking",
    },
    misschien: {
      cls: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
      text: "Mogelijk: controleer de punten die u met 'weet ik niet' beantwoordde",
    },
    nee: {
      cls: "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-200",
      text: "U voldoet (nog) niet aan alle voorwaarden",
    },
  }[verdict];

  const buttonsDelay = 0.12 + questions.length * 0.06 + 0.05;

  return (
    <div className="flex flex-col gap-3">
      <motion.div
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={cn("rounded-lg border px-3 py-2 text-sm", banner.cls)}
        initial={{ opacity: 0, scale: 0.96, y: 4 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <span className="font-medium">{banner.text}</span>
        {verdict === "ja" && bedrag ? (
          <span className="ml-1 font-normal">· max. {bedrag}</span>
        ) : null}
      </motion.div>

      <ul className="flex flex-col gap-1.5">
        {questions.map((q, i) => (
          <motion.li
            animate={{ opacity: 1, x: 0 }}
            className="flex items-start gap-2 text-sm"
            initial={{ opacity: 0, x: -8 }}
            key={q.id}
            transition={{
              duration: 0.2,
              delay: 0.12 + i * 0.06,
              ease: "easeOut",
            }}
          >
            <StatusIcon answer={answers[q.id]} />
            <span className="text-foreground">{q.vraag}</span>
          </motion.li>
        ))}
      </ul>

      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap gap-2"
        initial={{ opacity: 0, y: 6 }}
        transition={{ duration: 0.2, delay: buttonsDelay, ease: "easeOut" }}
      >
        <motion.button
          className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground"
          onClick={onOpnieuw}
          type="button"
          whileTap={{ scale: 0.96 }}
        >
          <RotateCcw className="size-3" /> Opnieuw
        </motion.button>
        <motion.button
          className="rounded-md border border-border px-2.5 py-1 text-foreground text-xs transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          disabled={disabled}
          onClick={onBekijkDetails}
          type="button"
          whileTap={disabled ? undefined : { scale: 0.96 }}
        >
          Bekijk details
        </motion.button>
      </motion.div>
    </div>
  );
}

function StatusIcon({ answer }: { answer: Answer | undefined }) {
  if (answer === "ja") {
    return (
      <Check className="mt-0.5 size-4 shrink-0 text-green-600 dark:text-green-400" />
    );
  }
  if (answer === "nee") {
    return (
      <X className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
    );
  }
  return (
    <HelpCircle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
  );
}

export const SubsidieEligibility = memo(SubsidieEligibilityInner);
