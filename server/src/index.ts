import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "./db.js";

const app = express();

const JWT_SECRET = process.env.JWT_SECRET!;
const COOKIE_NAME = "token";
const SESSION_DAYS = 7;

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/", (_req, res) => {
  res.redirect(process.env.CLIENT_URL ?? "http://localhost:5173");
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/db-check", async (_req, res) => {
  const result = await pool.query('select count(*) from "Utilisateurs"');
  res.json(result.rows[0]);
});

function setSessionCookie(res: express.Response, userId: string) {
  const token = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: `${SESSION_DAYS}d` });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  });
}

app.post("/api/register", async (req, res) => {
  const { pseudo, mail, mdp } = req.body ?? {};

  if (typeof pseudo !== "string" || typeof mail !== "string" || typeof mdp !== "string" || !pseudo.trim() || !mail.trim()) {
    return res.status(400).json({ error: "Pseudo, email et mot de passe sont requis." });
  }
  if (mdp.length < 6) {
    return res.status(400).json({ error: "Le mot de passe doit contenir au moins 6 caractères." });
  }

  try {
    const hash = await bcrypt.hash(mdp, 10);
    const result = await pool.query(
      'insert into "Utilisateurs" (pseudo, mail, mdp) values ($1, $2, $3) returning "id_Ut", pseudo, mail',
      [pseudo.trim(), mail.trim().toLowerCase(), hash],
    );
    const user = result.rows[0];
    setSessionCookie(res, user.id_Ut);
    res.status(201).json({ id: user.id_Ut, pseudo: user.pseudo, mail: user.mail });
  } catch (err: any) {
    if (err.code === "23505") {
      const champ = String(err.constraint).includes("pseudo") ? "Ce pseudo" : "Cet email";
      return res.status(409).json({ error: `${champ} est déjà utilisé.` });
    }
    console.error(err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

app.post("/api/login", async (req, res) => {
  const { mail, mdp } = req.body ?? {};
  if (typeof mail !== "string" || typeof mdp !== "string") {
    return res.status(400).json({ error: "Email et mot de passe sont requis." });
  }

  try {
    const result = await pool.query(
      'select "id_Ut", pseudo, mail, mdp from "Utilisateurs" where mail = $1',
      [mail.trim().toLowerCase()],
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(mdp, user.mdp))) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect." });
    }
    setSessionCookie(res, user.id_Ut);
    res.json({ id: user.id_Ut, pseudo: user.pseudo, mail: user.mail });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

function getSessionUserId(req: express.Request): string | null {
  try {
    const { id } = jwt.verify(req.cookies[COOKIE_NAME], JWT_SECRET) as { id: string };
    return id;
  } catch {
    return null;
  }
}

async function isAdmin(userId: string) {
  const result = await pool.query('select 1 from "Admin" where "id_Ut" = $1', [userId]);
  return result.rowCount! > 0;
}

async function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: "Non connecté." });
  try {
    if (!(await isAdmin(userId))) return res.status(403).json({ error: "Accès réservé aux administrateurs." });
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur." });
  }
}

// ==========================================
// ROUTES FAMILLE ET PROFIL
// ==========================================

app.get("/api/me", async (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: "Non connecté." });
  
  try {
    // On cherche l'utilisateur, et s'il est dans une famille, on cherche le pseudo du chef de cette famille
    const result = await pool.query(`
      SELECT 
        u."id_Ut", u.pseudo, u.mail, 
        f."id_Famille",
        chef.pseudo as famille
      FROM "Utilisateurs" u
      LEFT JOIN "Famille" f ON u."id_Ut" = f."id_Ut"
      LEFT JOIN "Famille" f_chef ON f."id_Famille" = f_chef."id_Famille" AND f_chef."Type_Membre" = 1
      LEFT JOIN "Utilisateurs" chef ON f_chef."id_Ut" = chef."id_Ut"
      WHERE u."id_Ut" = $1
    `, [userId]);
    
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: "Non connecté." });
    
    res.json({ 
      id: user.id_Ut, 
      pseudo: user.pseudo, 
      mail: user.mail, 
      isAdmin: await isAdmin(userId), 
      famille: user.famille 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

app.post("/api/family/add", async (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: "Non connecté." });

  const { pseudo } = req.body ?? {};
  if (!pseudo || typeof pseudo !== "string" || !pseudo.trim()) {
    return res.status(400).json({ error: "Pseudo invalide." });
  }

  try {
    // 1. Chercher l'utilisateur cible
    const targetRes = await pool.query('SELECT "id_Ut", pseudo FROM "Utilisateurs" WHERE pseudo = $1', [pseudo.trim()]);
    const targetUser = targetRes.rows[0];

    if (!targetUser) return res.status(404).json({ error: "Utilisateur introuvable." });
    if (targetUser.id_Ut === userId) return res.status(400).json({ error: "Vous ne pouvez pas vous ajouter vous-même." });

    // 2. Vérifier si l'utilisateur cible est déjà dans une famille
    const targetFamRes = await pool.query('SELECT 1 FROM "Famille" WHERE "id_Ut" = $1', [targetUser.id_Ut]);
    if (targetFamRes.rowCount! > 0) return res.status(400).json({ error: "Cet utilisateur est déjà dans une famille." });

    // 3. Récupérer ou créer la famille pour l'utilisateur actuel
    let myFamRes = await pool.query('SELECT "id_Famille", "Type_Membre" FROM "Famille" WHERE "id_Ut" = $1', [userId]);
    let idFamille;

    if (myFamRes.rowCount === 0) {
      // S'il n'a pas de famille, on en crée une
      idFamille = userId;
      // On l'ajoute comme chef (Type_Membre = 1 par exemple)
      await pool.query('INSERT INTO "Famille" ("id_Ut", "id_Famille", "Type_Membre") VALUES ($1, $2, $3)', [userId, idFamille, 1]);
    } else {
      idFamille = myFamRes.rows[0].id_Famille;
      // Vérifier s'il est bien le chef (Type_Membre === 1) pour avoir le droit d'inviter
      if (myFamRes.rows[0].Type_Membre !== '1' && myFamRes.rows[0].Type_Membre !== 1) {
         return res.status(403).json({ error: "Seul le chef de famille peut inviter des membres." });
      }
    }

    // 4. Ajouter le nouveau membre à la famille (Type_Membre = 2 pour un membre classique)
    await pool.query('INSERT INTO "Famille" ("id_Ut", "id_Famille", "Type_Membre") VALUES ($1, $2, $3)', [targetUser.id_Ut, idFamille, 2]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur lors de l'ajout à la famille." });
  }
});



app.get("/api/donnees-capteurs", async (_req, res) => {
  res.json([{
    id_mesure: 1,
    temperature: 26.5,
    humidite: 70,
    luminosite: 80
  }]);
});

app.get("/api/historique-images", async (_req, res) => {
  res.json([]);
});

app.get("/api/users", requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      `select u."id_Ut", u.pseudo, u.mail, u.created_at, a."Admin_depuis"
       from "Utilisateurs" u
       left join "Admin" a on a."id_Ut" = u."id_Ut"
       order by u.created_at desc`,
    );
    res.json(
      result.rows.map((u) => ({
        id: u.id_Ut,
        pseudo: u.pseudo,
        mail: u.mail,
        createdAt: u.created_at,
        isAdmin: u.Admin_depuis !== null,
      })),
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

app.post("/api/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.listen(Number(process.env.PORT), () => {
  console.log(`API sur http://localhost:${process.env.PORT}`);
});