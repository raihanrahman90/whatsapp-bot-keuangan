const crypto = require("crypto");

function parseCookies(cookieHeader) {
  return String(cookieHeader || "")
    .split(";")
    .reduce((cookies, item) => {
      const separator = item.indexOf("=");
      if (separator === -1) return cookies;

      const name = item.slice(0, separator).trim();
      const value = item.slice(separator + 1).trim();
      if (name) cookies[name] = value;
      return cookies;
    }, {});
}

function verifySessionToken(token) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !token) return null;

  const [payload, signature, ...extraParts] = token.split(".");
  if (!payload || !signature || extraParts.length > 0) return null;

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!/^\d{8,15}$/.test(session.sub) || !Number.isFinite(session.exp)) {
      return null;
    }
    if (session.exp <= Date.now()) return null;
    return { phoneNumber: session.sub };
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const { session } = parseCookies(req.headers.cookie);
  const authenticatedUser = verifySessionToken(session);

  if (!authenticatedUser) {
    return res.status(401).json({ error: "Authentication required" });
  }

  req.auth = authenticatedUser;
  return next();
}

module.exports = {
  requireAuth,
  verifySessionToken
};
