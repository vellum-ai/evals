import { describe, expect, test, mock, afterEach } from "bun:test";
import { proxyAwareFetch, resolveHttpsProxy } from "../proxy-fetch";

describe("proxy-fetch", () => {
  describe("resolveHttpsProxy", () => {
    test("reads HTTPS_PROXY", () => {
      expect(resolveHttpsProxy({ HTTPS_PROXY: "http://127.0.0.1:8080" })).toBe(
        "http://127.0.0.1:8080",
      );
    });

    test("falls back to lowercase https_proxy", () => {
      expect(resolveHttpsProxy({ https_proxy: "http://127.0.0.1:9" })).toBe(
        "http://127.0.0.1:9",
      );
    });

    test("trims and treats blank as unset", () => {
      expect(resolveHttpsProxy({ HTTPS_PROXY: "  " })).toBeUndefined();
      expect(resolveHttpsProxy({})).toBeUndefined();
    });
  });

  describe("proxyAwareFetch", () => {
    const origFetch = globalThis.fetch;
    afterEach(() => {
      globalThis.fetch = origFetch;
    });

    test("delegates to native fetch when no proxy is configured", async () => {
      const fn = mock(async () => new Response("ok", { status: 200 }));
      globalThis.fetch = fn as unknown as typeof globalThis.fetch;

      const res = await proxyAwareFetch(
        "https://example.test/x",
        { method: "GET" },
        {},
      );

      expect(res.status).toBe(200);
      expect(await res.text()).toBe("ok");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test("routes through curl when a proxy is set (dead proxy surfaces a transport error)", async () => {
      // Point at a dead local port so curl fails fast; we only assert that
      // the curl path is taken (native fetch would not throw a curl error).
      await expect(
        proxyAwareFetch(
          "https://example.test/x",
          { method: "GET" },
          { HTTPS_PROXY: "http://127.0.0.1:1" },
        ),
      ).rejects.toThrow(/curl request to/);
    });
  });
});
