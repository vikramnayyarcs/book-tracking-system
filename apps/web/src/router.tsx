import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
} from "@tanstack/react-router";
import { AppLayout } from "./layout/app-layout.tsx";
import { LogSessionPage, SearchPage } from "./routes/placeholders.tsx";
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
  component: SearchPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/settings",
  component: SettingsPage,
});

const logRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/books/$bookId/log",
  component: LogSessionPage,
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
    appRoute.addChildren([shelfRoute, searchRoute, settingsRoute, logRoute]),
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
