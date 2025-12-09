import React, { useState, useRef, useCallback, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import axios from "axios";
import FieldToolbar from "./FieldToolbar";
import SignatureModal from "./SignatureModal";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import "./PdfEditor.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const PdfEditor = ({ document, onBack }) => {
  // PDF document state
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Form fields state
  const [fields, setFields] = useState([]);
  const [selectedField, setSelectedField] = useState(null);
  const [draggingField, setDraggingField] = useState(null);
  const [resizingField, setResizingField] = useState(null);

  // UI state
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [pendingSignatureField, setPendingSignatureField] = useState(null);
  const [isSigning, setIsSigning] = useState(false);

  const [pdfPageDimensions, setPdfPageDimensions] = useState({
    width: 0,
    height: 0,
  });
  const [containerDimensions, setContainerDimensions] = useState({
    width: 0,
    height: 0,
  });
  const [canvasOffset, setCanvasOffset] = useState({ left: 0, top: 0 });
  const [pageScale, setPageScale] = useState(1);
  // DOM references
  const containerRef = useRef(null);
  const pageRef = useRef(null);
  const fieldIdCounter = useRef(0);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerDimensions({ width: rect.width, height: rect.height });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Update page dimensions when page changes
  useEffect(() => {
    if (pageRef.current && containerRef.current) {
      setTimeout(() => {
        const canvas = pageRef.current.querySelector("canvas");
        if (canvas) {
          const canvasRect = canvas.getBoundingClientRect();
          const containerRect = containerRef.current.getBoundingClientRect();

          const offset = {
            left: canvasRect.left - containerRect.left,
            top: canvasRect.top - containerRect.top,
          };

          setCanvasOffset(offset);

          // Recalculate scale if we have PDF dimensions
          if (pdfPageDimensions.width > 0) {
            const scale = canvasRect.width / pdfPageDimensions.width;
            setPageScale(scale);
          }
        }
      }, 100);
    }
  }, [currentPage, pdfPageDimensions.width]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const onPageLoadSuccess = (page) => {
    // Extract the original PDF page dimensions (in points, 72 DPI)
    // These are the "true" dimensions from the PDF file itself
    const originalWidth = page.originalWidth;
    const originalHeight = page.originalHeight;

    // Wait a moment for the page to fully render in the DOM
    // This ensures we can accurately measure the rendered canvas size
    setTimeout(() => {
      if (pageRef.current && containerRef.current) {
        const canvas = pageRef.current.querySelector("canvas");
        if (canvas) {
          const canvasRect = canvas.getBoundingClientRect();
          const containerRect = containerRef.current.getBoundingClientRect();

          const offset = {
            left: canvasRect.left - containerRect.left,
            top: canvasRect.top - containerRect.top,
          };

          // Calculate how much the PDF is zoomed/scaled for display
          // For example: if a 600pt PDF is rendered at 800px, scale = 800/600 = 1.33
          const scale = canvasRect.width / originalWidth;

          console.log("📄 Page loaded successfully:", {
            original: { width: originalWidth, height: originalHeight },
            rendered: { width: canvasRect.width, height: canvasRect.height },
            scale: scale,
            offset: offset,
          });

          setPdfPageDimensions({
            width: originalWidth,
            height: originalHeight,
          });
          setCanvasOffset(offset);
          setPageScale(scale);
        }
      }
    }, 100);
  };

  const handleToolbarDragStart = (e, fieldType) => {
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("fieldType", fieldType);
  };

  // Handle dropping a new field onto the PDF
  const handleContainerDrop = (e) => {
    e.preventDefault();
    const fieldType = e.dataTransfer.getData("fieldType");

    if (!fieldType) return; // Not a valid field drop

    // Find the PDF canvas element to get its position and size
    const canvas = pageRef.current?.querySelector("canvas");
    if (!canvas) return;

    const canvasRect = canvas.getBoundingClientRect();

    // Get the drop position in screen pixels (where the user dropped it)
    const pixelX = e.clientX - canvasRect.left;
    const pixelY = e.clientY - canvasRect.top;

    // Convert screen pixels to PDF points (device-independent coordinates)
    // This ensures the field appears in the same spot on any device
    const pdfX = pixelX / pageScale;
    const pdfY = pixelY / pageScale;

    // Set default sizes based on field type (in PDF points)
    // Checkboxes and radio buttons are smaller and square
    const defaultWidth =
      fieldType === "checkbox" || fieldType === "radio" ? 30 : 150;
    const defaultHeight =
      fieldType === "checkbox" || fieldType === "radio" ? 30 : 40;

    // Create the new field with all coordinates in PDF points
    const newField = {
      id: ++fieldIdCounter.current, // Unique identifier
      type: fieldType,
      x: pdfX, // Position in PDF points (not pixels!)
      y: pdfY,
      width: defaultWidth, // Size in PDF points (not pixels!)
      height: defaultHeight,
      page: currentPage, // Which page this field belongs to
      value: "", // Initial empty value
    };

    console.log("✅ New field added:", {
      type: fieldType,
      pixelPosition: { x: pixelX, y: pixelY },
      pdfPosition: { x: pdfX, y: pdfY },
      size: { width: defaultWidth, height: defaultHeight },
      scale: pageScale,
    });

    // Add the new field to our collection
    setFields([...fields, newField]);

    // If it's a signature or image field, immediately open the modal to capture content
    if (fieldType === "signature" || fieldType === "image") {
      setPendingSignatureField(newField.id);
      setShowSignatureModal(true);
    }
  };

  // Handle mouse down on a field - start dragging or resizing
  const handleFieldMouseDown = (e, field) => {
    // Don't interfere with interactive elements inside the field
    // (let users type in text boxes, click edit buttons, etc.)
    if (
      e.target.tagName === "INPUT" ||
      e.target.classList.contains("delete-button") ||
      e.target.classList.contains("edit-field-btn")
    ) {
      return;
    }

    e.stopPropagation();
    setSelectedField(field.id); // Mark this field as selected // Mark this field as selected

    // Check if user clicked on the resize handle (bottom-right corner)
    if (e.target.classList.contains("resize-handle")) {
      // Start resizing - remember the starting position and size
      setResizingField({
        id: field.id,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: field.width,
        startHeight: field.height,
      });
    } else {
      // Start dragging - calculate offset so field doesn't jump to cursor
      const canvas = pageRef.current?.querySelector("canvas");
      if (!canvas) return;

      const canvasRect = canvas.getBoundingClientRect();
      const pixelX = e.clientX - canvasRect.left;
      const pixelY = e.clientY - canvasRect.top;

      setDraggingField({
        id: field.id,
        offsetX: pixelX / pageScale - field.x,
        offsetY: pixelY / pageScale - field.y,
      });
    }
  };

  // Handle mouse movement while dragging or resizing a field
  const handleMouseMove = useCallback(
    (e) => {
      if (draggingField) {
        // User is dragging a field - update its position
        const canvas = pageRef.current?.querySelector("canvas");
        if (!canvas) return;

        const canvasRect = canvas.getBoundingClientRect();
        const pixelX = e.clientX - canvasRect.left;
        const pixelY = e.clientY - canvasRect.top;

        // Convert mouse position to PDF coordinates and apply the offset
        // (offset ensures field doesn't jump when user first clicks it)
        const newX = pixelX / pageScale - draggingField.offsetX;
        const newY = pixelY / pageScale - draggingField.offsetY;

        // Update field position, keeping it within PDF boundaries
        setFields((prevFields) =>
          prevFields.map((f) =>
            f.id === draggingField.id
              ? {
                  ...f,
                  // Clamp position so field stays fully visible on the page
                  x: Math.max(
                    0,
                    Math.min(newX, pdfPageDimensions.width - f.width)
                  ),
                  y: Math.max(
                    0,
                    Math.min(newY, pdfPageDimensions.height - f.height)
                  ),
                }
              : f
          )
        );
      } else if (resizingField) {
        // User is resizing a field - update its dimensions
        // Calculate how far the mouse has moved since resize started
        const deltaX = e.clientX - resizingField.startX;
        const deltaY = e.clientY - resizingField.startY;

        // Convert pixel movement to PDF points
        const deltaPdfX = deltaX / pageScale;
        const deltaPdfY = deltaY / pageScale;

        // Update field size, enforcing minimum dimensions
        setFields((prevFields) =>
          prevFields.map((f) =>
            f.id === resizingField.id
              ? {
                  ...f,
                  // Apply the delta to the original size, with minimums
                  width: Math.max(30, resizingField.startWidth + deltaPdfX),
                  height: Math.max(20, resizingField.startHeight + deltaPdfY),
                }
              : f
          )
        );
      }
    },
    [draggingField, resizingField, pageScale, pdfPageDimensions]
  );

  const handleMouseUp = useCallback(() => {
    setDraggingField(null);
    setResizingField(null);
  }, []);

  useEffect(() => {
    if (draggingField || resizingField) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [draggingField, resizingField, handleMouseMove, handleMouseUp]);

  const handleSignatureSave = (signatureData) => {
    if (pendingSignatureField) {
      setFields((prevFields) =>
        prevFields.map((f) =>
          f.id === pendingSignatureField ? { ...f, value: signatureData } : f
        )
      );
    }
    setShowSignatureModal(false);
    setPendingSignatureField(null);
  };

  const handleFieldValueChange = (fieldId, value) => {
    setFields((prevFields) =>
      prevFields.map((f) => (f.id === fieldId ? { ...f, value } : f))
    );
  };

  const handleDeleteField = (fieldId) => {
    setFields(fields.filter((f) => f.id !== fieldId));
    setSelectedField(null);
  };

  // Sign the PDF with all the placed fields and download the result
  const handleSignPdf = async () => {
    // Validation: make sure we have at least one field
    if (fields.length === 0) {
      alert("Please add at least one field before signing the PDF");
      return;
    }

    // Validation: make sure PDF dimensions are loaded
    if (!pdfPageDimensions.width || !pdfPageDimensions.height) {
      alert("PDF page dimensions not loaded. Please wait and try again.");
      return;
    }

    setIsSigning(true); // Show loading state

    try {
      console.log("🔏 Signing PDF with page dimensions:", pdfPageDimensions);
      console.log("📝 Fields to add:", fields);

      // Prepare the data to send to the server
      // Note: coordinates are already in PDF points, not pixels!
      const payload = {
        documentId: document.id,
        pdfFilename: document.filename,
        fields: fields.map((field) => ({
          type: field.type,
          pageNumber: field.page,
          browserCoordinates: {
            // Despite the name, these are PDF points!
            x: field.x,
            y: field.y,
            width: field.width,
            height: field.height,
          },
          containerDimensions: pdfPageDimensions, // Original PDF page size
          value: field.value,
        })),
      };

      const apiBaseRaw = 'https://bolosign-88qv.onrender.com' || "";
      const apiBase = apiBaseRaw.replace(/\/$/, "");
      const signUrl = apiBase ? `${apiBase}/api/sign` : "/api/sign";

      const response = await axios.post(signUrl, payload);

      if (response.data.success) {
        // Success! Open the signed PDF in a new tab
        const signedPdfUrl = response.data.signedPdf?.url
          ? (apiBase ? `${apiBase}${response.data.signedPdf.url}` : response.data.signedPdf.url)
          : null;
        console.log("✅ PDF signed successfully! Opening:", signedPdfUrl);
        if (signedPdfUrl) window.open(signedPdfUrl, "_blank");
      }
    } catch (error) {
      console.error("❌ Error signing PDF:", error);
      alert(
        "Failed to sign PDF: " + (error.response?.data?.error || error.message)
      );
    } finally {
      setIsSigning(false); // Hide loading state
    }
  };

  const pageFields = fields.filter((f) => f.page === currentPage);

  return (
    <div className="pdf-editor">
      <div className="editor-controls">
        <button onClick={onBack} className="btn-secondary">
          ← Back to Upload
        </button>

        <div className="page-controls">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="btn-secondary"
          >
            Previous
          </button>
          <span className="page-info">
            Page {currentPage} of {numPages || "..."}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
            disabled={currentPage >= numPages}
            className="btn-secondary"
          >
            Next
          </button>
        </div>

        <button
          onClick={handleSignPdf}
          className="btn-primary"
          disabled={isSigning || fields.length === 0}
        >
          {isSigning ? "Signing..." : "✍️ Sign & Download PDF"}
        </button>
      </div>

      <div className="editor-workspace">
        <FieldToolbar onDragStart={handleToolbarDragStart} />

        <div
          className="pdf-container"
          ref={containerRef}
          onDrop={handleContainerDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => setSelectedField(null)}
        >
          <Document
            file={(function() {
              const apiBaseRaw = 'https://bolosign-88qv.onrender.com' || "";
              const apiBase = apiBaseRaw.replace(/\/$/, "");
              if (!document?.url) return null;
              // If document.url is already absolute, use it. Otherwise prefix with apiBase when available.
              if (/^https?:\/\//i.test(document.url)) return document.url;
              return apiBase ? `${apiBase}${document.url}` : document.url;
            })()}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={<div className="loading">Loading PDF...</div>}
          >
            <div ref={pageRef}>
              <Page
                pageNumber={currentPage}
                width={Math.min(containerRef.current?.clientWidth || 800, 800)}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                onLoadSuccess={onPageLoadSuccess}
              />
            </div>
          </Document>

          {pageFields.map((field) => (
            <div
              key={field.id}
              className={`pdf-field ${field.type} ${
                selectedField === field.id ? "selected" : ""
              } ${draggingField?.id === field.id ? "dragging" : ""}`}
              style={{
                left: field.x * pageScale + canvasOffset.left,
                top: field.y * pageScale + canvasOffset.top,
                width: field.width * pageScale,
                height: field.height * pageScale,
                position: "absolute",
              }}
              onMouseDown={(e) => handleFieldMouseDown(e, field)}
            >
              {field.type === "text" && (
                <input
                  type="text"
                  placeholder="Enter text"
                  value={field.value}
                  onChange={(e) =>
                    handleFieldValueChange(field.id, e.target.value)
                  }
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="field-input"
                />
              )}

              {field.type === "date" && (
                <input
                  type="date"
                  value={field.value}
                  onChange={(e) =>
                    handleFieldValueChange(field.id, e.target.value)
                  }
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="field-input"
                />
              )}

              {field.type === "signature" && (
                <div className="signature-placeholder">
                  {field.value ? (
                    <>
                      <img
                        src={field.value}
                        alt="Signature"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          pointerEvents: "none",
                        }}
                      />
                      <button
                        className="edit-field-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingSignatureField(field.id);
                          setShowSignatureModal(true);
                        }}
                        title="Edit signature"
                      >
                        ✏️
                      </button>
                    </>
                  ) : (
                    <span
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setPendingSignatureField(field.id);
                        setShowSignatureModal(true);
                      }}
                    >
                      Click to sign
                    </span>
                  )}
                </div>
              )}

              {field.type === "image" && (
                <div className="image-placeholder">
                  {field.value ? (
                    <>
                      <img
                        src={field.value}
                        alt="Uploaded"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          pointerEvents: "none",
                        }}
                      />
                      <button
                        className="edit-field-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingSignatureField(field.id);
                          setShowSignatureModal(true);
                        }}
                        title="Change image"
                      >
                        ✏️
                      </button>
                    </>
                  ) : (
                    <span
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setPendingSignatureField(field.id);
                        setShowSignatureModal(true);
                      }}
                    >
                      Upload image
                    </span>
                  )}
                </div>
              )}

              {field.type === "checkbox" && (
                <input
                  type="checkbox"
                  checked={field.value === "checked"}
                  onChange={(e) =>
                    handleFieldValueChange(
                      field.id,
                      e.target.checked ? "checked" : ""
                    )
                  }
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="checkbox-input"
                />
              )}

              {field.type === "radio" && (
                <input
                  type="radio"
                  checked={field.value === "selected"}
                  onChange={(e) =>
                    handleFieldValueChange(
                      field.id,
                      e.target.checked ? "selected" : ""
                    )
                  }
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="radio-input"
                />
              )}

              {selectedField === field.id && (
                <>
                  <div className="resize-handle" />
                  <button
                    className="delete-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteField(field.id);
                    }}
                  >
                    ×
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {showSignatureModal && (
        <SignatureModal
          onSave={handleSignatureSave}
          onClose={() => {
            setShowSignatureModal(false);
            setPendingSignatureField(null);
          }}
        />
      )}
    </div>
  );
};

export default PdfEditor;
