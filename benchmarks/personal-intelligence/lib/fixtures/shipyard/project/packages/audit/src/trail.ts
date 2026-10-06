/** One recorded action. */
export interface Entry {
  at: number;
  actor: string;
  action: string;
}

/** Append an entry, newest last. */
export function record(trail: Entry[], entry: Entry): Entry[] {
  return [...trail, entry];
}

/** Everything one actor did, oldest first. */
export function byActor(trail: Entry[], actor: string): Entry[] {
  return trail
    .filter((entry) => entry.actor === actor)
    .sort((a, b) => a.at - b.at);
}

/** The last thing that happened, if anything has. */
export function latest(trail: Entry[]): Entry | undefined {
  return trail.reduce<Entry | undefined>(
    (newest, entry) =>
      newest === undefined || entry.at > newest.at ? entry : newest,
    undefined,
  );
}
