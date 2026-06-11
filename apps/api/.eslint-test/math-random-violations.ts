// Fixture for @servix/servix/no-math-random-in-security.
// Run from apps/api:
//   pnpm exec eslint --no-ignore .eslint-test/math-random-violations.ts
//
// Lines marked "❌" must trigger the rule (errors).
// Lines marked "✓" must not.
//
// Annotation regex (strict):
//   /^\s*\/\/\s*non-security(?::|\s*$)/
//   ✓ "// non-security"
//   ✓ "// non-security: jitter"
//   ✗ "// non-securityish" (no colon, no end)
//   ✗ "// the non-security part" (not at start of comment)

// ❌ bare Math.random() — no annotation
const bareOne = Math.random();

// ❌ another bare one
function bareTwo(): number {
  return Math.random();
}

// ✓ same-line annotation
const sameLine = Math.random(); // non-security: UI jitter

// ✓ preceding-line annotation
// non-security: timing jitter
const precedingLine = Math.random();

// ✓ preceding-line annotation with colon + reason
// non-security: file upload uniqueness suffix
const precedingWithReason = Math.random();

// ❌ blank line between annotation and call — must NOT escape the rule
// non-security: this looks like an annotation but blank line breaks adjacency

const blankBetween = Math.random();

// ❌ near-miss annotation: "non-securityish" — must NOT escape
const nearMiss1 = Math.random(); // non-securityish jitter

// ❌ near-miss: token mid-comment — must NOT escape
const nearMiss2 = Math.random(); // explanation about the non-security context

// ❌ near-miss: missing colon AND not end-of-line — must NOT escape
const nearMiss3 = Math.random(); // non-security something

// ✓ valid: ends at line boundary (no colon, no trailing text)
const validEol = Math.random(); // non-security

// suppress unused-variable warnings for fixture vars
void bareOne; void bareTwo; void sameLine; void precedingLine; void precedingWithReason;
void blankBetween; void nearMiss1; void nearMiss2; void nearMiss3; void validEol;
