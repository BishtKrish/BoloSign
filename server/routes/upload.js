const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { PDFDocument } = require("pdf-lib");
const mongoose = require("mongoose");
const { Document } = require("../models/Document");

const router = express.Router();


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../uploads/pdfs");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, 
});


router.post("/", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF file uploaded" });
    }

    const pdfPath = req.file.path;
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    const pageCount = pdfDoc.getPageCount();
    const pageDimensions = [];

    
    for (let i = 0; i < pageCount; i++) {
      const page = pdfDoc.getPage(i);
      const { width, height } = page.getSize();
      pageDimensions.push({ width, height });
    }

    
    let documentRecord = null;
    if (mongoose.connection.readyState === 1) {
      documentRecord = new Document({
        filename: req.file.filename,
        originalName: req.file.originalname,
        filePath: req.file.path,
        pageCount,
        pageDimensions,
      });
      await documentRecord.save();
    }

    res.json({
      success: true,
      document: {
        id: documentRecord?._id || req.file.filename,
        filename: req.file.filename,
        originalName: req.file.originalname,
        pageCount,
        pageDimensions,
        url: `/uploads/pdfs/${req.file.filename}`,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    res
      .status(500)
      .json({ error: "Failed to process PDF", details: error.message });
  }
});

module.exports = router;
