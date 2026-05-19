# @servix/eslint-plugin-servix

Project-local ESLint rules for the Servix monorepo.

## Rules

### `no-decimal-to-number`

Flags `Number(x)` calls where `x` looks like a Prisma `Decimal` value, since the conversion silently loses precision on amounts that exceed JavaScript's safe-integer range (`2^53 − 1` ≈ 9 quadrillion units, easily reachable when working in halalas/cents) and breaks downstream arithmetic on amounts that contain more than 15 significant digits.

The rule is intentionally **conservative**: it only fires on patterns that are statically obvious, never on a bare `Number(x)` whose argument cannot be identified as a Decimal. False positives are worse than false negatives here — the goal is to gate the Phase 2 Engineer 4 refactor that introduces `Prisma.Decimal` throughout `invoices.service.ts` and the payments path.

Triggers an error when the argument to `Number()` is:

- a property access whose tail matches `/(Spent|Revenue|Clv|Balance|Amount|Total|Subtotal|Price|Cost|Salary|Commission)$/` (Prisma camelCase convention for money columns), **OR**
- a variable / parameter with a TypeScript type annotation that mentions `Decimal` (e.g. `Prisma.Decimal`, `Decimal`).

Allowed:

- `Number(literal)` — `Number('123')`, `Number(42)`.
- `Number(x)` where `x` is named `pageNumber`, `count`, `index`, `pageSize`, `limit`, `offset`, `quantity` (counts, not amounts).

### Replacements

```ts
// ❌ loses precision
const n = Number(client.totalSpent);

// ✅ string for display
const s = client.totalSpent.toString();

// ✅ formatted for UI
const formatted = client.totalSpent.toFixed(2);

// ✅ arithmetic with Prisma.Decimal
const total = client.totalSpent.add(payment.amount);
```

## Usage

Already wired into `apps/api/.eslintrc.js`. To enable in another app:

```js
// .eslintrc.js
module.exports = {
  plugins: ['@servix/servix'],
  rules: {
    '@servix/servix/no-decimal-to-number': 'error',
  },
};
```

The package name is `@servix/eslint-plugin-servix`; ESLint resolves the `@servix/servix` plugin shorthand to it.
