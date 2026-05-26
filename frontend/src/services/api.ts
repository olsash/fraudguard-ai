import { apiConfig } from "@/config/apiConfig";

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${apiConfig.baseUrl}${path}`);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
