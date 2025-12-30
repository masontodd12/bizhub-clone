// middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// ✅ Data should be PUBLIC now (so DO NOT include /data here)
const isProtectedRoute = createRouteMatcher([
  "/deal-calculator(.*)",
  "/cim-analyzer(.*)",
  "/dashboard(.*)",
  "/account(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();
  const path = req.nextUrl.pathname;

  // Keep signed-in users out of /login and /signup
  if (userId && (path === "/login" || path === "/signup")) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Protect routes
  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};
