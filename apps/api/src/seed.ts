import bcrypt from "bcryptjs";
import { prisma } from "./db.js";
import { env } from "./env.js";

async function main() {
  const passwordHash = await bcrypt.hash(env.adminPassword, 10);

  await prisma.admin.upsert({
    where: { email: env.adminEmail },
    update: { passwordHash },
    create: { email: env.adminEmail, passwordHash },
  });

  console.log(`Admin ready: ${env.adminEmail}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
