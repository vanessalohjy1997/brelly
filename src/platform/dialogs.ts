/**
 * The three questions the app has to stop and ask.
 *
 * Already promise-returning before this seam existed, and that is not a
 * coincidence — a modal question is asynchronous on any platform, so the
 * signature that native `Alert.alert` forced is the one the web needs too.
 * `Alert.alert` here; a rendered dialog there, since the browser's `confirm`
 * is synchronous, unstyleable and offers only two buttons where two of these
 * three need three.
 *
 * Each resolves to a "leave everything alone" value when dismissed without a
 * button pressed. That convention is load-bearing and every caller depends on
 * it: an unanswered question must not commit.
 */
export { askEditScope, type EditScope } from "@/utils/askEditScope";
export { confirmSignOut } from "@/utils/confirmSignOut";
export { promptMergeChoice, type MergeChoice } from "@/utils/promptMergeChoice";
