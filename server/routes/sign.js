












const express = require("express");
const fs = require("fs");
const path = require("path");
const { PDFDocument, rgb } = require("pdf-lib");
const mongoose = require("mongoose");
const { Document, Field } = require("../models/Document");

const router = express.Router();











function convertToPdfCoordinates(coords, pdfPageHeight) {
  const { x, y, width, height } = coords;

  
  const pdfX = x;

  
  
  const pdfY = pdfPageHeight - y - height;

  
  const pdfW = width;
  const pH = height;

  
  console.log("🔄 Coordinate conversion:", {
    input: coords,
    pdfPageHeight,
    calculation: {
      "pdfPageHeight - y": pdfPageHeight - y,
      "pdfPageHeight - y - height": pdfPageHeight - y - height,
    },
    output: { x: pdfX, y: pdfY, width: pdfW, height: pH },
  });

  return { x: pdfX, y: pdfY, width: pdfW, height: pH };
}







function fitImageInBounds(imageWidth, imageHeight, boxWidth, boxHeight) {
  const imageAspect = imageWidth / imageHeight; 
  const boxAspect = boxWidth / boxHeight;

  let finalWidth, finalHeight, offsetX, offsetY;

  if (imageAspect > boxAspect) {
    
    finalWidth = boxWidth;
    finalHeight = boxWidth / imageAspect;
    offsetX = 0; 
    offsetY = (boxHeight - finalHeight) / 2; 
  } else {
    
    finalHeight = boxHeight;
    finalWidth = boxHeight * imageAspect;
    offsetX = (boxWidth - finalWidth) / 2; 
    offsetY = 0; 
  }

  return { finalWidth, finalHeight, offsetX, offsetY };
}






