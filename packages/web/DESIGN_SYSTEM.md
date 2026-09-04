# GDH Chatbot Design System

**UI Constitution v1.0**

---

## 1. Thema + Visuele Richting

### Stijlrichting: Clean Civic Modern

Een visuele taal die vertrouwen, toegankelijkheid en professionaliteit uitstraalt — passend bij een overheidsorganisatie die moderne digitale dienstverlening levert.

### Waarom deze richting?

| Aspect | Rationale |
|--------|-----------|
| Vertrouwen | Overheidscommunicatie vereist serieuze, betrouwbare uitstraling. Geen speelse elementen, geen afleidende decoratie. |
| Toegankelijkheid | Burgers van alle leeftijden en digitale vaardigheidsniveaus moeten de interface kunnen gebruiken. Hoge contrast, duidelijke hiërarchie. |
| Efficiëntie | Chat-interface moet informatie snel en scanbaar presenteren. Geen visuele ruis. |
| Moderniteit | Den Haag als moderne stad; de interface moet actueel aanvoelen zonder trendy te zijn. |

### Kleurprincipes

**Principe 1: Groen is actie, niet decoratie**
- Primary green (`#046a38`) wordt ALLEEN gebruikt voor:
  - Primaire call-to-action buttons
  - Links in lopende tekst
  - Actieve/geselecteerde states
  - Focus indicators
- NOOIT voor: achtergronden, decoratieve elementen, headers

**Principe 2: Neutral domineert**
- 90% van de interface is neutraal (grijs/wit)
- Kleur wordt spaarzaam ingezet om betekenis te geven
- Hoe meer kleur, hoe minder impact

**Principe 3: Semantische kleuren zijn heilig**
- Rood = alleen destructief/error
- Groen = alleen success/primary action
- Amber/geel = alleen warning
- Blauw = alleen informational

**Principe 4: Dark mode is geen inversie**
- Dark mode heeft eigen geoptimaliseerde waarden
- Primary green wordt lichter (`#34d399`) voor contrast
- Backgrounds zijn niet puur zwart maar warm donkergrijs

### Contrast & Emphasis Logica

```
Niveau 1 (Hoogste): Primary color + size increase
Niveau 2 (Hoog):    Foreground color + font-weight bold
Niveau 3 (Medium):  Foreground color + normal weight
Niveau 4 (Laag):    Muted-foreground color
Niveau 5 (Lowest):  Muted-foreground color + smaller size
```

### Elevation/Shadow Filosofie

**Principe: Elevation = Interactie-potentieel**

| Level | Shadow | Gebruik |
|-------|--------|---------|
| 0 | None | Statische content, inline elementen |
| 1 | `shadow-sm` | Cards, containers met afgebakende content |
| 2 | `shadow-md` | Hover states van interactieve cards |
| 3 | `shadow-lg` | Dropdowns, popovers, floating elements |
| 4 | `shadow-xl` | Modals, overlays |

**Regel**: Shadows worden NOOIT gebruikt voor decoratie. Een element krijgt alleen shadow als het:
1. Boven andere content "zweeft"
2. Interactief is en feedback nodig heeft
3. Tijdelijk is (modal, toast, dropdown)

---

## 2. Typografie-systeem

### Font Stack

```css
--font-sans: "Geist", system-ui, -apple-system, sans-serif;
--font-mono: "Geist Mono", ui-monospace, monospace;
```

**Waarom Geist?**
- Ontworpen voor interfaces (niet print)
- Uitstekende leesbaarheid op scherm
- Goede ondersteuning voor cijfers (tabular nums)
- Neutral, niet-afleidend karakter

### Type Scale

| Token | Size | Line-height | Gebruik |
|-------|------|-------------|---------|
| `text-xs` | 12px | 16px (1.33) | Captions, timestamps, hulptekst |
| `text-sm` | 14px | 20px (1.43) | Labels, secondary text, UI controls |
| `text-base` | 16px | 24px (1.5) | Body text, paragraphs, inputs |
| `text-lg` | 18px | 28px (1.56) | Emphasis in body, card titles |
| `text-xl` | 20px | 28px (1.4) | Section headings |
| `text-2xl` | 24px | 32px (1.33) | Page section titles |
| `text-3xl` | 30px | 36px (1.2) | Page headers |
| `text-4xl` | 36px | 40px (1.11) | Hero/landing alleen |

### Gebruiksregels

