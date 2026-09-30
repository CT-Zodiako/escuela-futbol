function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3001),
  jwtSecret: required("JWT_SECRET"),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  adminEmail: required("ADMIN_EMAIL"),
  adminPassword: required("ADMIN_PASSWORD"),
};
