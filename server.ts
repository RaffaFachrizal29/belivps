import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

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

  app.post("/api/orders/:id/email", async (req, res) => {
    const order: any = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    try {
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn("SMTP credentials not configured. Simulating email send.");
        await new Promise(resolve => setTimeout(resolve, 1500));
        return res.json({ success: true, simulated: true });
      }

      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const isConfirmed = order.status === 'CONFIRMED';
      const subject = isConfirmed ? `Informasi Login VPS Rffnet - #${order.id}` : `Struk Pembelian VPS Rffnet - #${order.id}`;
      
      let htmlContent = '';
      if (isConfirmed) {
        htmlContent = `
          <div style="font-family: monospace; max-width: 600px; margin: 0 auto; border: 2px solid #000; padding: 20px;">
            <h2 style="text-align: center; color: green;">VPS AKTIF!</h2>
            <p><strong>ID Pesanan:</strong> ${order.id}</p>
            <h3>Spesifikasi</h3>
            <p>RAM: ${order.ram_label} | CPU: ${order.cpu_cores} Core</p>
            <p>Network: ${order.has_ipv4 ? 'IPv6 + IPv4' : 'IPv6 Only'}</p>
            ${order.domain ? `<p>Domain: ${order.domain}.my.id</p>` : ''}
            <hr/>
            <h3>Akses Login</h3>
            <p><strong>IP IPv6:</strong> ${order.ipv6}</p>
            ${order.ipv4_addr ? `<p><strong>IP IPv4:</strong> ${order.ipv4_addr}</p>` : ''}
            <p><strong>Username:</strong> ${order.username}</p>
            <p><strong>Password:</strong> ${order.password}</p>
            <hr/>
            <p style="text-align: center; font-size: 12px; color: #666;">Berlaku hingga: ${new Date(new Date(order.created_at).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('id-ID')}</p>
          </div>
        `;
      } else {
        htmlContent = `
          <div style="font-family: monospace; max-width: 600px; margin: 0 auto; border: 2px solid #000; padding: 20px;">
            <h2 style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px;">RFFNET VPS - STRUK #${order.id}</h2>
            <p><strong>Nama:</strong> ${order.name}</p>
            <p><strong>Email:</strong> ${order.email}</p>
            <hr style="border: 1px dashed #ccc;" />
            <p><strong>RAM ${order.ram_label}:</strong> Rp ${order.ram_price.toLocaleString('id-ID')}</p>
            <p><strong>CPU ${order.cpu_cores} Core:</strong> Rp ${order.cpu_price.toLocaleString('id-ID')}</p>
            ${order.has_ipv4 ? `<p><strong>IPv4 Topping:</strong> Rp 80.000</p>` : ''}
            <hr style="border: 2px solid #000;" />
            <h3><strong>TOTAL: Rp ${order.total_price.toLocaleString('id-ID')}</strong></h3>
            <div style="background-color: #FFE600; padding: 15px; border: 2px solid #000; margin-top: 20px; text-align: center;">
              <p><strong>Tata Cara Pembayaran</strong></p>
              <p>Transfer GoPay ke Admin: <strong>Raffa F (083848222110)</strong></p>
              <p>Kirim screenshot bukti pembayaran ke WhatsApp tersebut.</p>
            </div>
          </div>
        `;
      }

      await transporter.sendMail({
        from: `"Rffnet VPS" <${process.env.SMTP_USER}>`,
        to: order.email,
        subject: subject,
        html: htmlContent
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Email error:", error);
      res.status(500).json({ error: "Failed to send email" });
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

  app.listen(PORT, "::0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
