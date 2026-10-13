import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { respond } from "./handler.js";
const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "100kb" }));
app.use(rateLimit({ windowMs: 60000, limit: 120 }));
app.all("*", async (req, res) => {
  const r = await respond({
    method: req.method,
    path: req.path,
    headers: { authorization: req.headers.authorization },
    query: req.query as Record<string, string>,
    body: req.body,
  });
  res.status(r.statusCode).type("json").send(r.body);
});
app.listen(Number(process.env.PORT || 3001), "127.0.0.1", () =>
  console.log("Church API http://localhost:3001"),
);
