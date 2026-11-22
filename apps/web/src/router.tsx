import { brand } from "@book-tracking-system/core/brand";
import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
} from "@tanstack/react-router";

const rootRoute = createRootRoute({ component: Outlet });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => (
    <main>
      <h1>{brand.name}</h1>
    </main>
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
  routeTree: rootRoute.addChildren([indexRoute, ...devRoutes]),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
