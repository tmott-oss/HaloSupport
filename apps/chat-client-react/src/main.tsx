import { createRoot } from "react-dom/client";

import { SupportChat } from "./SupportChat";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing root element.");
}

createRoot(root).render(
  <SupportChat
    apiBaseUrl="http://localhost:3001"
    context={{
      surface: "public_website",
      route: "/chat-client-dev"
    }}
  />
);
