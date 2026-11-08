// Sends one alert to a phone using the Web Push standard, with only Node's built-in
// crypto (no extra packages). Two parts:
//  • the message is encrypted so only the phone can read it (RFC 8291, "aes128gcm")
//  • the request is signed with the garden's own keys so Apple accepts it (VAPID, RFC 8292)

import { createCipheriv, createECDH, createPrivateKey, hkdfSync, randomBytes, sign } from "node:crypto";

export const b64url = {
  encode: (b: Uint8Array) => Buffer.from(b).toString("base64url"),
  decode: (s: string) => Buffer.from(s, "base64url"),
};

/** Encrypts a message for the phone. `salt` and `serverKeys` can be given for testing. */
export function encrypt(
  payload: Uint8Array,
  p256dh: string,
  auth: string,
  opts: { salt?: Buffer; ecdh?: ReturnType<typeof createECDH> } = {},
): Buffer {
  const uaPublic = b64url.decode(p256dh);
  const authSecret = b64url.decode(auth);
  const ecdh = opts.ecdh ?? createECDH("prime256v1");
  if (!opts.ecdh) ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPublic);
  const salt = opts.salt ?? randomBytes(16);

  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = Buffer.from(hkdfSync("sha256", shared, authSecret, keyInfo, 32));
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));

  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);

  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(4096, 16);
  header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, body]);
}

/** The signed "who's sending this" token Apple and others ask for. */
export function vapidToken(endpoint: string, publicKey: string, privateKey: string, subject: string, now = Date.now()): string {
  const pub = b64url.decode(publicKey);
  const key = createPrivateKey({
    key: { kty: "EC", crv: "P-256", x: b64url.encode(pub.subarray(1, 33)), y: b64url.encode(pub.subarray(33, 65)), d: privateKey },
    format: "jwk",
  });
  const part = (o: object) => b64url.encode(Buffer.from(JSON.stringify(o)));
  const unsigned = `${part({ typ: "JWT", alg: "ES256" })}.${part({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })}`;
  const sig = sign("sha256", Buffer.from(unsigned), { key, dsaEncoding: "ieee-p1363" });
  return `${unsigned}.${b64url.encode(sig)}`;
}

export interface PushTarget {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Sends one message. Returns the HTTP status (201 = delivered; 404 or 410 = the phone has turned alerts off). */
export async function sendPush(
  target: PushTarget,
  message: object,
  vapid: { publicKey: string; privateKey: string },
  subject: string,
  ttlSeconds = 12 * 3600,
): Promise<number> {
  const body = encrypt(Buffer.from(JSON.stringify(message)), target.keys.p256dh, target.keys.auth);
  const res = await fetch(target.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${vapidToken(target.endpoint, vapid.publicKey, vapid.privateKey, subject)}, k=${vapid.publicKey}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(ttlSeconds),
      Urgency: "high",
    },
    body,
  });
  return res.status;
}
