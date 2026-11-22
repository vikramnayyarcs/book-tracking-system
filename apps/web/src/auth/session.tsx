import { ClerkProvider, useAuth, useClerk } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
} from "react";
import { setTokenProvider } from "../api/client.ts";
import { clearDeviceData } from "../clear-device-data.ts";
import { env } from "../env.ts";

interface Session {
  isLoaded: boolean;
  isSignedIn: boolean;
  signOut: () => Promise<void>;
}

const signedOut: Session = {
  isLoaded: true,
  isSignedIn: false,
  signOut: () => Promise.resolve(),
};

const SessionContext = createContext<Session>(signedOut);

export function useSession() {
  return useContext(SessionContext);
}

export const signInConfigured = env.clerkPublishableKey !== "";

function ClerkSession({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const clerk = useClerk();
  const queryClient = useQueryClient();

  useEffect(() => {
    setTokenProvider(() => getToken());
  }, [getToken]);

  const wasSignedIn = useRef(false);
  useEffect(() => {
    if (!isLoaded) return;
    if (wasSignedIn.current && isSignedIn !== true) {
      void clearDeviceData(queryClient);
    }
    wasSignedIn.current = isSignedIn === true;
  }, [isLoaded, isSignedIn, queryClient]);

  const session: Session = {
    isLoaded,
    isSignedIn: isSignedIn === true,
    signOut: async () => {
      await clearDeviceData(queryClient);
      await clerk.signOut({ redirectUrl: "/sign-in" });
    },
  };

  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}

export function SessionProvider({ children }: { children: ReactNode }) {
  if (!signInConfigured) {
    return (
      <SessionContext.Provider value={signedOut}>
        {children}
      </SessionContext.Provider>
    );
  }
  return (
    <ClerkProvider
      publishableKey={env.clerkPublishableKey}
      signInUrl="/sign-in"
      signInFallbackRedirectUrl="/"
      afterSignOutUrl="/sign-in"
      telemetry={false}
      appearance={{ options: { unsafe_disableDevelopmentModeWarnings: true } }}
    >
      <ClerkSession>{children}</ClerkSession>
    </ClerkProvider>
  );
}
