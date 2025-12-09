const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const uploadRoutes = require("./routes/upload");
const signRoutes = require("./routes/sign");

const app = express();

app.use(
  cors({
    origin: ["http://localhost:3001", "http://localhost:3000"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));


const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));


app.use("/api/upload", uploadRoutes);
app.use("/api/sign", signRoutes);


app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});


mongoose
  .connect(
    process.env.MONGODB_URI || "mongodb://localhost:27017/pdf-signature-db"
  )
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => {
    console.warn("MongoDB connection failed:", err.message);
    console.log("Running without database persistence");
  });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
