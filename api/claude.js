const https = require("https");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "NO API KEY FOUND" });

  const body = JSON.stringify(req.body);

  return new Promise((resolve) => {
    const options = {
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const request = https.request(options, (response) => {
      let raw = "";
      response.on("data", (chunk) => { raw += chunk; });
      response.on("end", () => {
        try {
          const parsed = JSON.parse(raw);
          res.status(response.statusCode).json(parsed);
        } catch (e) {
          res.status(500).json({ error: "Parse error: " + raw });
        }
        resolve();
      });
    });

    request.on("error", (err) => {
      res.status(500).json({ error: "Request error: " + err.message });
      resolve();
    });

    request.write(body);
    request.end();
  });
};
