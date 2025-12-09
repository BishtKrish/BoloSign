const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { PDFDocument } = require("pdf-lib");
const mongoose = require("mongoose");
const { Document } = require("../models/Document");

const router = express.Router();


// Use memory storage so we can persist PDFs directly into MongoDB
const storage = multer.memoryStorage();

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

    // req.file.buffer contains the uploaded file bytes
    const pdfBytes = req.file.buffer;
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
      const filename = req.file.originalname || `upload-${Date.now()}`;
      documentRecord = new Document({
        filename,
        originalName: req.file.originalname,
        // keep filePath for backward compatibility when present
        filePath: null,
        fileData: pdfBytes,
        contentType: req.file.mimetype,
        pageCount,
        pageDimensions,
      });
      await documentRecord.save();
    }

    res.json({
      success: true,
      document: {
        id: documentRecord?._id,
        filename: documentRecord?.filename,
        originalName: documentRecord?.originalName,
        pageCount,
        pageDimensions,
        url: documentRecord ? `/api/upload/file/${documentRecord._id}` : null,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    res
      .status(500)
      .json({ error: "Failed to process PDF", details: error.message });
  }
});

// Serve stored PDF by document id
router.get("/file/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid document id" });
    }
    const doc = await Document.findById(id).exec();
    if (!doc || !doc.fileData) {
      return res.status(404).json({ error: "Document or file not found" });
    }
    res.setHeader("Content-Type", doc.contentType || "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${doc.originalName || doc.filename}"`);
    return res.send(doc.fileData);
  } catch (err) {
    console.error("Error serving file:", err);
    return res.status(500).json({ error: "Failed to retrieve file", details: err.message });
  }
});

module.exports = router;
