const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
  },
  originalName: {
    type: String,
    required: true,
  },
  // Optional file path (kept for compatibility). Prefer storing fileData below.
  filePath: {
    type: String,
  },
  // Store file bytes directly in the database
  fileData: {
    type: Buffer,
  },
  contentType: {
    type: String,
  },
  pageCount: Number,
  pageDimensions: [
    {
      width: Number,
      height: Number,
    },
  ],
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
});

const fieldSchema = new mongoose.Schema({
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Document",
    required: true,
  },
  type: {
    type: String,
    enum: ["text", "signature", "image", "date", "radio", "checkbox"],
    required: true,
  },
  pageNumber: {
    type: Number,
    required: true,
  },
  
  browserCoordinates: {
    x: Number,
    y: Number,
    width: Number,
    height: Number,
    viewportWidth: Number,
    viewportHeight: Number,
  },
  
  pdfCoordinates: {
    x: Number,
    y: Number,
    width: Number,
    height: Number,
  },
  value: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Document = mongoose.model("Document", documentSchema);
const Field = mongoose.model("Field", fieldSchema);

module.exports = { Document, Field };
