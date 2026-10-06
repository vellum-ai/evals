import { describe, expect, test } from "bun:test";

import { shippingCents, shippingWithSurcharge } from "./rates";

describe("rates", () => {
  test("a parcel falls into its band", () => {
    expect(shippingCents(300)).toBe(495);
    expect(shippingCents(500)).toBe(495);
    expect(shippingCents(1900)).toBe(795);
  });

  test("anything over the top band ships freight", () => {
    expect(shippingCents(25000)).toBe(4485);
  });

  test("the surcharge applies to the band price", () => {
    expect(shippingWithSurcharge(300, 0.1)).toBe(545);
  });
});
