import { test } from "node:test";
import assert from "node:assert/strict";
import { createDecipheriv, createECDH, createPublicKey, generateKeyPairSync, hkdfSync, randomBytes, verify } from "node:crypto";
import { b64url, encrypt, vapidToken } from "./webpush";

/** Plays the phone: decrypts a message the way the browser would (RFC 8291). */
function decryptAsPhone(body: Buffer, phone: ReturnType<typeof createECDH>, auth: Buffer): string {
  const salt = body.subarray(0, 16);
  assert.equal(body.readUInt32BE(16), 4096);
  const idLen = body.readUInt8(20);
  const asPublic = body.subarray(21, 21 + idLen);
  const ciphertext = body.subarray(21 + idLen);
  const shared = phone.computeSecret(asPublic);
  const info = Buffer.concat([Buffer.from("WebPush: info\0"), phone.getPublicKey(), asPublic]);
  const ikm = Buffer.from(hkdfSync("sha256", shared, auth, info, 32));
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const d = createDecipheriv("aes-128-gcm", cek, nonce);
  d.setAuthTag(ciphertext.subarray(-16));
  const plain = Buffer.concat([d.update(ciphertext.subarray(0, -16)), d.final()]);
  assert.equal(plain[plain.length - 1], 2, "ends with the last-record marker");
  return plain.subarray(0, -1).toString("utf8");
}

test("web push: only the phone can read the alert", () => {
  const phone = createECDH("prime256v1");
  phone.generateKeys();
  const auth = randomBytes(16);
  const msg = JSON.stringify({ title: "Frost tonight, down to −1°C", body: "Protect before dark: Dahlia." });
  const body = encrypt(Buffer.from(msg), b64url.encode(phone.getPublicKey()), b64url.encode(auth));
  assert.equal(decryptAsPhone(body, phone, auth), msg);
  // A different phone can't.
  const other = createECDH("prime256v1");
  other.generateKeys();
  assert.throws(() => decryptAsPhone(body, other, auth));
});

test("web push: the signed token checks out with the public key", () => {
  // Keys made the way the phone makes them: raw public key and the private "d" value.
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = privateKey.export({ format: "jwk" });
  const raw = Buffer.concat([Buffer.from([4]), b64url.decode(jwk.x!), b64url.decode(jwk.y!)]);
  const now = Date.UTC(2026, 10, 8, 15, 20);
  const t = vapidToken("https://web.push.apple.com/QAbc123", b64url.encode(raw), jwk.d!, "https://stefdicembre.github.io/mary-mary/", now);
  const [h, c, s] = t.split(".");
  assert.deepEqual(JSON.parse(b64url.decode(h).toString()), { typ: "JWT", alg: "ES256" });
  const claims = JSON.parse(b64url.decode(c).toString());
  assert.equal(claims.aud, "https://web.push.apple.com");
  assert.equal(claims.exp, now / 1000 + 12 * 3600);
  assert.equal(claims.sub, "https://stefdicembre.github.io/mary-mary/");
  const ok = verify("sha256", Buffer.from(`${h}.${c}`), { key: createPublicKey(publicKey.export({ format: "pem", type: "spki" })), dsaEncoding: "ieee-p1363" }, b64url.decode(s));
  assert.equal(ok, true);
});

test("web push: matches the worked example in the standard (RFC 8291, appendix A)", () => {
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(b64url.decode("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw"));
  const out = encrypt(
    Buffer.from("When I grow up, I want to be a watermelon"),
    "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
    "BTBZMqHH6r4Tts7J_aSIgg",
    { salt: b64url.decode("DGv6ra1nlYgDCS1FRnbzlw"), ecdh },
  );
  assert.equal(
    b64url.encode(out),
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
  );
});
