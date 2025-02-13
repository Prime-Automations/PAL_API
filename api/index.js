require("dotenv").config();
const express = require("express");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;
const { Pool } = require("pg");
const cors = require("cors");
const fs = require("fs");

const app = express();

// Enable CORS for local testing
app.use(cors());
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// Cloudinary Config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "blog-news-uploads",
    format: async () => "png",
    public_id: (req, file) => file.fieldname + "-" + Date.now(),
  },
});

const upload = multer({ storage });

// PostgreSQL Config (Neon.tech)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

// 🏠 **Root Route**
app.get("/", (req, res) => {
  res.send("PAL API is running...");
});

// 📤 **Upload Route (Supports JSON & Image)**
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    console.log("Request body:", req.body);
    console.log("File:", req.file);

    // Get metadata JSON
    let metadata = req.body.metadata;
    if (metadata) {
      metadata = JSON.parse(metadata);
    } else {
      metadata = {};
    }

    // Get file URL
    const imageUrl = req.file ? req.file.path : null;

    const { title, content, type, published } = metadata;
    const uploadDate = new Date();

    const result = await pool.query(
      "INSERT INTO articles (title, content, image_url, category, is_published, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [title, content, imageUrl, type, published, uploadDate]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📥 **Get All Articles**
app.get("/articles", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM articles ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📥 **Get Single Article**
app.get("/articles/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM articles WHERE id = $1", [
      id,
    ]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✏️ **Update Article**
app.put("/articles/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, type, published } = req.body;

    const result = await pool.query(
      "UPDATE articles SET title=$1, content=$2, category=$3, is_published=$4, created_at=NOW() WHERE id=$5 RETURNING *",
      [title, content, type, published, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ❌ **Delete Article**
app.delete("/articles/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM articles WHERE id = $1", [id]);
    res.json({ message: "Article deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🚀 **Start Server (Local Development)**
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

module.exports = app; // For Vercel deployment
