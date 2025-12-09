import React, { useState, useCallback } from "react";
import axios from "axios";
import "./PdfUploader.css";

const PdfUploader = ({ onPdfUploaded }) => {
  const [uploading, setUploading] = useState(false); 
  const [error, setError] = useState(null); 
  const [dragActive, setDragActive] = useState(false); 

  
  const handleFileUpload = async (file) => {
    if (!file) return; 

    
    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file");
      return;
    }

    setUploading(true);
    setError(null); 

    
    const formData = new FormData();
    formData.append("pdf", file);

    try {
      
      const response = await axios.post(
        "/api/upload",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (response.data.success) {
        
        console.log("✅ PDF uploaded successfully:", response.data.document);
        onPdfUploaded(response.data.document);
      }
    } catch (err) {
      
      const serverMessage = err.response?.data?.error || err.response?.data?.details;
      setError(serverMessage || err.message || "Failed to upload PDF");
      console.error("❌ Upload error:", err);
    } finally {
      setUploading(false);
    }
  };

  
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false); 

    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  }, []);

  
  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  return (
    <div className="pdf-uploader">
      <div className="upload-container">
        <div
          className={`upload-zone ${dragActive ? "drag-active" : ""}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            id="pdf-input"
            accept=".pdf,application/pdf"
            onChange={handleChange}
            disabled={uploading}
            style={{ display: "none" }}
          />

          <div className="upload-content">
            <svg
              className="upload-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>

            {uploading ? (
              <p className="upload-text">Uploading PDF...</p>
            ) : (
              <>
                <p className="upload-text">
                  Drag and drop your PDF here, or{" "}
                  <label htmlFor="pdf-input" className="upload-link">
                    browse files
                  </label>
                </p>
                <p className="upload-hint">PDF files up to 10MB</p>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="error-message">
            <span>⚠️ {error}</span>
          </div>
        )}

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">📝</div>
            <h3>Precise Placement</h3>
            <p>Drag and drop fields with pixel-perfect accuracy</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📱</div>
            <h3>Responsive Design</h3>
            <p>Fields stay anchored across all screen sizes</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">✍️</div>
            <h3>Multiple Fields</h3>
            <p>Text, signature, date, checkbox, radio, and images</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PdfUploader;
