import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "./db.js";

const app = express();

const JWT_SECRET = process.env.JWT_SECRET!;
const COOKIE_NAME = "token";
const SESSION_DAYS = 7;
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(cookieParser());

app.get("/", (_req, res) => {
  res.send("API Express opérationnelle");
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/db-check", async (_req, res) => {
  const result = await pool.query('select count(*) from "Utilisateurs"');
  res.json(result.rows[0]);
});


function setSessionCookie(res: express.Response, userId: string) {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET est manquant dans les variables d'environnement.");
  }

  const token = jwt.sign(
      { id: userId },
      JWT_SECRET,
      { expiresIn: `${SESSION_DAYS}d` }
  );

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: false, // Temporaire HTTP
    sameSite: "lax",
    path: "/",
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
    const result = await pool.query(`
      SELECT 
        u."id_Ut", u.pseudo, u.mail, 
        f."id_Famille", f."Type_Membre",
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
      famille: user.famille,
      isChef: user.Type_Membre === 1 || user.Type_Membre === '1',
      hasFamily: user.id_Famille !== null
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
  if (!pseudo || typeof pseudo !== "string" || !pseudo.trim()) return res.status(400).json({ error: "Pseudo invalide." });

  try {
    const targetRes = await pool.query('SELECT "id_Ut", pseudo FROM "Utilisateurs" WHERE pseudo = $1', [pseudo.trim()]);
    const targetUser = targetRes.rows[0];

    if (!targetUser) return res.status(404).json({ error: "Utilisateur introuvable." });
    if (targetUser.id_Ut === userId) return res.status(400).json({ error: "Vous ne pouvez pas vous ajouter vous-même." });

    const targetFamRes = await pool.query('SELECT 1 FROM "Famille" WHERE "id_Ut" = $1', [targetUser.id_Ut]);
    if (targetFamRes.rowCount! > 0) return res.status(400).json({ error: "Cet utilisateur est déjà dans une famille." });

    let myFamRes = await pool.query('SELECT "id_Famille", "Type_Membre" FROM "Famille" WHERE "id_Ut" = $1', [userId]);
    let idFamille;

    if (myFamRes.rowCount === 0) {
      idFamille = userId;
      await pool.query('INSERT INTO "Famille" ("id_Ut", "id_Famille", "Type_Membre") VALUES ($1, $2, $3)', [userId, idFamille, 1]);
    } else {
      idFamille = myFamRes.rows[0].id_Famille;
      if (myFamRes.rows[0].Type_Membre !== '1' && myFamRes.rows[0].Type_Membre !== 1) {
         return res.status(403).json({ error: "Seul le chef de famille peut inviter des membres." });
      }
    }

    await pool.query('INSERT INTO "Famille" ("id_Ut", "id_Famille", "Type_Membre") VALUES ($1, $2, $3)', [targetUser.id_Ut, idFamille, 2]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur lors de l'ajout à la famille." });
  }
});

app.post("/api/family/remove", async (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: "Non connecté." });

  const { pseudo } = req.body ?? {};
  if (!pseudo || typeof pseudo !== "string" || !pseudo.trim()) return res.status(400).json({ error: "Pseudo invalide." });

  try {
    const myFamRes = await pool.query('SELECT "id_Famille", "Type_Membre" FROM "Famille" WHERE "id_Ut" = $1', [userId]);
    if (myFamRes.rowCount === 0 || (myFamRes.rows[0].Type_Membre !== 1 && myFamRes.rows[0].Type_Membre !== '1')) {
      return res.status(403).json({ error: "Seul le chef de famille peut retirer des membres." });
    }
    
    const idFamille = myFamRes.rows[0].id_Famille;
    const targetRes = await pool.query('SELECT "id_Ut" FROM "Utilisateurs" WHERE pseudo = $1', [pseudo.trim()]);
    if (targetRes.rowCount === 0) return res.status(404).json({ error: "Utilisateur introuvable." });
    
    const targetId = targetRes.rows[0].id_Ut;
    if (targetId === userId) return res.status(400).json({ error: "Vous ne pouvez pas vous retirer vous-même." });

    const deleteRes = await pool.query('DELETE FROM "Famille" WHERE "id_Ut" = $1 AND "id_Famille" = $2', [targetId, idFamille]);
    if (deleteRes.rowCount === 0) return res.status(400).json({ error: "Ce membre n'est pas dans votre famille." });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur lors de la suppression." });
  }
});

app.post("/api/family/disband", async (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: "Non connecté." });

  try {
    const myFamRes = await pool.query('SELECT "id_Famille", "Type_Membre" FROM "Famille" WHERE "id_Ut" = $1', [userId]);
    if (myFamRes.rowCount === 0) return res.status(400).json({ error: "Vous n'êtes pas dans une famille." });
    if (myFamRes.rows[0].Type_Membre !== '1' && myFamRes.rows[0].Type_Membre !== 1) {
      return res.status(403).json({ error: "Seul le chef peut dissoudre la famille." });
    }
    
    await pool.query('DELETE FROM "Famille" WHERE "id_Famille" = $1', [myFamRes.rows[0].id_Famille]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la dissolution." });
  }
});

app.post("/api/family/leave", async (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: "Non connecté." });

  try {
    const myFamRes = await pool.query('SELECT "id_Famille", "Type_Membre" FROM "Famille" WHERE "id_Ut" = $1', [userId]);
    if (myFamRes.rowCount === 0) return res.status(400).json({ error: "Vous n'êtes pas dans une famille." });
    if (myFamRes.rows[0].Type_Membre === '1' || myFamRes.rows[0].Type_Membre === 1) {
      return res.status(400).json({ error: "Le chef ne peut pas quitter la famille (utilisez dissoudre)." });
    }
    
    await pool.query('DELETE FROM "Famille" WHERE "id_Ut" = $1', [userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors du départ de la famille." });
  }
});

app.get("/api/family/members", async (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: "Non connecté." });

  try {
    const famRes = await pool.query('SELECT "id_Famille" FROM "Famille" WHERE "id_Ut" = $1', [userId]);
    if (famRes.rowCount === 0) return res.json([]);
    
    const idFamille = famRes.rows[0].id_Famille;

    const membersRes = await pool.query(`
      SELECT u.pseudo, f."Type_Membre"
      FROM "Famille" f
      JOIN "Utilisateurs" u ON f."id_Ut" = u."id_Ut"
      WHERE f."id_Famille" = $1
      ORDER BY f."Type_Membre" ASC
    `, [idFamille]);

    const members = membersRes.rows.map(row => ({
      pseudo: row.pseudo,
      isChef: row.Type_Membre === 1 || row.Type_Membre === '1'
    }));

    res.json(members);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});


app.get("/api/donnees-capteurs/24h", async (req, res) => {

  const userId = getSessionUserId(req);

  if (!userId) {
    return res.status(401).json({ error: "Non connecté." });
  }

  try {
    const result = await pool.query(`
      SELECT temperature, luminosite, humidite, created_at
      FROM "Donnees_Capteurs"
      WHERE "id_Ut" = $1
      AND created_at >= NOW() - INTERVAL '24 hours'
      ORDER BY created_at ASC
    `, [userId]);

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

app.get("/api/donnees-capteurs/week", async (req, res) => {
  const userId = getSessionUserId(req);

  if (!userId) {
    return res.status(401).json({ error: "Non connecté." });
  }

  try {
    const result = await pool.query(`
      SELECT temperature, luminosite, humidite, created_at
      FROM "Donnees_Capteurs"
      WHERE "id_Ut" = $1
      AND created_at >= NOW() - INTERVAL '7 days'
      ORDER BY created_at ASC
    `, [userId]);

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur." });
  }
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
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
  });

  res.json({ ok: true });
});

// ROUTES POUR LA MUE

app.get("/api/mue/active", async (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: "Non autorisé" });

  try {
    const result = await pool.query(
      'SELECT * FROM "Mue" WHERE "statut" = \'EN_COURS\' AND "id_Ut" = $1 LIMIT 1',
      [userId]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur lors de la récupération." });
  }
});

app.post("/api/mue/demarrer", async (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: "Non autorisé" });

  try {
    const activeRes = await pool.query(
      'SELECT "id_mue" FROM "Mue" WHERE "statut" = \'EN_COURS\' AND "id_Ut" = $1 LIMIT 1',
      [userId]
    );
    if (activeRes.rows.length > 0) {
      return res.status(400).json({ error: "Une mue est déjà en cours." });
    }

    const result = await pool.query(
      'INSERT INTO "Mue" ("date_debut", "statut", "id_Ut") VALUES (NOW(), \'EN_COURS\', $1) RETURNING *',
      [userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur lors du démarrage de la mue." });
  }
});

app.post("/api/mue/terminer", async (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: "Non autorisé" });

  const { id_mue } = req.body ?? {};

  try {
    let result;

    if (id_mue) {
      // Clôture d'une mue précise en vérifiant qu'elle appartient bien à l'utilisateur
      result = await pool.query(
        'UPDATE "Mue" SET "date_fin" = NOW(), "statut" = \'TERMINEE\' WHERE "id_mue" = $1 AND "id_Ut" = $2 RETURNING *',
        [id_mue, userId]
      );
    } else {
      // Clôture automatique de la mue active de l'utilisateur uniquement
      result = await pool.query(
        'UPDATE "Mue" SET "date_fin" = NOW(), "statut" = \'TERMINEE\' WHERE "statut" = \'EN_COURS\' AND "id_Ut" = $1 RETURNING *',
        [userId]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Aucune mue active à clôturer pour cet utilisateur." });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur lors de la clôture de la mue." });
  }
});

app.get("/api/mue/historique", async (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: "Non autorisé" });

  try {
    const result = await pool.query(
      'SELECT * FROM "Mue" WHERE "id_Ut" = $1 ORDER BY "date_debut" DESC',
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur lors de la récupération de l'historique." });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API démarrée sur le port ${PORT}`);
});
