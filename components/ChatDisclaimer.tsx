import { useState, useEffect } from "react";
import { useTranslation } from "next-i18next";

interface ChatDisclaimerProps {
  conversationId: string;
  onAccept: () => void;
  role?: "BORROWER" | "BROKER";
}

const STORAGE_KEY = "mortly_chat_disclaimer_accepted";

function getAccepted(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function markAccepted(conversationId: string) {
  try {
    const accepted = getAccepted();
    accepted.add(conversationId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...accepted]));
  } catch {
    // localStorage may be unavailable (private browsing, quota exceeded, etc.)
  }
}

export function useDisclaimerNeeded(conversationId: string | null) {
  const [needed, setNeeded] = useState(false);

  useEffect(() => {
    if (!conversationId) {
      setNeeded(false);
      return;
    }
    setNeeded(!getAccepted().has(conversationId));
  }, [conversationId]);

  const accept = () => {
    if (conversationId) {
      markAccepted(conversationId);
      setNeeded(false);
    }
  };

  return { disclaimerNeeded: needed, acceptDisclaimer: accept };
}

export default function ChatDisclaimer({ conversationId, onAccept, role }: ChatDisclaimerProps) {
  const { t } = useTranslation("common");
  const isBroker = role === "BROKER";

  const handleAccept = () => {
    markAccepted(conversationId);
    onAccept();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-900/40 backdrop-blur-sm animate-fade-in">
      <div className="card-elevated !p-8 max-w-md mx-4 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>

        <h3 className="heading-md mb-4">
          {t(isBroker ? "messages.brokerDisclaimerTitle" : "messages.disclaimerTitle")}
        </h3>

        <p className="text-body-sm whitespace-pre-line leading-relaxed mb-8">
          {t(isBroker ? "messages.brokerDisclaimerBody" : "messages.disclaimerBody")}
        </p>

        <button
          onClick={handleAccept}
          className="btn-primary w-full py-3"
        >
          {t(isBroker ? "messages.brokerDisclaimerAccept" : "messages.disclaimerAccept")}
        </button>
      </div>
    </div>
  );
}
