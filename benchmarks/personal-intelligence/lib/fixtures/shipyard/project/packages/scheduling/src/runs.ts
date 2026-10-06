/** A delivery run on a given weekday. */
export interface Run {
  day: "mon" | "tue" | "wed" | "thu" | "fri";
  capacity: number;
  booked: number;
}

/** Can this run take one more parcel? */
export function hasRoom(run: Run): boolean {
  return run.booked < run.capacity;
}

/** Book a parcel onto the first run of the week with room. */
export function bookNext(runs: Run[]): Run[] {
  const index = runs.findIndex(hasRoom);
  if (index === -1) {
    throw new Error("Every run this week is full.");
  }
  return runs.map((run, position) =>
    position === index ? { ...run, booked: run.booked + 1 } : run,
  );
}
