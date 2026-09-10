import {
  Bot,
  Check,
  Compass,
  Handshake,
  Info,
  Lightbulb,
  ListChecks,
  Lock,
  type LucideIcon,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const platformPunten = [
  "eenvoudig zoeken binnen een breed en actueel aanbod van subsidies;",
  "regelingen vergelijken op bedragen, voorwaarden en deadlines;",
  "inzicht krijgen in voorwaarden, deadlines en aanvraagprocedures.",
];

const zoekTips = [
  "Wees specifiek in uw zoekopdracht voor betere resultaten.",
  "Noem details zoals doelgroep, thema en fase om gerichter te zoeken.",
  "Controleer altijd deadlines en vereisten tijdig.",
  "Gebruik de informatie als startpunt voor verdere verdieping en aanvraag.",
];

const partners = [
  { naam: "Gemeente Den Haag", rol: "programma Stadmaken" },
  { naam: "Haagse Hogeschool", rol: "HAAI" },
  { naam: "Draad", rol: "Open Stad" },
  { naam: "Fonds1818", rol: "FindNFund" },
  { naam: "PEP Den Haag", rol: "" },
];

const Sectie = ({
  icon: Icon,
  titel,
  children,
}: {
  icon: LucideIcon;
  titel: string;
  children: ReactNode;
}) => (
  <section className="space-y-3">
    <div className="flex items-center gap-2.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" strokeWidth={2} />
      </span>
      <h3 className="font-semibold text-[15px] text-foreground">{titel}</h3>
    </div>
    <div className="space-y-2 pl-[38px] text-muted-foreground leading-relaxed">
      {children}
    </div>
  </section>
);

const VinkLijst = ({ items }: { items: string[] }) => (
  <ul className="space-y-2">
    {items.map((item) => (
      <li className="flex items-start gap-2.5" key={item}>
        <Check
          className="mt-0.5 size-4 shrink-0 text-primary"
          strokeWidth={2.5}
        />
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

/**
 * Info-knop in de chat-header die een slide-over opent met de begintekst zoals
 * aangeleverd door de gemeente Den Haag: welkom, werkwijze, verwachtingen,
 * tips, disclaimer en betrokken partners. Aangevuld met uitleg over het
 * gebruik van AI, over privacy en opslag van gesprekken, en over de
 * beperkingen van de zoektool.
 * Bewust feitelijk en in gewone taal gehouden: dit is geen privacyverklaring.
 */
export const OverZoektool = () => (
  <Sheet>
    <SheetTrigger asChild>
      <Button
        className="h-8 gap-1.5 px-2 text-muted-foreground md:h-fit"
        size="sm"
        variant="ghost"
      >
        <Info className="size-4" strokeWidth={2} />
        <span className="sr-only md:not-sr-only">Over deze zoektool</span>
      </Button>
    </SheetTrigger>
    <SheetContent
      className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      side="right"
    >
      <SheetHeader className="border-b px-6 py-5 text-left">
        <div className="flex items-center gap-3">
          <img
            alt=""
            className="size-9 shrink-0"
            height={36}
            src="/images/Compact_Logo_gemeente_Den_Haag.svg"
            width={36}
          />
          <div className="space-y-0.5">
            <SheetTitle className="text-lg leading-tight">
              Welkom bij de AI-zoektool voor subsidie
            </SheetTitle>
            <SheetDescription>
              Onderdeel van het KID-platform van de gemeente Den Haag
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <ScrollArea className="flex-1">
        <div className="space-y-7 px-6 py-6 text-sm">
          <p className="text-[15px] text-foreground/90 leading-relaxed">
            Bent u op zoek naar een passende subsidie voor uw project,
            initiatief of organisatie? Het KID-platform helpt u met behulp van
            een AI-zoektool snel en gericht bij het vinden van
            subsidiemogelijkheden die aansluiten bij uw doelen.
          </p>

          <Sectie icon={ListChecks} titel="Op dit platform kunt u">
            <VinkLijst items={platformPunten} />
          </Sectie>

          <Sectie icon={Compass} titel="Hoe werkt het?">
            <p>
              U start door uw zoekvraag zo concreet mogelijk te formuleren. Denk
              hierbij aan het type project, de doelstelling, de doelgroep en de
              fase waarin uw initiatief zich bevindt. Op basis van uw
              beschrijving zoekt de assistent gericht; door aanvullende vragen
              te beantwoorden of uw vraag aan te scherpen verfijnt u het
              overzicht tot de meest relevante subsidieregelingen.
            </p>
          </Sectie>

          <Sectie icon={Bot} titel="Gebruik van AI">
            <p>
              De antwoorden worden geschreven door een taalmodel, oftewel AI.
              Het model zoekt eerst in de subsidieregelingen en documenten die
              in deze zoektool staan. Daarna stelt het een antwoord op met wat
              het daarin gevonden heeft.
            </p>
            <p>
              Het model mag alleen die bronnen gebruiken. Eigen kennis mag het
              er niet bij halen. Dat is het verschil met een gewone chatbot. Bij
              de resultaten staat waar een antwoord vandaan komt. Bij
              subsidieregelingen kunt u doorklikken naar de officiële bron.
            </p>
          </Sectie>

          <Sectie icon={Sparkles} titel="Wat kunt u verwachten?">
            <p>
              Het KID-platform biedt een eerste selectie en richting: het helpt
              u om snel kansrijke subsidies te identificeren. Het platform
              ondersteunt u bij het oriënteren, maar vervangt niet de formele
              subsidie-informatie van verstrekkers.
            </p>
            <p>
              Het KID-platform is een product in ontwikkeling. Dit betekent dat
              functionaliteiten en inhoud continu worden verbeterd en aangevuld
              op basis van gebruik en feedback.
            </p>
          </Sectie>

          <Sectie icon={Lightbulb} titel="Tips voor succesvol zoeken">
            <VinkLijst items={zoekTips} />
          </Sectie>

          <Sectie icon={Lock} titel="Privacy en uw gegevens">
            <p>
              De zoektool vraagt niet om persoonsgegevens. Naam, adres en andere
              gegevens over uzelf zijn dus niet nodig. Laat die informatie ook
              liever weg uit een vraag.
            </p>
            <p>
              Vraag en antwoord worden samen bewaard als gesprek, zodat u het
              later kunt terugvinden. De beheerders lezen niet zomaar mee. Geeft
              iemand een duimpje omhoog of omlaag? Dan zien zij die ene vraag en
              dat ene antwoord. Het hele gesprek zien zij alleen wanneer u in
              het feedbackvenster het vinkje aanzet om het gesprek te delen.
            </p>
            <p>
              U kunt een gesprek delen via een link. Iedereen met die link kan
              het gesprek lezen. Deel de link daarom alleen met mensen die het
              gesprek mogen zien.
            </p>
          </Sectie>

          <Sectie icon={ShieldCheck} titel="Disclaimer en beperkingen">
            <p>
              De getoonde subsidieregelingen en bijbehorende informatie zijn met
              zorg samengesteld, maar hieraan kunnen geen rechten worden
              ontleend. Subsidievoorwaarden, budgetten, deadlines en
              beschikbaarheid kunnen tussentijds wijzigen.
            </p>
            <p>
              De zoektool kan ook een regeling missen. Een antwoord is daardoor
              niet altijd volledig. Ziet u niet wat u zoekt? Stel uw vraag dan
              op een andere manier of met andere woorden.
            </p>
            <p>
              Controleer daarom altijd de meest actuele en volledige informatie
              bij de officiële bron of de subsidieverstrekker voordat u een
              aanvraag voorbereidt of indient. Het KID-platform is bedoeld als
              hulpmiddel en eerste selectie, niet als juridisch of bindend
              advies.
            </p>
          </Sectie>

          <Sectie icon={Handshake} titel="Samenwerking">
            <p>
              Het KID-platform is ontwikkeld door Bonsai in opdracht van de
              gemeente Den Haag. Het platform is tot stand gekomen in
              samenwerking met verschillende partners. Samen werken wij aan het
              verbeteren van de toegankelijkheid en vindbaarheid van
              subsidiemogelijkheden.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              {partners.map((partner) => (
                <li key={partner.naam}>
                  {partner.naam}
                  {partner.rol ? ` (${partner.rol})` : ""}
                </li>
              ))}
            </ul>
          </Sectie>
        </div>
      </ScrollArea>
    </SheetContent>
  </Sheet>
);
