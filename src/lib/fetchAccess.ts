export type AccessResponse =
  | {
      ok: true;
      plan: string;
      isAdmin: boolean;
      entitlements: any;
      user?: any;
    }
  | {
      ok: false;
      error: string;
    };

export async function fetchAccess(): Promise<AccessResponse | null> {
  let res: Response;

  try {
    res = await fetch("/api/me/access", {
      method: "GET",
      credentials: "include",
    });
  } catch (err) {
    console.error("Network error fetching access", err);
    return null;
  }

  if (!res.ok) {
    // 401 / 403 during auth hydration is normal
    return null;
  }

  try {
    return (await res.json()) as AccessResponse;
  } catch (err) {
    console.error("Access API returned non-JSON", err);
    return null;
  }
}