| Context | Size | Weight | Extra |
|---------|------|--------|-------|
| Chat message body | `text-base` | `font-normal` | - |
| Chat AI response | `text-base` | `font-normal` | prose styling |
| Button label | `text-sm` | `font-medium` | - |
| Input placeholder | `text-base` | `font-normal` | `text-muted-foreground` |
| Input label | `text-sm` | `font-medium` | - |
| Form error | `text-sm` | `font-normal` | `text-destructive` |
| Card title | `text-lg` | `font-semibold` | - |
| Card description | `text-sm` | `font-normal` | `text-muted-foreground` |
| Badge | `text-xs` | `font-semibold` | uppercase optioneel |
| Tooltip | `text-sm` | `font-normal` | - |
| Table header | `text-sm` | `font-medium` | - |
| Table cell | `text-sm` | `font-normal` | - |
| Numeric data | any | `font-mono` | `tabular-nums` |

### Font-weight Regels

| Weight | Token | Gebruik |
|--------|-------|---------|
| 400 | `font-normal` | Body text, descriptions, placeholders |
| 500 | `font-medium` | Labels, buttons, interactive text |
| 600 | `font-semibold` | Headings, titles, emphasis |
| 700 | `font-bold` | NOOIT gebruiken in UI (te zwaar) |

**Regel**: Gebruik NOOIT `font-bold` in de interface. `font-semibold` is het maximum.

### Letter-spacing Regels

| Context | Spacing |
|---------|---------|
| Body text | `tracking-normal` (0) |
| Headings | `tracking-tight` (-0.025em) |
| All-caps labels | `tracking-wide` (+0.025em) |
| Monospace | `tracking-normal` |

---

## 3. Spacing-systeem

### Base Unit: 4px

Alle spacing is een veelvoud van 4px. Dit zorgt voor:
- Consistente verticale ritme
- Makkelijke berekeningen
- Pixel-perfect alignment op alle schermen

### Spacing Tokens

| Token | Value | Tailwind | Gebruik |
|-------|-------|----------|---------|
| `--space-0` | 0px | `p-0` | Reset |
| `--space-1` | 4px | `p-1` | Inline icon spacing, tight gaps |
| `--space-2` | 8px | `p-2` | Button icon gap, compact padding |
| `--space-3` | 12px | `p-3` | Small card padding, list item padding |
| `--space-4` | 16px | `p-4` | Default card padding, section gaps |
| `--space-5` | 20px | `p-5` | Medium containers |
| `--space-6` | 24px | `p-6` | Large card padding, section padding |
| `--space-8` | 32px | `p-8` | Page section gaps |
| `--space-10` | 40px | `p-10` | Major section separation |
| `--space-12` | 48px | `p-12` | Page-level padding |
| `--space-16` | 64px | `p-16` | Hero sections alleen |

### Gebruiksregels per Context

| Context | Padding | Gap | Margin |
|---------|---------|-----|--------|
| Button | `px-4 py-2` (16/8) | `gap-2` (8) | - |
| Button sm | `px-3 py-1.5` (12/6) | `gap-1.5` (6) | - |
| Input | `px-3 py-2` (12/8) | - | - |
| Card | `p-4` of `p-6` | - | - |
| Card header | `p-6` | `space-y-1.5` | - |
| Card content | `p-6 pt-0` | - | - |
| Modal | `p-6` | `space-y-4` | - |
| List items | `px-3 py-2` | `gap-1` | - |
| Form fields | - | `space-y-4` | - |
| Form label→input | - | `space-y-2` | - |
| Page sections | - | `space-y-8` | - |
| Inline elements | - | `gap-2` | - |

### DO NOT Regels

```
VERBODEN:
- Arbitraire waarden (13px, 17px, 22px)
- Mix van 4px en 8px grid (kies één)
- Margin op componenten (gebruik gap op parent)
- Negatieve margins (behalve voor specifieke overlap-patterns)
- padding: 10px (niet in 4px grid)
- gap: 5px (niet in 4px grid)

VERPLICHT:
- Altijd Tailwind spacing tokens
- Altijd veelvouden van 4px
- Gap op parent, niet margin op children
```

---

## 4. Layout-regels

### Page Grid

```css
--max-width-content: 1280px;
--max-width-chat: 768px;
--gutter: 16px (mobile) / 24px (desktop);
```

| Breakpoint | Width | Columns | Gutter |
|------------|-------|---------|--------|
| Mobile (<640px) | 100% | 1 | 16px |
| Tablet (640-1024px) | 100% | 1-2 | 20px |
| Desktop (>1024px) | max 1280px | 12 | 24px |

### Chat Layout Specifiek

