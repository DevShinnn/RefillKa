export type AccountUsage = {
  collections: number;
  payments: number;
  storeFeedback: number;
  appFeedback: number;
};

export function usageLines(usage: AccountUsage): string[] {
  const lines: string[] = [];
  if (usage.collections) lines.push(`${usage.collections} collection / reorder row${usage.collections === 1 ? '' : 's'}`);
  if (usage.payments) lines.push(`${usage.payments} payment${usage.payments === 1 ? '' : 's'}`);
  if (usage.storeFeedback) lines.push(`${usage.storeFeedback} store feedback note${usage.storeFeedback === 1 ? '' : 's'}`);
  if (usage.appFeedback) lines.push(`${usage.appFeedback} app suggestion${usage.appFeedback === 1 ? '' : 's'}`);
  return lines;
}

export function usageTotal(usage: AccountUsage) {
  return usage.collections + usage.payments + usage.storeFeedback + usage.appFeedback;
}
