import { RouterProvider } from "@tanstack/react-router";

import { getRouter } from "@/router";

const router = getRouter();

export function AppRoutes() {
  return <RouterProvider router={router} />;
}