router.post("/", async (req, res) => {
  try {
    const {
      documentId,
      fields, 
      pdfFilename,
    } = req.body;

    
    if (!pdfFilename || !fields || !Array.isArray(fields)) {
      return res.status(400).json({
        error: "Missing required fields: documentId, fields, pdfFilename",
      });
    }

    // Try to load the PDF bytes from the DB (preferred) using documentId,
    // otherwise fall back to reading from disk using pdfFilename.
    let pdfBytes = null;
    if (mongoose.connection.readyState === 1 && documentId) {
      try {
        const docRecord = await Document.findById(documentId).exec();
        if (docRecord && docRecord.fileData && docRecord.fileData.length) {
          pdfBytes = docRecord.fileData;
        } else if (docRecord && docRecord.filePath && fs.existsSync(docRecord.filePath)) {
          pdfBytes = fs.readFileSync(docRecord.filePath);
        }
      } catch (dbErr) {
        console.warn("Error fetching document from DB:", dbErr.message);
      }
    }

    // If still not found, try loading from uploads/pdfs by filename (legacy behavior)
    if (!pdfBytes && pdfFilename) {
      const pdfPath = path.join(__dirname, "../../uploads/pdfs", pdfFilename);
      if (fs.existsSync(pdfPath)) {
        pdfBytes = fs.readFileSync(pdfPath);
      }
    }

    if (!pdfBytes) {
      return res.status(404).json({ error: "PDF file not found" });
    }

    const pdfDoc = await PDFDocument.load(pdfBytes);

    
    for (const field of fields) {
      const {
        type,
        pageNumber,
        browserCoordinates,
        containerDimensions,
        value,
      } = field;

      const page = pdfDoc.getPage(pageNumber - 1);
      const pageDimensions = page.getSize();

      
      const pdfCoords = convertToPdfCoordinates(
        browserCoordinates,
        pageDimensions.height
      );

      
      if (mongoose.connection.readyState === 1) {
        try {
          const fieldRecord = new Field({
            documentId,
            type,
            pageNumber,
            browserCoordinates: {
              ...browserCoordinates,
              viewportWidth: containerDimensions.width,
              viewportHeight: containerDimensions.height,
            },
            pdfCoordinates: pdfCoords,
            value: value || "",
          });
          await fieldRecord.save();
        } catch (dbError) {
          console.warn("Database save failed:", dbError.message);
        }
      }

      
      if (type === "signature" || type === "image") {
        if (value && value.startsWith("data:image")) {
          try {
            const base64Data = value.split(",")[1];
            const imageBuffer = Buffer.from(base64Data, "base64");

            let image;
            if (value.includes("image/png")) {
              image = await pdfDoc.embedPng(imageBuffer);
            } else if (
              value.includes("image/jpeg") ||
              value.includes("image/jpg")
            ) {
              image = await pdfDoc.embedJpg(imageBuffer);
            } else {
              console.warn("Unsupported image format");
              continue;
            }

            const imageDims = image.scale(1);
            const { finalWidth, finalHeight, offsetX, offsetY } =
              fitImageInBounds(
                imageDims.width,
                imageDims.height,
                pdfCoords.width,
                pdfCoords.height
              );

            page.drawImage(image, {
              x: pdfCoords.x + offsetX,
              y: pdfCoords.y + offsetY,
              width: finalWidth,
              height: finalHeight,
            });
          } catch (imgError) {
            console.error("Image embedding error:", imgError);
          }
        }
      } else if (type === "text" || type === "date") {
        if (value) {
          const fontSize = Math.min(pdfCoords.height * 0.7, 14);
          page.drawText(value, {
            x: pdfCoords.x + 2,
            y: pdfCoords.y + pdfCoords.height / 2 - fontSize / 3,
            size: fontSize,
            color: rgb(0, 0, 0),
          });
        }
      } else if (type === "checkbox") {
        
        const boxSize = Math.min(pdfCoords.width, pdfCoords.height) * 0.8;
        const centerX = pdfCoords.x + pdfCoords.width / 2 - boxSize / 2;
        const centerY = pdfCoords.y + pdfCoords.height / 2 - boxSize / 2;

        page.drawRectangle({
          x: centerX,
          y: centerY,
          width: boxSize,
          height: boxSize,
          borderColor: rgb(0, 0, 0),
          borderWidth: 1.5,
        });

        if (value === "checked") {
          
          page.drawText("✓", {
            x: centerX + boxSize * 0.15,
            y: centerY + boxSize * 0.1,
            size: boxSize * 0.8,
            color: rgb(0, 0, 0),
          });
        }
      } else if (type === "radio") {
        
        const radius = Math.min(pdfCoords.width, pdfCoords.height) * 0.35;
        const centerX = pdfCoords.x + pdfCoords.width / 2;
        const centerY = pdfCoords.y + pdfCoords.height / 2;

        page.drawCircle({
          x: centerX,
          y: centerY,
          size: radius,
          borderColor: rgb(0, 0, 0),
          borderWidth: 1.5,
        });

        if (value === "selected") {
          page.drawCircle({
            x: centerX,
            y: centerY,
            size: radius * 0.5,
            color: rgb(0, 0, 0),
          });
        }
      }
    }

    
     pdfBytes = await pdfDoc.save();
    const signedFilename = `signed-${Date.now()}-${path.basename(pdfFilename)}`;
    const signedPath = path.join(__dirname, "../../uploads/signed", signedFilename);

    const signedDir = path.dirname(signedPath);
    if (!fs.existsSync(signedDir)) {
      fs.mkdirSync(signedDir, { recursive: true });
    }

    // Write to disk for backward compatibility (may not be served on some hosts)
    try {
      fs.writeFileSync(signedPath, pdfBytes);
    } catch (e) {
      console.warn("Could not write signed PDF to disk:", e.message);
    }

    // Also return the signed PDF as base64 so clients can open it directly
    const fileBase64 = Buffer.from(pdfBytes).toString("base64");

    res.json({
      success: true,
      signedPdf: {
        filename: signedFilename,
        // keep url for deployments that can serve /uploads
        url: `/uploads/signed/${signedFilename}`,
        path: signedPath,
        fileBase64,
      },
    });
  } catch (error) {
    console.error("Sign PDF error:", error);
    res.status(500).json({
      error: "Failed to sign PDF",
      details: error.message,
    });
  }
});

module.exports = router;
