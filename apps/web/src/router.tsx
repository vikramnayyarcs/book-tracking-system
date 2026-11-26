import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
} from "@tanstack/react-router";
import { AppLayout } from "./layout/app-layout.tsx";
import { ShelfPage } from "./routes/shelf.tsx";
import { SettingsPage } from "./routes/settings.tsx";
import { SignInPage } from "./routes/sign-in.tsx";
import { reportRoute } from "./telemetry/faro.ts";

const rootRoute = createRootRoute({ component: Outlet });

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  component: SignInPage,
});

const signInStepRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in/$",
  component: SignInPage,
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  component: AppLayout,
});

const shelfRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/",
  component: ShelfPage,
});

const searchRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/search",
  component: lazyRouteComponent(() =>
    import("./routes/search.tsx").then((m) => ({ default: m.SearchPage })),
  ),
});

const askRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/ask",
  component: lazyRouteComponent(() =>
    import("./routes/ask.tsx").then((m) => ({ default: m.AskPage })),
  ),
});

const activityRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/activity",
  component: lazyRouteComponent(() =>
    import("./routes/activity.tsx").then((m) => ({ default: m.ActivityPage })),
  ),
});

const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/settings",
  component: SettingsPage,
});

const logReadingRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/log",
  component: lazyRouteComponent(() =>
    import("./routes/log-reading.tsx").then((m) => ({
      default: m.LogReadingPage,
    })),
  ),
});

const logRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/books/$bookId/log",
  component: lazyRouteComponent(() =>
    import("./routes/log-session.tsx").then((m) => ({
      default: m.LogSessionPage,
    })),
  ),
});

const addBookRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/books/new",
  component: lazyRouteComponent(() =>
    import("./routes/add-book.tsx").then((m) => ({ default: m.AddBookPage })),
  ),
});

const bookRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/books/$bookId",
  component: lazyRouteComponent(() =>
    import("./routes/book-page.tsx").then((m) => ({ default: m.BookPage })),
  ),
});

const finishRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/books/$bookId/finish",
  component: lazyRouteComponent(() =>
    import("./routes/finish-book.tsx").then((m) => ({
      default: m.FinishBookPage,
    })),
  ),
});

const devRoutes = import.meta.env.DEV
  ? [
      createRoute({
        getParentRoute: () => rootRoute,
        path: "/dev/tokens",
        component: lazyRouteComponent(() =>
          import("./routes/dev/tokens.tsx").then((m) => ({
            default: m.TokensPage,
          })),
        ),
      }),
    ]
  : [];

export const router = createRouter({
  routeTree: rootRoute.addChildren([
    signInRoute,
    signInStepRoute,
    appRoute.addChildren([
      shelfRoute,
      searchRoute,
      askRoute,
      activityRoute,
      settingsRoute,
      logReadingRoute,
      logRoute,
      addBookRoute,
      bookRoute,
      finishRoute,
    ]),
    ...devRoutes,
  ]),
  defaultNotFoundComponent: () => <AppLayout />,
});

router.subscribe("onResolved", () => {
  const leaf = router.state.matches.at(-1);
  if (leaf) reportRoute(leaf.fullPath);
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
