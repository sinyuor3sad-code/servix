'use strict';

module.exports = {
  rules: {
    'no-decimal-to-number': require('./rules/no-decimal-to-number'),
    'no-math-random-in-security': require('./rules/no-math-random-in-security'),
  },
};
