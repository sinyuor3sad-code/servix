'use strict';

/**
 * Forbids `Number(x)` where `x` looks like a Prisma `Decimal`.
 *
 * The rule is heuristic-only — it never inspects type information from the
 * TS server, only the AST that ESLint hands us. False positives are worse
 * than false negatives, so the match conditions are deliberately narrow:
 *
 *   1. `Number(obj.<name>)` where <name> matches the money-column regex
 *      (Prisma camelCase: totalSpent, amount, price, ...).
 *   2. `Number(identifier)` where the identifier has a local TS type
 *      annotation whose text contains "Decimal".
 *
 * Counts/indices/page numbers are never flagged because their identifiers
 * are not in the money-column regex.
 */

const MONEY_TAIL = /(Spent|Revenue|Clv|Balance|Amount|Total|Subtotal|Price|Cost|Salary|Commission)$/;

const SAFE_IDENT_NAMES = new Set([
  'pageNumber', 'count', 'index', 'pageSize', 'limit', 'offset', 'quantity',
  'page', 'size', 'skip', 'take', 'n', 'i', 'idx',
]);

const REPLACEMENT_MESSAGE =
  'Avoid Number() on Prisma.Decimal values — use .toString(), .toFixed(n), ' +
  'or Decimal arithmetic instead. Number() loses precision for amounts > 15 ' +
  'significant digits and is unsafe on financial data.';

/**
 * Walk up TSTypeReference nodes ("Foo", "Foo.Bar", "Foo<Bar>") and collect
 * every identifier name they contain. We only need a substring match for
 * "Decimal" so a flat list is enough.
 */
function typeRefMentionsDecimal(typeNode) {
  if (!typeNode) return false;
  const stack = [typeNode];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (node.type === 'Identifier' && node.name === 'Decimal') return true;
    // TSQualifiedName: { left, right } — descend both sides
    if (node.type === 'TSQualifiedName') {
      stack.push(node.left, node.right);
      continue;
    }
    // TSTypeReference with type parameters / nested annotations
    if (node.typeName) stack.push(node.typeName);
    if (node.typeAnnotation) stack.push(node.typeAnnotation);
    if (Array.isArray(node.params)) stack.push(...node.params);
  }
  return false;
}

/**
 * Look up an identifier in the current scope chain and check whether its
 * declaration carries a TS type annotation that mentions "Decimal".
 */
function identifierHasDecimalType(context, identNode) {
  const scope = context.getScope();
  // Walk scopes upward
  let s = scope;
  while (s) {
    const variable = s.variables.find((v) => v.name === identNode.name);
    if (variable && variable.defs && variable.defs.length > 0) {
      for (const def of variable.defs) {
        const declNode = def.node;
        // VariableDeclarator: const x: Decimal = ...
        if (declNode && declNode.id && declNode.id.typeAnnotation) {
          if (typeRefMentionsDecimal(declNode.id.typeAnnotation.typeAnnotation)) {
            return true;
          }
        }
        // Function parameter: function f(x: Decimal) { ... }
        if (def.type === 'Parameter' && declNode && declNode.typeAnnotation) {
          if (typeRefMentionsDecimal(declNode.typeAnnotation.typeAnnotation)) {
            return true;
          }
        }
      }
      return false;
    }
    s = s.upper;
  }
  return false;
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow Number(x) on values that look like Prisma Decimal — precision loss on financial data.',
    },
    schema: [],
    messages: {
      decimalToNumber: REPLACEMENT_MESSAGE,
    },
  },

  create(context) {
    return {
      CallExpression(node) {
        // Match Number(arg) — single-arg, callee is the bare identifier "Number".
        if (
          node.callee.type !== 'Identifier' ||
          node.callee.name !== 'Number' ||
          node.arguments.length !== 1
        ) {
          return;
        }

        const arg = node.arguments[0];

        // (1) Property access: Number(obj.totalSpent)
        if (arg.type === 'MemberExpression' && !arg.computed && arg.property && arg.property.type === 'Identifier') {
          if (MONEY_TAIL.test(arg.property.name)) {
            context.report({ node, messageId: 'decimalToNumber' });
            return;
          }
        }

        // (2) Identifier with a TS type annotation that mentions Decimal
        if (arg.type === 'Identifier') {
          if (SAFE_IDENT_NAMES.has(arg.name)) return;
          if (identifierHasDecimalType(context, arg)) {
            context.report({ node, messageId: 'decimalToNumber' });
          }
        }
      },
    };
  },
};
