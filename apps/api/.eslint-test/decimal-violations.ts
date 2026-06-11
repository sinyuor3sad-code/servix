// Fixture for @servix/servix/no-decimal-to-number.
// Run from apps/api:
//   pnpm exec eslint --no-ignore .eslint-test/decimal-violations.ts
//
// Lines marked "❌" must trigger the rule (errors).
// Lines marked "✓" must not.
//
// The rule is intentionally conservative (case-sensitive, Prisma camelCase
// money-tail). Lowercase single-word fields like `amount`, `total`,
// `salary`, `subtotal`, `revenue` are NOT caught by the property-access
// path — these are caught instead via the Prisma.Decimal type-annotation
// path when Engineer 4's Phase-2 refactor wraps them with typed Decimal.

import type { Prisma } from '@prisma/client';

declare const client: { totalSpent: any; fullName: string };
declare const invoice: { taxAmount: any; discountAmount: any };
declare const employee: { commissionValue: any };
declare const product: { costPrice: any; sellPrice: any };
declare const dna: { predictedClv: any; maxTicketValue: any };
declare const usage: { totalRevenue: any };

declare const decimalVar: Prisma.Decimal;
declare function makeDecimal(): Prisma.Decimal;

// ❌ property-access whose tail matches the money regex (camelCase only)
const v1 = Number(client.totalSpent);          // Spent
const v2 = Number(invoice.taxAmount);          // Amount
const v3 = Number(invoice.discountAmount);     // Amount
const v4 = Number(product.costPrice);          // Price
const v5 = Number(product.sellPrice);          // Price
const v6 = Number(dna.predictedClv);           // Clv
const v7 = Number(usage.totalRevenue);         // Revenue

// ❌ identifier with Prisma.Decimal type annotation (in scope)
const local: Prisma.Decimal = makeDecimal();
const v8 = Number(local);

// ❌ ambient declared identifier with Prisma.Decimal type
const v9 = Number(decimalVar);

// ✓ literals — clean
const safe1 = Number('123');
const safe2 = Number(42);

// ✓ count/index allowlist — clean even though the variable name could carry money in another codebase
const pageNumber = 5;
const count = 10;
const index = 0;
const limit = 100;
const safe3 = Number(pageNumber);
const safe4 = Number(count);
const safe5 = Number(index);
const safe6 = Number(limit);

// ✓ unrelated property tails — clean
const safe7 = Number(client.fullName.length);
const safe8 = Number(employee.commissionValue);  // "Value" is not in the money tail regex; intentional

// ✓ untyped identifier — clean by conservative design
declare const ambiguous: any;
const safe9 = Number(ambiguous);

// Suppress "unused variable" warnings — these are fixture markers, not real code
void v1; void v2; void v3; void v4; void v5; void v6; void v7; void v8; void v9;
void safe1; void safe2; void safe3; void safe4; void safe5; void safe6; void safe7; void safe8; void safe9;
