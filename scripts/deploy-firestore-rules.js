#!/usr/bin/env node
/**
 * Deploy firestore.rules via Firebase Rules API (service account).
 * Usage: node scripts/deploy-firestore-rules.js
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const PROJECT_ID = "madecare-9b986";
const RULES_PATH = path.join(__dirname, "..", "firestore.rules");
const SA_PATH = path.join(__dirname, "..", ".firebase-sa.json");

function request(method, urlPath, token, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: "firebaserules.googleapis.com",
        path: urlPath,
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          const parsed = data ? JSON.parse(data) : {};
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            return;
          }
          resolve(parsed);
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function getAccessToken() {
  const serverModules = path.join(__dirname, "..", "server", "node_modules");
  const { GoogleAuth } = require(require.resolve("google-auth-library", {
    paths: [serverModules, __dirname],
  }));
  const auth = new GoogleAuth({
    keyFile: SA_PATH,
    scopes: [
      "https://www.googleapis.com/auth/cloud-platform",
      "https://www.googleapis.com/auth/firebase",
    ],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error("Failed to obtain access token");
  return token.token;
}

async function main() {
  if (!fs.existsSync(SA_PATH)) {
    throw new Error(`Missing service account at ${SA_PATH}`);
  }

  const rulesContent = fs.readFileSync(RULES_PATH, "utf8");
  const token = await getAccessToken();

  console.log("[deploy] Creating ruleset...");
  const ruleset = await request(
    "POST",
    `/v1/projects/${PROJECT_ID}/rulesets`,
    token,
    {
      source: {
        files: [{ name: "firestore.rules", content: rulesContent }],
      },
    }
  );

  const rulesetName = ruleset.name;
  if (!rulesetName) throw new Error("Ruleset creation returned no name");
  console.log("[deploy] Ruleset:", rulesetName);

  console.log("[deploy] Publishing release for cloud.firestore...");
  const releaseName = `projects/${PROJECT_ID}/releases/cloud.firestore`;
  let release;
  try {
    release = await request(
      "PATCH",
      `/v1/${releaseName}?updateMask=rulesetName`,
      token,
      {
        release: {
          name: releaseName,
          rulesetName,
        },
      }
    );
  } catch (err) {
    if (!String(err.message).includes("404")) throw err;
    release = await request("POST", `/v1/projects/${PROJECT_ID}/releases`, token, {
      name: releaseName,
      rulesetName,
    });
  }

  console.log("[deploy] ✅ Release published:", release.name || release);
}

main().catch((err) => {
  console.error("[deploy] ❌", err.message);
  process.exit(1);
});
