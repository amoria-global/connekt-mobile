// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

/**
 * Midnight Glass: colours come from src/theme only (see CLAUDE.md, Design System). A hex literal
 * anywhere else is an error. Files still waiting for their screen's migration are listed in
 * eslint/hex-colors-pending.json; src/test/hexColors.rule.test.ts makes the list shrink only.
 */
// Escaped, because expo-router paths like `(app)/event/[id].tsx` are glob syntax.
const hexPending = require('./eslint/hex-colors-pending.json').map((f) => f.replace(/[()[\]]/g, '\\$&'));
const HEX = '/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/';
const HEX_MESSAGE = 'Hex colour outside the theme. Use a palette token from @/theme (useTheme / makeStyles).';

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/theme/**', 'src/_design-sandbox/**', '**/*.test.{ts,tsx}', ...hexPending],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: `Literal[value=${HEX}]`, message: HEX_MESSAGE },
        { selector: `TemplateElement[value.raw=${HEX}]`, message: HEX_MESSAGE },
      ],
    },
  },
]);
