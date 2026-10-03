import { defineRailway, postgres, preserve, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  const Postgres = postgres("Postgres", { region: "us-east4-eqdc4a" });
  Postgres.networking = { privateNetworkEndpoint: "postgres" };
  const postgresVolume = volume("postgres-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "us-east4-eqdc4a", sizeMB: 5000 });
  const api = service("api", {
    replicas: { "us-east4-eqdc4a": 1 },
    env: { ADMIN_EMAIL: preserve(), ADMIN_PASSWORD: preserve(), DATABASE_URL: preserve(), JWT_SECRET: preserve() },
  });

  return project("escuela-futbol", {
    resources: [Postgres, api, postgresVolume],
  });
});