```
┌─────────────────────────────────────────┐
│ Header (fixed, h-14)                    │
├─────────────────────────────────────────┤
│                                         │
│   Messages (flex-1, overflow-auto)      │
│   max-width: 768px, mx-auto             │
│                                         │
├─────────────────────────────────────────┤
│ Input Area (sticky bottom)              │
│ max-width: 768px, mx-auto               │
└─────────────────────────────────────────┘
```

### Sectie-structuur

Elke pagina/sectie volgt dit patroon:

```
1. Header Zone
   - Titel (text-2xl/3xl)
   - Optioneel: description (text-muted-foreground)
   - Optioneel: actions (rechtsboven)
   - margin-bottom: space-6

2. Content Zone
   - Hoofdcontent
   - Cards/lists/forms
   - gap: space-4 tussen items

3. Actions Zone (indien nodig)
   - Sticky footer of inline
   - Primary action rechts
   - Secondary action links
   - gap: space-3 tussen buttons
```

### Density Levels

| Level | Padding | Gap | Gebruik |
|-------|---------|-----|---------|
| Compact | `p-2/p-3` | `gap-1/gap-2` | Data tables, lists, dense UI |
| Default | `p-4` | `gap-3/gap-4` | Cards, forms, general UI |
| Spacious | `p-6/p-8` | `gap-6` | Landing pages, empty states |

**Regel**: Chat interface = Compact/Default. Settings/forms = Default. Marketing = Spacious.

---

## 5. Component-styling Regels

### Border Radius

| Token | Value | Gebruik |
|-------|-------|---------|
| `rounded-sm` | 4px | Badges, kleine chips, inline tags |
| `rounded-md` | 6px | Buttons (small), inputs, kleine cards |
| `rounded-lg` | 8px | Default: cards, modals, containers |
| `rounded-xl` | 12px | Grote cards, feature sections |
| `rounded-full` | 9999px | Avatars, pills, circular buttons |

**Logica**:
- Kleinere elementen = kleinere radius
- Interactieve elementen = medium radius
- Containers = grotere radius
- Consistentie: Alle elementen binnen een card hebben radius ≤ card radius

### Border Regels

| Wanneer borders | Wanneer shadows |
|-----------------|-----------------|
| Content separation binnen container | Floating/elevated elements |
| Form inputs | Hover states die elevation suggereren |
| Table cells | Dropdowns, popovers |
| Dividers tussen secties | Modals |
| Sidebar separation | - |

**Divider styling**:
```css
border-color: var(--border);
border-width: 1px;
```

### Shadows/Elevation

