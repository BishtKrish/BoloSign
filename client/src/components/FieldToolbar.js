











import React from "react";
import "./FieldToolbar.css";


const fieldTypes = [
  { type: "text", label: "Text Box", icon: "📝" },
  { type: "signature", label: "Signature", icon: "✍️" },
  { type: "image", label: "Image", icon: "🖼️" },
  { type: "date", label: "Date", icon: "📅" },
  { type: "checkbox", label: "Checkbox", icon: "☑️" },
  { type: "radio", label: "Radio", icon: "🔘" },
];

const FieldToolbar = ({ onDragStart }) => {
  return (
    <div className="field-toolbar">
      <h3 className="toolbar-title">Field Types</h3>
      <p className="toolbar-hint">Drag and drop onto PDF</p>

      <div className="field-list">
        {}
        {fieldTypes.map(({ type, label, icon }) => (
          <div
            key={type}
            className="field-item"
            draggable
            onDragStart={(e) => onDragStart(e, type)}
          >
            <span className="field-icon">{icon}</span>
            <span className="field-label">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FieldToolbar;
