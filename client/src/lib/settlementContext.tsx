import { createContext, useContext, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Redirect } from "wouter";
import type { Settlement, SettlementParticipant } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

interface SettlementData {
  settlement: Settlement;
  participants: SettlementParticipant[];
  isParticipant: boolean;
}

interface SettlementContextValue {
  settlement: Settlement;
  participants: SettlementParticipant[];
  person1: SettlementParticipant | undefined;
  person2: SettlementParticipant | undefined;
  currentUserParticipant: SettlementParticipant | undefined;
  currentUserRole: "person1" | "person2" | null;
  currentUserId: string;
  isCreator: boolean;
}

const SettlementContext = createContext<SettlementContextValue | null>(null);

export function SettlementProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [match, params] = useRoute("/settle/:settlementName/*?");
  const settlementName = params?.settlementName;

  const { data, isLoading, error } = useQuery<SettlementData>({
    queryKey: ["/api/settlements/by-name", settlementName],
    enabled: !!settlementName,
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading settlement...</p>
        </div>
      </div>
    );
  }

  // Error or settlement not found
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4">Settlement Not Found</h2>
          <p className="text-muted-foreground mb-6">
            The settlement you're looking for doesn't exist or you don't have access to it.
          </p>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  const { settlement, participants } = data;

  // Security: Check if user is a participant
  if (!data.isParticipant && user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4">Join This Settlement</h2>
          <p className="text-muted-foreground mb-6">
            You need to join this settlement to access it. The creator can share this link with you.
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Settlement: <strong>{settlement.name}</strong>
          </p>
          <button
            onClick={() => {
              // Trigger join mutation (TODO: implement)
              window.location.href = `/settle/${settlement.name}/join`;
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Join Settlement
          </button>
        </div>
      </div>
    );
  }

  // Get person1 and person2
  const person1 = participants.find(p => p.role === "creator");
  const person2 = participants.find(p => p.role === "participant");

  // Determine current user's participant record and role
  const currentUserParticipant = participants.find(p => p.userId === user?.id);
  const currentUserRole = currentUserParticipant?.role === "creator" ? "person1" : 
                          currentUserParticipant?.role === "participant" ? "person2" : 
                          null;
  const isCreator = currentUserParticipant?.role === "creator";

  return (
    <SettlementContext.Provider
      value={{
        settlement,
        participants,
        person1,
        person2,
        currentUserParticipant,
        currentUserRole,
        currentUserId: user?.id || "",
        isCreator,
      }}
    >
      {children}
    </SettlementContext.Provider>
  );
}

export function useSettlement() {
  const context = useContext(SettlementContext);
  if (!context) {
    throw new Error("useSettlement must be used within SettlementProvider");
  }
  return context;
}
