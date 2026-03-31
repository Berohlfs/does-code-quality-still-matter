const path = require("path");

// Load Vercel env vars from .env.local
require("dotenv").config({ path: path.join(__dirname, ".env.local") });

const express = require("express");
const app = require("./api/index");

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
