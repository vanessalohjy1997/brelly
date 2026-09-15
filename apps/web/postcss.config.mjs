/**
 * Tailwind v4 is a PostCSS plugin of its own package — `tailwindcss` is no
 * longer the plugin name, and listing it here the v3 way fails with a message
 * that points at PostCSS rather than at the rename.
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
