import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { AuthStorage } from "@mariozechner/pi-coding-agent";
import type { AuthCredential } from "@mariozechner/pi-coding-agent";
import { getOAuthProvider } from "@mariozechner/pi-ai/oauth";
import type { OAuthCredentials } from "@mariozechner/pi-ai/oauth";

type StoredCredential = {
  type?: string;
  key?: string;
  access?: string;
  refresh?: string;
  expires?: number;
  [key: string]: unknown;
};

function getHomeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || homedir();
}

export function getFusionAuthPath(home = getHomeDir()): string {
  return join(home, ".fusion", "agent", "auth.json");
}

export function getFusionModelsPath(home = getHomeDir()): string {
  return join(home, ".fusion", "agent", "models.json");
}

function getLegacyAuthPaths(home = getHomeDir()): string[] {
  return [
    join(home, ".pi", "agent", "auth.json"),
    join(home, ".pi", "auth.json"),
  ];
}

function getLegacyModelsPaths(home = getHomeDir()): string[] {
  return [
    join(home, ".pi", "agent", "models.json"),
    join(home, ".pi", "models.json"),
  ];
}

export function getModelRegistryModelsPath(home = getHomeDir()): string {
  const fusionModelsPath = getFusionModelsPath(home);
  if (existsSync(fusionModelsPath)) {
    return fusionModelsPath;
  }

  return getLegacyModelsPaths(home).find((modelsPath) => existsSync(modelsPath)) ?? fusionModelsPath;
}

function readLegacyCredentials(authPaths = getLegacyAuthPaths()): Record<string, StoredCredential> {
  const credentials: Record<string, StoredCredential> = {};

  for (const authPath of authPaths) {
    if (!existsSync(authPath)) {
      continue;
    }
    try {
      const parsed = JSON.parse(readFileSync(authPath, "utf-8")) as Record<string, StoredCredential>;
      for (const [provider, credential] of Object.entries(parsed)) {
        credentials[provider] ??= credential;
      }
    } catch {
      // Ignore invalid legacy auth files and continue with other candidates.
    }
  }

  return credentials;
}

function resolveStoredApiKey(key: string | undefined): string | undefined {
  if (!key) return undefined;
  return process.env[key] ?? key;
}

function resolveOAuthApiKey(providerId: string, credential: StoredCredential): string | undefined {
  if (
    credential.type !== "oauth" ||
    typeof credential.access !== "string" ||
    typeof credential.refresh !== "string" ||
    typeof credential.expires !== "number" ||
    Date.now() >= credential.expires
  ) {
    return undefined;
  }

  return getOAuthProvider(providerId)?.getApiKey(credential as OAuthCredentials);
}

function resolveStoredCredentialApiKey(providerId: string, credential: StoredCredential | undefined): string | undefined {
  if (credential?.type === "api_key") {
    return resolveStoredApiKey(credential.key);
  }
  if (credential?.type === "oauth") {
    return resolveOAuthApiKey(providerId, credential);
  }
  return undefined;
}

/**
 * Migrate legacy OAuth credentials into primary AuthStorage so that the primary
 * storage can handle token refresh (including lock-based concurrent refresh).
 * Only migrates providers that are not already present in primary storage.
 */
function migrateLegacyCredentials(
  target: AuthStorage,
  legacyCredentials: Record<string, StoredCredential>,
): void {
  for (const [provider, credential] of Object.entries(legacyCredentials)) {
    if (target.has(provider)) continue;
    if (credential.type === "oauth" || credential.type === "api_key") {
      try {
        // AuthStorage.set accepts the credential shape directly
        target.set(provider, credential as unknown as AuthCredential);
      } catch {
        // Non-fatal: fall back to static resolution on getApiKey
      }
    }
  }
}

export function createFusionAuthStorage(): AuthStorage {
  const primary = AuthStorage.create(getFusionAuthPath());
  let legacyCredentials = readLegacyCredentials();

  // Eagerly migrate legacy credentials so the primary AuthStorage handles
  // OAuth refresh (token rotation, lock-based concurrent refresh, etc.).
  migrateLegacyCredentials(primary, legacyCredentials);

  return new Proxy(primary, {
    get(target, prop, receiver) {
      if (prop === "reload") {
        return () => {
          target.reload();
          legacyCredentials = readLegacyCredentials();
          // Re-migrate in case legacy files were updated (e.g. token refreshed
          // by a separate pi-coding-agent process writing to ~/.pi/agent/auth.json).
          migrateLegacyCredentials(target, legacyCredentials);
        };
      }

      if (prop === "get") {
        return (provider: string) => target.get(provider) ?? legacyCredentials[provider];
      }

      if (prop === "has") {
        return (provider: string) => target.has(provider) || provider in legacyCredentials;
      }

      if (prop === "hasAuth") {
        return (provider: string) => target.hasAuth(provider) || Boolean(legacyCredentials[provider]);
      }

      if (prop === "getAll") {
        return () => ({ ...legacyCredentials, ...target.getAll() });
      }

      if (prop === "list") {
        return () => Array.from(new Set([...Object.keys(legacyCredentials), ...target.list()]));
      }

      if (prop === "getApiKey") {
        return async (provider: string) => {
          const primaryKey = await target.getApiKey(provider);
          if (primaryKey) return primaryKey;

          // Fallback for any credential that wasn't migrated (e.g. migration
          // failed or provider is not a recognised OAuth/api_key type).
          return resolveStoredCredentialApiKey(provider, legacyCredentials[provider]);
        };
      }

      return Reflect.get(target, prop, receiver);
    },
  }) as AuthStorage;
}
