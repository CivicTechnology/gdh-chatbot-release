# Biome Code Standards

This project is organized as a **bun workspace monorepo**:
- `packages/web/` - Vite + React SPA (TypeScript)
- `packages/api/` - Express.js API server (TypeScript)
- `packages/shared/` - Shared types, utilities, and AI tools (TypeScript)
- `packages/pipeline/` - Data ingestion scripts (TypeScript)
- `packages/data-collection/` - Python scripts for document processing and web scraping

Commands should be run from the monorepo root (see root `package.json` for available scripts).

---

This project uses **Biome**, a fast Rust-based linter and formatter that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `bun biome format --write .`
- **Check for issues**: `bun biome check .`
- **Lint code**: `bun biome lint --write .`

Biome provides extremely fast, reliable linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)

### Framework-Specific Guidance

**Vite + React (packages/web):**
- Use React Router for client-side routing
- Configure path aliases in `vite.config.ts` and `tsconfig.json`
- Use environment variables with `VITE_` prefix for client-side access
- Leverage Vite's hot module replacement for fast development

**Express.js (packages/api):**
- Use middleware for cross-cutting concerns (auth, logging, error handling)
- Follow domain-driven folder structure (see API Architecture below)
- Use the Service Layer pattern with functional style
- Keep controllers thin - delegate business logic to services
- Implement proper error handling middleware
- Use environment variables for configuration (no `VITE_` prefix needed)

**Shared Package (packages/shared):**
- Export types, utilities, and AI tools for use by both web and api
- Keep this package dependency-free where possible
- Use proper TypeScript exports in `src/index.ts`

**React 19+:**
- Use ref as a prop instead of `React.forwardRef`

---

## API Architecture (packages/api)

### Domain-Driven Folder Structure
```
src/
├── domains/                    # Feature modules grouped by domain
│   ├── chat/
│   │   ├── chat.controller.ts  # HTTP request/response handling
│   │   ├── chat.service.ts     # Business logic
│   │   ├── chat.repository.ts  # Database operations
│   │   ├── chat.routes.ts      # Route definitions
│   │   └── chat.types.ts       # Domain-specific types
│   ├── message/
│   ├── auth/
│   ├── vote/
│   └── stream/
├── lib/                        # Shared utilities
│   ├── ai/                     # AI/LLM logic and tools
│   └── db/                     # Database client and shared queries
├── middleware/                 # Express middleware
└── config/                     # Configuration and environment
```

### Service Layer Pattern (Functional Style)

**Repositories** - Database operations only:
```typescript
export const chatRepository = {
  findById: (id: string) => prisma.chat.findUnique({ where: { id } }),
  findBySessionId: (sessionId: string) => prisma.chat.findMany({ where: { sessionId } }),
  create: (data: CreateChatData) => prisma.chat.create({ data }),
  delete: (id: string) => prisma.chat.delete({ where: { id } }),
}
```

**Services** - Business logic, calls repositories:
```typescript
export const chatService = {
  getChatById: async (id: string, userId?: string, sessionId?: string) => {
    const chat = await chatRepository.findById(id)
    if (!chat) throw new NotFoundError("Chat not found")
    if (!canAccessChat(chat, userId, sessionId)) throw new ForbiddenError()
    return chat
  },
  createChat: async (data: CreateChatInput) => {
    // validation, business rules, etc.
    return chatRepository.create(transformedData)
  },
}
```

**Controllers** - HTTP layer only, calls services:
```typescript
export const chatController = {
  show: async (req: Request, res: Response) => {
    const chat = await chatService.getChatById(req.params.id, req.user?.id, req.sessionId)
    res.json(chat)
  },
  create: async (req: Request, res: Response) => {
    const chat = await chatService.createChat(req.body)
    res.status(201).json(chat)
  },
}
```

**Routes** - Thin, only wiring:
```typescript
export const chatRouter = Router()
chatRouter.get("/:id", chatController.show)
chatRouter.post("/", chatController.create)
```

### Naming Conventions

| Layer | File naming | Method naming |
|-------|-------------|---------------|
| Routes | `{domain}.routes.ts` | - |
| Controllers | `{domain}.controller.ts` | `show`, `index`, `create`, `update`, `destroy` |
| Services | `{domain}.service.ts` | `get{Entity}ById`, `create{Entity}`, `update{Entity}`, `delete{Entity}`, `list{Entities}` |
| Repositories | `{domain}.repository.ts` | `findById`, `findMany`, `create`, `update`, `delete` |
| Types | `{domain}.types.ts` | `{Entity}Input`, `{Entity}Output`, `Create{Entity}Data` |

### Anonymous Sessions

Anonymous users are tracked via a `sessionId` stored in a httpOnly cookie:
- Authenticated users: identified by `userId`
- Anonymous users: identified by `sessionId` (UUID, stored in cookie)
- Chats store both `userId` (nullable) and `sessionId` (nullable)
- When anonymous user registers, migrate their chats by matching `sessionId` to new `userId`

### Route Handlers
- Use async/await for all async operations
- Return proper HTTP status codes
- Use `express.json()` middleware for parsing JSON bodies
- Implement proper CORS configuration for cross-origin requests

### Error Handling
- Create custom error classes for different error types (NotFoundError, ForbiddenError, etc.)
- Use a centralized error handling middleware
- Never expose stack traces in production
- Log errors with appropriate context

### Authentication
- Use session-based auth stored in httpOnly cookies
- Implement middleware for protected routes (`requireAuth`, `optionalAuth`)
- Validate and sanitize all user inputs with Zod
- Use bcrypt for password hashing

### Database (Prisma)
- Schema defined in `packages/api/prisma/schema.prisma`
- Use migrations: `bun db:generate` and `bun db:migrate`
- Use transactions for operations that modify multiple tables
- Repository functions handle all Prisma calls

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Biome Can't Help

Biome's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Biome. Run `bun biome format --write . && bun biome lint --write .` before committing to ensure compliance.
