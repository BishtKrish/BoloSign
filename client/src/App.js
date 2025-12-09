












import React, { useState } from "react";
import PdfUploader from "./components/PdfUploader";
import PdfEditor from "./components/PdfEditor";
import "./App.css";

function App() {
  
  const [uploadedDocument, setUploadedDocument] = useState(null);

  
  const handlePdfUploaded = (documentData) => {
    setUploadedDocument(documentData);
  };

  
  const handleBackToUpload = () => {
    setUploadedDocument(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>BoloForms Signature Engine</h1>
        <p>Precision PDF field placement with responsive coordinate mapping</p>
      </header>

      <main className="app-main">
        {}
        {!uploadedDocument ? (
          <PdfUploader onPdfUploaded={handlePdfUploaded} />
        ) : (
          <PdfEditor document={uploadedDocument} onBack={handleBackToUpload} />
        )}
      </main>
    </div>
  );
}

export default App;
