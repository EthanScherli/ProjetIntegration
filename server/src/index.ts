import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { pool } from "./db.js";

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/db-check", async (_req, res) => {
  const result = await pool.query('select count(*) from "Utilisateurs"');
  res.json(result.rows[0]);
});

app.listen(Number(process.env.PORT), () => {
  console.log(`API sur http://localhost:${process.env.PORT}`);
});