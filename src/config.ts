import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().min(1).default("0.0.0.0"),
  PUBLIC_BASE_URL: z.string().url(),
  MCPIZE_SUBSCRIBER_HEADER: z.string().min(1).default("x-mcpize-user-id"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  TOKEN_ENCRYPTION_KEY: z.string().min(16),
  OAUTH_STATE_SECRET: z.string().min(16)
});

export type AppConfig = z.infer<typeof envSchema>;

let cachedConfig: AppConfig | undefined;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (!cachedConfig) {
    const parsed = envSchema.parse(env);
    if (!parsed.SUPABASE_SECRET_KEY && !parsed.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Set SUPABASE_SECRET_KEY for server-side Supabase access.");
    }
    cachedConfig = parsed;
  }

  return cachedConfig;
}

export function resetConfigForTests(): void {
  cachedConfig = undefined;
}
