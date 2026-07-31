// `src/constants/theme.ts` imports `@/global.css` for the web build. Jest
// can't parse CSS, and the resulting SyntaxError points at the stylesheet
// rather than at the test that triggered it — map it to nothing instead.
module.exports = {};
