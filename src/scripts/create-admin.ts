import argon2 from "argon2";
import * as db from "../database";

async function main() {
  const [username, password] = process.argv.slice(2);

  if (!username || !password) {
    console.error("Usage: yarn create-admin <username> <password>");
    process.exit(1);
  }

  await db.initDatabase();

  const existing = await db.getAdminUserByUsername(username);

  if (existing) {
    console.error(`Admin user "${username}" already exists.`);
    process.exit(1);
  }

  const passwordHash = await argon2.hash(password);
  const created = await db.createAdminUser(username, passwordHash);

  if (!created) {
    console.error("Failed to create admin user.");
    process.exit(1);
  }

  console.log(`Created admin user "${created.username}" (id ${created.id}).`);
  process.exit(0);
}

main();