| Level | Token | CSS | Gebruik |
|-------|-------|-----|---------|
| 0 | - | none | Inline, static |
| 1 | `shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Cards at rest |
| 2 | `shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.1)` | Card hover, raised buttons |
| 3 | `shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.1)` | Dropdowns, popovers |
| 4 | `shadow-xl` | `0 20px 25px -5px rgba(0,0,0,0.1)` | Modals |

### Button Systeem

**Sizes**:

| Size | Height | Padding | Font | Icon |
|------|--------|---------|------|------|
| `sm` | 36px (h-9) | `px-3` | `text-sm` | 16px |
| `default` | 40px (h-10) | `px-4` | `text-sm` | 18px |
| `lg` | 44px (h-11) | `px-6` | `text-base` | 20px |
| `icon` | 40px (h-10 w-10) | - | - | 20px |

**Variants**:

| Variant | Background | Text | Border | Gebruik |
|---------|------------|------|--------|---------|
| `default` | `bg-primary` | `text-primary-foreground` | none | Primary actions |
| `secondary` | `bg-secondary` | `text-secondary-foreground` | none | Secondary actions |
| `outline` | transparent | `text-foreground` | `border` | Tertiary actions |
| `ghost` | transparent | `text-foreground` | none | Inline/toolbar actions |
| `destructive` | `bg-destructive` | `text-destructive-foreground` | none | Delete/remove |
| `link` | transparent | `text-primary` | none | Inline links |

**Icon spacing**: `gap-2` (8px) tussen icon en label

### Form Controls

**Input/Textarea**:
```
Height: h-10 (40px)
Padding: px-3 py-2
Border: 1px solid var(--input)
Radius: rounded-md (6px)
Font: text-base
Focus: ring-2 ring-ring ring-offset-2
Disabled: opacity-50 cursor-not-allowed
```

**Label**:
```
Font: text-sm font-medium
Color: text-foreground
Spacing: mb-2 boven input
```

**Error state**:
```
Border: border-destructive
Message: text-sm text-destructive mt-1
```

**Placeholder**:
```
Color: text-muted-foreground
```

### Cards

```
Container: rounded-lg border bg-card shadow-sm
Header: p-6 space-y-1.5
Title: text-lg font-semibold
Description: text-sm text-muted-foreground
Content: p-6 pt-0
Footer: p-6 pt-0 flex justify-end gap-3
```

### Tables/Lists

```
Header row: bg-muted/50 font-medium text-sm
Body row: hover:bg-muted/30
Cell padding: px-4 py-3
Border: border-b alleen (geen verticale borders)
```

### Modals

```
Overlay: bg-black/50 (dark: bg-black/80)
Container: rounded-lg bg-background shadow-xl max-w-lg w-full
Header: p-6 pb-0
Content: p-6
Footer: p-6 pt-0 flex justify-end gap-3
```

### Chips/Badges

```
Padding: px-2.5 py-0.5
Radius: rounded-full
Font: text-xs font-semibold
Variants: default, secondary, destructive, outline
```

### Tooltips/Toasts

**Tooltip**:
```
Background: bg-popover
Border: border
Shadow: shadow-md
Radius: rounded-md
Padding: px-3 py-1.5
Font: text-sm
Max-width: 300px
```

**Toast**:
```
Background: bg-background
Border: border
Shadow: shadow-lg
Radius: rounded-lg
Padding: p-4
Position: bottom-right (desktop), bottom-center (mobile)
```

### Empty States

```
Container: flex flex-col items-center justify-center py-12
Icon: size-12 text-muted-foreground mb-4
Title: text-lg font-semibold
Description: text-sm text-muted-foreground text-center max-w-sm
Action: mt-4
```

---

## 6. State & Feedback Regels

### Interactive States

| State | Opacity/Color Change | Transition |
|-------|---------------------|------------|
| Default | 100% | - |
| Hover | 90% of `hover:bg-accent` | 150ms ease |
| Active/Pressed | 95% of scale(0.98) | 75ms |
| Focus | ring-2 ring-ring ring-offset-2 | instant |
| Disabled | opacity-50, cursor-not-allowed | - |
| Loading | opacity-70 + spinner | - |

### State Intensity per Component

| Component | Hover | Active | Focus |
|-----------|-------|--------|-------|
| Button primary | `brightness-90` | `brightness-95` | ring |
| Button secondary | `bg-secondary/80` | `bg-secondary/90` | ring |
| Button ghost | `bg-accent` | `bg-accent/80` | ring |
| Card | `shadow-md` | - | ring |
| List item | `bg-muted/50` | `bg-muted` | ring |
| Input | - | - | ring |
| Link | `underline` | `text-primary/80` | ring |

### Severity System

| Severity | Color | Icon | Gebruik |
|----------|-------|------|---------|
| Info | Blue (`text-blue-600`) | `Info` | Neutral information, tips |
| Success | Green (`text-green-600`) | `CheckCircle` | Completion, confirmation |
| Warning | Amber (`text-amber-600`) | `AlertTriangle` | Caution, attention needed |
| Error | Red (`text-destructive`) | `XCircle` | Errors, failures |

**Alert styling per severity**:
```
Info:    bg-blue-50 border-blue-200 text-blue-800 (dark: bg-blue-950 border-blue-900 text-blue-200)
Success: bg-green-50 border-green-200 text-green-800
Warning: bg-amber-50 border-amber-200 text-amber-800
Error:   bg-red-50 border-red-200 text-red-800
```

### Iconografie Regels

**Stroke width**: 1.5px (Lucide default)

**Size set**:

| Token | Size | Gebruik |
|-------|------|---------|
| `size-4` | 16px | Inline met text-sm, badges |
| `size-5` | 20px | Buttons, inputs, default |
| `size-6` | 24px | Standalone, headers |
| `size-8` | 32px | Empty states, features |
| `size-12` | 48px | Hero icons, illustrations |

**Wanneer icon gebruiken**:
- Naast tekst voor snellere herkenning
- Toolbar actions (icon-only met tooltip)
- Status indicators
- Navigation items

**Wanneer GEEN icon**:
- Decoratie zonder functie
- Dubbele betekenis (icon + tekst zeggen hetzelfde)

---

## 7. Enforce-plan

### Linting Checklist voor PR Reviews

```markdown
## UI Consistency Checklist

### Spacing
- [ ] Alle spacing is veelvoud van 4px
- [ ] Geen arbitraire px waarden (13px, 17px, etc.)
- [ ] Gap gebruikt ipv margin voor sibling spacing
- [ ] Juiste density level voor context

