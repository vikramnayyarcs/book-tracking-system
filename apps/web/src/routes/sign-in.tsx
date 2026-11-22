import { SignIn } from "@clerk/react";
import { brand } from "@book-tracking-system/core/brand";
import { Navigate } from "@tanstack/react-router";
import { signInConfigured, useSession } from "../auth/session.tsx";

export function SignInPage() {
  const session = useSession();

  if (session.isLoaded && session.isSignedIn) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-lg bg-surface px-md py-xl text-ink">
      <h1 className="text-2xl font-medium">Sign in to {brand.name}</h1>
      {signInConfigured ? (
        <SignIn routing="path" path="/sign-in" fallbackRedirectUrl="/" />
      ) : (
        <p className="rounded-md bg-danger-subtle px-md py-sm text-danger-subtle-ink">
          Sign-in is not set up in this build.
        </p>
      )}
    </main>
  );
}
