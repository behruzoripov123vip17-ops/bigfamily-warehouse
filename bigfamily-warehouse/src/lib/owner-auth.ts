import { createHash, timingSafeEqual } from "node:crypto";
// Shared by the page gate and the data boundary: a missing UI gate must not expose the DB.
export function ownerAuthorized(request: Request) {
  const password = process.env.BIGFAMILY_PASSWORD;
  if (!password) return false;
  const expected =
    "Basic " + Buffer.from("owner:" + password, "utf8").toString("base64");
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(
    digest(request.headers.get("authorization") ?? ""),
    digest(expected),
  );
}
