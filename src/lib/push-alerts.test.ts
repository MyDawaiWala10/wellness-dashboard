import { describe, expect, it, vi } from "vitest";

vi.mock("@/actions/push/push", () => ({}));

import { keyBytes } from "./push-alerts";

describe("keyBytes: the server's VAPID key as the browser needs it", () => {
  it("decodes base64url (no padding, - and _) to the exact 65-byte key", () => {
    // A real P-256 public key, as `web-push generate-vapid-keys` prints it.
    const key = "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM";
    const bytes = keyBytes(key);
    expect(bytes).toHaveLength(65);
    expect(bytes[0]).toBe(0x04);
    expect(Buffer.from(bytes).toString("base64url")).toBe(key);
  });
});
