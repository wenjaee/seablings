import type { Persona, PersonaId } from "@/lib/domain";
import { personas } from "@/lib/fixtures";

const SESSION_COOKIE_NAME = "sea_demo_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;
const DEMO_AUTH_SECRET = process.env.SEA_DEMO_AUTH_SECRET?.trim() || "seablings-demo-auth-secret";

const demoPins: Record<PersonaId, string> = {
  jeff: "1111",
  praya: "2222",
  tana: "3333",
  tester: "4444"
};

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

type SessionCookiePayload = {
  personaId: PersonaId;
  expiresAt: number;
};

export async function authenticateDemoPersona(personaId: PersonaId, pin: string): Promise<Persona | null> {
  if (demoPins[personaId] !== pin) {
    return null;
  }

  return getPersonaById(personaId) ?? null;
}

export async function createDemoSessionValue(personaId: PersonaId): Promise<string> {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = `${personaId}.${expiresAt}`;
  const signature = await signValue(payload);

  return `${payload}.${signature}`;
}

export async function getCurrentPersona(cookies: CookieReader): Promise<Persona | null> {
  const sessionValue = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionValue) {
    return null;
  }

  const session = await verifySessionValue(sessionValue);
  if (!session) {
    return null;
  }

  return getPersonaById(session.personaId) ?? null;
}

export function getDemoSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}

export function getDemoSessionMaxAgeSeconds(): number {
  return SESSION_MAX_AGE_SECONDS;
}

function getPersonaById(personaId: PersonaId): Persona | undefined {
  return personas.find((persona) => persona.id === personaId);
}

async function verifySessionValue(value: string): Promise<SessionCookiePayload | null> {
  const [personaId, expiresAtValue, signature] = value.split(".");
  if (!personaId || !expiresAtValue || !signature) {
    return null;
  }

  if (!isPersonaId(personaId)) {
    return null;
  }

  const expiresAt = Number.parseInt(expiresAtValue, 10);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return null;
  }

  const expectedSignature = await signValue(`${personaId}.${expiresAtValue}`);
  if (signature !== expectedSignature) {
    return null;
  }

  return {
    personaId,
    expiresAt
  };
}

async function signValue(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(DEMO_AUTH_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));

  return bufferToBase64Url(signature);
}

function bufferToBase64Url(value: ArrayBuffer): string {
  const bytes = Array.from(new Uint8Array(value));
  const binary = bytes.map((byte) => String.fromCharCode(byte)).join("");

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function isPersonaId(value: string): value is PersonaId {
  return value in demoPins;
}
