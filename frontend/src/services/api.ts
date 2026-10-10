import { fetchAuthSession } from "aws-amplify/auth";
let localToken = "";
export function setToken(t: string) {
  localToken = t;
}
export async function api<T = any>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const token =
    import.meta.env.VITE_AUTH_MODE === "local"
      ? localToken
      : (await fetchAuthSession()).tokens?.accessToken.toString();
  const response = await fetch(
    (import.meta.env.VITE_API_URL || "http://localhost:3001") + path,
    {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    },
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || "Request failed");
  return result.data;
}
