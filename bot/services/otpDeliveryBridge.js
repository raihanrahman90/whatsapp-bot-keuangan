const crypto = require("crypto");
const http = require("http");
const { sendOtp } = require("./otpDeliveryService");

const MAX_BODY_BYTES = 16 * 1024;

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function hasValidSecret(request, secret) {
  const authorization = request.headers.authorization || "";
  const provided = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  const expectedBuffer = Buffer.from(secret);
  const providedBuffer = Buffer.from(provided);

  return (
    expectedBuffer.length === providedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
        reject(new Error("Request body is too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("Request body must be valid JSON"));
      }
    });
    request.on("error", reject);
  });
}

function startOtpDeliveryBridge({ getSocket, isWhatsAppConnected }) {
  const secret = process.env.OTP_BRIDGE_SECRET;
  const port = Number(process.env.OTP_BRIDGE_PORT || 3000);

  if (!secret) {
    throw new Error("OTP_BRIDGE_SECRET must be configured");
  }

  const server = http.createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/internal/otp") {
      return sendJson(response, 404, { error: "Not found" });
    }

    if (!hasValidSecret(request, secret)) {
      return sendJson(response, 401, { error: "Unauthorized" });
    }

    if (!isWhatsAppConnected()) {
      return sendJson(response, 503, { error: "WhatsApp bot is not connected" });
    }

    try {
      const { phoneNumber, code, expiresInMinutes } = await readJson(request);
      await sendOtp(getSocket(), phoneNumber, code, expiresInMinutes);

      return sendJson(response, 202, { status: "sent" });
    } catch (error) {
      console.error("OTP delivery failed:", error.message);
      return sendJson(response, 400, { error: error.message || "Unable to deliver OTP" });
    }
  });

  server.listen(port, () => {
    console.log(`OTP delivery bridge listening on port ${port}`);
  });

  return server;
}

module.exports = {
  startOtpDeliveryBridge
};
