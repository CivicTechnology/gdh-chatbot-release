import { motion } from "framer-motion";
import { FileText, Scale, Search } from "lucide-react";

const hulpPunten = [
  {
    icon: Search,
    text: "Ontdek welke subsidies bij uw plan of situatie passen",
  },
  {
    icon: Scale,
    text: "Vergelijk bedragen, voorwaarden en deadlines van regelingen",
  },
  {
    icon: FileText,
    text: "Krijg stap voor stap uitleg bij het aanvragen",
  },
];

export const Greeting = () => (
  <div
    className="mx-auto mt-8 flex size-full max-w-2xl flex-col items-center justify-center px-4 md:mt-16"
    key="overview"
  >
    <motion.div
      animate={{ opacity: 1 }}
      initial={{ opacity: 0 }}
      transition={{ delay: 0.2 }}
    >
      <img
        alt="Gemeente Den Haag"
        className="mb-6 size-12 md:size-14"
        height={56}
        src="/images/Compact_Logo_gemeente_Den_Haag.svg"
        width={56}
      />
    </motion.div>
    <motion.h1
      animate={{ opacity: 1, y: 0 }}
      className="text-center font-semibold text-2xl md:text-3xl"
      initial={{ opacity: 0, y: 10 }}
      transition={{ delay: 0.3 }}
    >
      Hoe kan ik u helpen?
    </motion.h1>
    <motion.p
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 max-w-md text-center text-muted-foreground text-sm md:text-base"
      initial={{ opacity: 0, y: 10 }}
      transition={{ delay: 0.4 }}
    >
      Stel uw vraag over de actuele subsidieregelingen van de gemeente Den Haag
    </motion.p>
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 w-full rounded-xl border border-border bg-muted/30 p-4 md:p-5"
      initial={{ opacity: 0, y: 10 }}
      transition={{ delay: 0.5 }}
    >
      <p className="text-foreground/90 text-sm leading-relaxed">
        Een subsidie is geld van de gemeente voor uw plan. Dat geld hoeft in
        principe niet terug. Er gelden wel voorwaarden. Achteraf laat u zien
        waar het geld aan is uitgegeven. Dat heet verantwoording. Klopt die
        niet, dan kan de gemeente het geld terugvragen.
      </p>
      <p className="mt-2 text-foreground/90 text-sm leading-relaxed">
        Heeft u een plan voor uw buurt, uw woning of uw organisatie? Dan kan de
        gemeente daar via een subsidieregeling aan meebetalen. Deze assistent
        helpt u op weg met de regelingen die op dit moment lopen:
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {hulpPunten.map(({ icon: Icon, text }) => (
          <li className="flex items-start gap-2.5" key={text}>
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/10">
              <Icon className="size-3 text-primary" strokeWidth={2} />
            </span>
            <span className="text-muted-foreground text-sm">{text}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 border-border border-t pt-3 text-muted-foreground text-xs">
        De antwoorden komen rechtstreeks uit de officiële subsidieregelingen en
        bekendmakingen van gemeente Den Haag, zoals gepubliceerd op overheid.nl.
      </p>
    </motion.div>
  </div>
);
