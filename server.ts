import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database("rffnet.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    name TEXT,
    phone TEXT,
    email TEXT,
    username TEXT,
    password TEXT,
    ram_label TEXT,
    ram_price INTEGER,
    cpu_cores INTEGER,
    cpu_price INTEGER,
    has_ipv4 INTEGER,
    ipv4_price INTEGER,
    total_price INTEGER,
    status TEXT DEFAULT 'PENDING',
    ipv6 TEXT,
    ipv4_addr TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Migration: Add domain column if it doesn't exist
const tableInfo = db.prepare("PRAGMA table_info(orders)").all();
const hasDomain = tableInfo.some((col: any) => col.name === "domain");
if (!hasDomain) {
  db.exec("ALTER TABLE orders ADD COLUMN domain TEXT");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  // API Routes
  app.post("/api/orders", (req, res) => {
    const { id, name, phone, email, username, password, domain, ram_label, ram_price, cpu_cores, cpu_price, has_ipv4, ipv4_price, total_price } = req.body;
    try {
      const stmt = db.prepare(`
        INSERT INTO orders (id, name, phone, email, username, password, domain, ram_label, ram_price, cpu_cores, cpu_price, has_ipv4, ipv4_price, total_price)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(id, name, phone, email, username, password, domain || null, ram_label, ram_price, cpu_cores, cpu_price, has_ipv4 ? 1 : 0, ipv4_price, total_price);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  app.get("/api/orders/:id", (req, res) => {
    const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
    if (order) {
      res.json(order);
    } else {
      res.status(404).json({ error: "Order not found" });
    }
  });

  // Admin Routes
  app.post("/api/admin/login", (req, res) => {
    const { username, password } = req.body;
    if (username === "admin" && password === "P@ssw0rd") {
      res.cookie("admin_token", "secret_token", { httpOnly: true, sameSite: 'none', secure: true });
      res.json({ success: true });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  const authMiddleware = (req: any, res: any, next: any) => {
    if (req.cookies.admin_token === "secret_token") {
      next();
    } else {
      res.status(401).json({ error: "Unauthorized" });
    }
  };

  app.get("/api/admin/orders", authMiddleware, (req, res) => {
    const orders = db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
    res.json(orders);
  });

  app.post("/api/admin/confirm/:id", authMiddleware, (req, res) => {
    const { ipv6, ipv4_addr } = req.body;
    try {
      const stmt = db.prepare("UPDATE orders SET status = 'CONFIRMED', ipv6 = ?, ipv4_addr = ? WHERE id = ?");
      stmt.run(ipv6, ipv4_addr || null, req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to confirm order" });
    }
  });

  app.delete("/api/admin/orders/:id", authMiddleware, (req, res) => {
    try {
      db.prepare("DELETE FROM orders WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete order" });
    }
  });

  app.post("/api/admin/logout", (req, res) => {
    res.clearCookie("admin_token");
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
