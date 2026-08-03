const crypto = require("crypto");
const prisma = require("../../config/prisma");

function parseCookies(cookieHeader) {
  return String(cookieHeader || "").split(";").reduce((cookies, item) => {
    const separator = item.indexOf("=");
    if (separator === -1) return cookies;
    const name = item.slice(0, separator).trim();
    if (name) cookies[name] = item.slice(separator + 1).trim();
    return cookies;
  }, {});
}

function verifySessionToken(token) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !token) return null;
  const [payload, signature, ...extra] = token.split(".");
  if (!payload || !signature || extra.length) return null;

  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!/^\d{8,15}$/.test(session.sub) || !Number.isFinite(session.exp) || session.exp <= Date.now()) return null;
    return { phoneNumber: session.sub };
  } catch {
    return null;
  }
}

async function requireAuth(req, res, next) {
  const authenticatedUser = verifySessionToken(parseCookies(req.headers.cookie).session);
  if (!authenticatedUser) return res.status(401).json({ error: "Authentication required" });

  try {
    const user = await prisma.user.findUnique({
      where: { phoneNumber: authenticatedUser.phoneNumber },
      select: { id: true }
    });
    if (!user) return res.status(401).json({ error: "Authentication required" });
    req.auth = { ...authenticatedUser, userId: user.id };
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { requireAuth };
