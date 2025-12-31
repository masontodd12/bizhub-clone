// middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isAuthRoute = createRouteMatcher(["/login(.*)", "/signup(.*)"]);

const isPublicRoute = createRouteMatcher([
  "/",
  "/pricing(.*)",
  "/about(.*)",
  "/data(.*)",

  // ✅ Clerk SSO redirect landing
  "/sso-callback(.*)",

  // ✅ Stripe webhooks must be public
  "/api/stripe/webhook(.*)",
]);

const isProtectedRoute = createRouteMatcher([
  "/deal-calculator(.*)",
  "/cim-analyzer(.*)",
  "/dashboard(.*)",
  "/account(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // ✅ If logged in, keep them out of auth pages (including nested)
  if (userId && isAuthRoute(req)) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // ✅ Never protect auth/public routes
  if (isAuthRoute(req) || isPublicRoute(req)) {
    return NextResponse.next();
  }

  // ✅ Protect app-only routes
  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};
