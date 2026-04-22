import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles/tokens.css";
import "./styles.css";
import "./styles/timeline.css";
import "./styles/month.css";
import "./styles/kanban.css";
import "./styles/episode.css";
import "./styles/workspace-status.css";
import "./styles/workspace-layout.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
