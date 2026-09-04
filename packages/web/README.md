# Web Package

Vite + React frontend applicatie voor de GDH Chatbot.

## Tech Stack

- **Vite** - Build tool en dev server
- **React 19** - UI framework
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI componenten

## Development

```bash
# Vanuit monorepo root
bun dev:web

# Of vanuit deze directory
bun dev
```

De app draait op `http://localhost:5173`.

## Build

```bash
bun build
bun preview    # Preview production build
```

## Environment Variabelen

De frontend leest environment variabelen via Vite. Variabelen die client-side nodig zijn moeten beginnen met `VITE_`:

```bash
VITE_API_URL=http://localhost:3001
```

Andere variabelen (zoals `POSTGRES_URL`) worden alleen server-side gebruikt door de API.

## Structuur

- `src/app/` - Pagina's en routing
- `src/components/` - React componenten
  - `ui/` - shadcn/ui basis componenten
  - `elements/` - Custom chat UI elementen
- `src/hooks/` - Custom React hooks
- `src/lib/` - Utilities en helpers