### Typography
- [ ] Geen font-bold gebruikt (max font-semibold)
- [ ] Correcte size voor context (zie type scale)
- [ ] Muted-foreground voor secondary text

### Colors
- [ ] Primary green alleen voor actions/links
- [ ] Semantische kleuren correct (rood = error only)
- [ ] Geen hardcoded kleuren, alleen tokens

### Components
- [ ] Correcte button variant voor context
- [ ] Correcte border-radius voor element size
- [ ] Shadow levels consistent met elevation regels

### States
- [ ] Hover/focus/active states aanwezig
- [ ] Disabled state heeft opacity-50
- [ ] Focus ring aanwezig op interactive elements

### Accessibility
- [ ] Color contrast voldoende (4.5:1 minimum)
- [ ] Focus indicators zichtbaar
- [ ] Interactieve elementen hebben accessible name
```

### Top 10 Inconsistenties + Fixes

| # | Probleem | Fout | Fix |
|---|----------|------|-----|
| 1 | Arbitraire spacing | `p-[13px]` of `gap-5px` | Gebruik `p-3` (12px) of `p-4` (16px) |
| 2 | Hardcoded kleuren | `text-[#333]` | Gebruik `text-foreground` of `text-muted-foreground` |
| 3 | Verkeerde button variant | Destructive voor cancel | Gebruik `variant="outline"` voor cancel, `destructive` alleen voor delete |
| 4 | Font-bold misbruik | `font-bold` op labels | Gebruik `font-medium` voor labels, `font-semibold` voor headings |
| 5 | Inconsistente radius | `rounded-2xl` op kleine buttons | Match radius met element size (zie tabel) |
| 6 | Shadow decoratie | `shadow-lg` op statische cards | Gebruik `shadow-sm` of none voor cards at rest |
| 7 | Margin op children | `<Button className="mb-4">` | Gebruik `gap-4` op parent container |
| 8 | Muted voor errors | `text-muted-foreground` voor errors | Gebruik `text-destructive` |
| 9 | Green decoratie | `bg-primary` als achtergrond | Primary green alleen voor interactieve elementen |
| 10 | Missing focus state | Custom button zonder focus ring | Voeg `focus:ring-2 focus:ring-ring focus:ring-offset-2` toe |

### Concrete Voorbeelden

**Fout vs Correct - Spacing en kleuren**:
```tsx
// FOUT
<div className="p-[15px] mb-3 bg-green-100 rounded-2xl shadow-lg">
  <h3 className="font-bold text-[#333]">Title</h3>
  <button className="bg-red-500 rounded-sm">Cancel</button>
</div>

// CORRECT
<div className="p-4 space-y-3 bg-muted rounded-lg shadow-sm">
  <h3 className="font-semibold text-foreground">Title</h3>
  <button className="bg-secondary text-secondary-foreground rounded-md">Cancel</button>
</div>
```

**Fout vs Correct - Margin op children**:
```tsx
// FOUT - margin op children
<div>
  <Card className="mb-4" />
  <Card className="mb-4" />
  <Card />
</div>

// CORRECT - gap op parent
<div className="space-y-4">
  <Card />
  <Card />
  <Card />
</div>
```

**Fout vs Correct - Semantische kleuren**:
```tsx
// FOUT - verkeerde semantic color
<p className="text-blue-500">Error: Something went wrong</p>

// CORRECT
<p className="text-destructive">Error: Something went wrong</p>
```

---

## Appendix: Token Quick Reference

### Colors
```
--primary: #046a38 (light) / #34d399 (dark)
--destructive: #b3282d (light) / #ef4444 (dark)
--muted-foreground: hsl(240 3.8% 46.1%)
--border: #e4e4e7 (light) / hsl(220 10% 18%) (dark)
```

### Spacing (4px grid)
```
1=4px, 2=8px, 3=12px, 4=16px, 5=20px, 6=24px, 8=32px, 10=40px, 12=48px
```

### Type Scale
```
xs=12px, sm=14px, base=16px, lg=18px, xl=20px, 2xl=24px, 3xl=30px
```

### Border Radius
```
sm=4px, md=6px, lg=8px, xl=12px, full=9999px
```

### Shadows
```
sm: 0 1px 2px rgba(0,0,0,0.05)
md: 0 4px 6px -1px rgba(0,0,0,0.1)
lg: 0 10px 15px -3px rgba(0,0,0,0.1)
xl: 0 20px 25px -5px rgba(0,0,0,0.1)
```

---

*Dit document is de enige bron van waarheid voor UI beslissingen. Afwijkingen vereisen expliciete goedkeuring en documentatie.*
