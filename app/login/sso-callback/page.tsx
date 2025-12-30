// app/login/sso-callback/page.tsx
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SSOCallbackPage() {
  return <AuthenticateWithRedirectCallback />;
}
