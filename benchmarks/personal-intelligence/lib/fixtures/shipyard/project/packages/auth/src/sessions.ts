/** A staff session, as the till understands it. */
export interface Session {
  user: string;
  role: "owner" | "staff" | "reader";
  issuedAt: number;
}

const HOUR_MS = 60 * 60 * 1000;

/** A session is good for eight hours. */
export function isActive(session: Session, now: number): boolean {
  return now - session.issuedAt < 8 * HOUR_MS;
}

/** Only the owner and staff can take money. */
export function canTakePayment(session: Session, now: number): boolean {
  return isActive(session, now) && session.role !== "reader";
}
