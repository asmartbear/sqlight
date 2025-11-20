# SQLight

Typescript-safe SQL builder for SQLite.

Build schemas with simple Typescript syntax, then build and execute type-safe queries.

Catches simple bugs at compile-time, and makes it particularly easy to refactor schemas.

## Usage

```typescript
import * as V from "@asmartbear/sqlight"

...
```


## Development

Build:

```bash
npm run build
```

Unit tests:

```bash
npm run test
```

Unit tests, refreshed live:

```bash
npm run watch
```

Prepare for release (e.g. run tests and bump version number), and then release:

```bash
npm run release && git push --follow-tags origin main && npm publish
```

