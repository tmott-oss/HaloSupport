import { createRoot } from "react-dom/client";

import { SupportChat } from "./SupportChat";
import type { SupportChatContext } from "./types";

declare global {
  interface Window {
    HalosightSupport?: {
      mount: (element: HTMLElement, context?: Partial<SupportChatContext>) => void;
    };
  }
}

window.HalosightSupport = {
  mount(element, context = {}) {
    const root = createRoot(element);
    root.render(
      <SupportChat
        context={{
          surface: context.surface ?? "public_website",
          route: context.route ?? window.location.pathname,
          userId: context.userId,
          accountId: context.accountId,
          knowledgeSet: context.knowledgeSet
        }}
      />
    );
  }
};
