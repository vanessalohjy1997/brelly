/**
 * The MMKV key recording that a uid's one-time local→cloud migration is done.
 *
 * Pure string formatting, and that is why it is here rather than behind a
 * seam. Its home is `services/localDataMigration.ts`, which stays in the
 * mobile app whole — web has no pre-migration MMKV blobs to import and never
 * will — but `accountLinkService` writes this key for two reasons that have
 * nothing to do with migrating: a merge into an existing account, and a sign
 * out, both have to mark the uid they land on as already-migrated before the
 * next cold boot can run against it. Seaming a function whose entire body is a
 * template literal to carry that across would be ceremony.
 *
 * Keyed by uid because the flag is a fact about an account, not about a
 * device: a device that signs out and back in visits several uids, and each
 * one needs its own answer.
 */
export function migrationFlagKey(uid: string): string {
  return `brelly-migration-complete:${uid}`;
}
