import { formatUsd } from "../../core/src/money";

/** An outbound message, ready to hand to a transport. */
export interface Message {
  to: string;
  subject: string;
  body: string;
}

/** Tell a customer their order is on its way. */
export function shippedMessage(
  to: string,
  orderId: string,
  tracking: string,
): Message {
  return {
    to,
    subject: `Order ${orderId} is on its way`,
    body: `Your order ${orderId} shipped today. Tracking: ${tracking}.`,
  };
}

/** Tell a customer what they were charged. */
export function receiptMessage(
  to: string,
  orderId: string,
  cents: number,
): Message {
  return {
    to,
    subject: `Receipt for ${orderId}`,
    body: `We charged ${formatUsd(cents)} for order ${orderId}.`,
  };
}
