import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import SupportBanner from "./components/SupportBanner.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <>
    {/* Renders only inside an admin support session; null otherwise. */}
    <SupportBanner />
    <App />
  </>
);
