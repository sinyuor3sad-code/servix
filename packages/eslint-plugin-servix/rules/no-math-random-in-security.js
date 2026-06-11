'use strict';

/**
 * Forbids `Math.random()` because it is not cryptographically secure.
 * V8's xorshift128+ implementation is deterministic and predictable from
 * a few observed outputs — a fatal property for OTP codes, tokens, and
 * any other secret-generation path.
 *
 * Every Math.random() in apps/api/src must either:
 *   - be replaced by `crypto.randomInt(min, max)` or `crypto.randomBytes(n)`, or
 *   - carry a `// non-security` annotation (on the same line, or as the
 *     immediately preceding line, with no blank line between).
 *
 * The annotation regex is strict to prevent false-positive escapes
 * (see ANNOTATION_RE below). Accepted forms:
 *     "// non-security"
 *     "// non-security: jitter for anti-ban delays"
 * Rejected forms:
 *     "// non-securityish"   — no colon and no end-of-line after the token
 *     "// the non-security…" — token not at start of comment
 */

// Annotation token: a `//` comment whose first non-whitespace content is
// the literal `non-security`, followed by either a colon (for a reason)
// or end-of-string. Anchored at the comment start to reject mid-comment
// occurrences like "// the non-security part".
const ANNOTATION_RE = /\/\/\s*non-security(?::|\s*$)/;

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow Math.random() — use crypto.randomInt / crypto.randomBytes for security-sensitive randomness, or annotate with `// non-security` for jitter/UI/ephemeral-id uses.',
    },
    schema: [],
    messages: {
      mathRandomForbidden:
        'Math.random() is not cryptographically secure. Use crypto.randomInt() or crypto.randomBytes() for security-sensitive randomness. For non-security uses (jitter, UI, ephemeral ids), annotate with `// non-security: <reason>` on the same line or the immediately preceding line.',
    },
  },

  create(context) {
    const sourceCode = context.getSourceCode
      ? context.getSourceCode()
      : context.sourceCode;

    function lineMatchesAnnotation(lineNumber) {
      if (lineNumber < 1) return false;
      const lines = sourceCode.lines;
      if (lineNumber > lines.length) return false;
      return ANNOTATION_RE.test(lines[lineNumber - 1]);
    }

    return {
      // Match `Math.random` reads as a property — covers `Math.random()` and
      // any variant like `Math.random()`/`Math.random;` etc.
      "MemberExpression[object.name='Math'][property.name='random']"(node) {
        const line = node.loc.start.line;

        // Annotation may live:
        //   (1) on the same physical line as the call, OR
        //   (2) on the immediately preceding line.
        if (lineMatchesAnnotation(line)) return;
        if (lineMatchesAnnotation(line - 1)) return;

        context.report({ node, messageId: 'mathRandomForbidden' });
      },
    };
  },
};
