# TypeScript Conventions

## Type Definitions

- **Always use `type` instead of `interface`** for all type definitions
- **Always export types** - never define internal-only types
- Prefix unused parameters with underscore: `_param`
- **No `any` types allowed** - ESLint enforces `@typescript-eslint/no-explicit-any: error`

## Strict TypeScript Rules

- **Avoid `any` entirely**: Prefer `unknown` for external/untrusted input and narrow it with type guards.
  - Use explicit types, generics, or union types instead of `any`.
  - When interacting with third-party libraries that expose `any`, wrap or adapt their surface with well-typed adapters.

- **Avoid type casting with `as unknown as`**: This double assertion bypasses TypeScript's type safety entirely.
  - Instead, define proper types and use type guards, validation functions, or type predicates.
  - Only use when absolutely necessary (e.g., mocking in tests) and document why it's needed.

### Avoid

```ts
// ❌ Bypasses type safety
const user = data as unknown as User;

// ❌ Avoid inline type literal
export function login(opts: { username: string; password: string }): Promise<void> {}
```

### Preferred

```ts
// ✅ Proper validation
export type User = { id: string; name: string };

function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'name' in value &&
    typeof value.name === 'string'
  );
}

export function parseUser(data: unknown): User {
  if (!isUser(data)) {
    throw new Error('Invalid user data');
  }
  return data;
}

export type LoginOptions = { username: string; password: string };

export function login(opts: LoginOptions): Promise<void> {
  /* ... */
}
```

- **Always export named types for public-facing shapes**: Do not use inline type literals for function parameters, return values, or exported APIs.
  - Named, exported types improve discoverability, reuse, and documentation.

- **Do not implement inline types** inside complex values (objects, arrays, or nested shapes).
  - If a type is used in more than one place or is part of the public surface, extract and export it.
  - For deeply nested shapes, define internal helper types (exported if part of public API) instead of embedding inline object types.

## Type Guidance and Examples

- Use `unknown` in API boundaries and validate before using values:

  ```ts
  export function handle(input: unknown): string {
    // Type guard for validation
    if (typeof input !== 'string') {
      throw new Error('Expected string input');
    }
    return input; // TypeScript knows it's a string here
  }
  ```

- Use type predicates for complex validation:

  ```ts
  export type ApiResponse = { status: number; data: unknown };

  function isApiResponse(value: unknown): value is ApiResponse {
    return (
      typeof value === 'object' &&
      value !== null &&
      'status' in value &&
      typeof value.status === 'number' &&
      'data' in value
    );
  }

  export function parseResponse(resp: unknown): ApiResponse {
    if (!isApiResponse(resp)) {
      throw new Error('Invalid API response');
    }
    return resp; // Properly typed as ApiResponse
  }
  ```

- For third-party responses, map into well-typed domain objects immediately:

  ```ts
  // Define exported types
  export type User = { id: string; name: string };

  // Validation with type predicate
  function isValidUser(value: unknown): value is User {
    return (
      typeof value === 'object' &&
      value !== null &&
      'id' in value &&
      typeof value.id === 'string' &&
      'name' in value &&
      typeof value.name === 'string'
    );
  }

  export function mapExternalUser(resp: unknown): User {
    if (!isValidUser(resp)) {
      throw new Error('Invalid user data from external API');
    }
    return resp;
  }
  ```

## Error Handling

```typescript
// ✅ Correct - Type-safe error handling
catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
}

// ❌ Incorrect - Using any
catch (error: any) {
  console.error(error.message);
}
```
