import { driver } from './neo4j.js'

export async function ensureUserConstraints() {
  const session = driver.session()

  try {
    await session.executeWrite((tx) =>
      tx.run(
        `
          CREATE CONSTRAINT user_email_unique IF NOT EXISTS
          FOR (user:User)
          REQUIRE user.email IS UNIQUE
        `
      )
    )

    await session.executeWrite((tx) =>
      tx.run(
        `
          CREATE CONSTRAINT user_username_unique IF NOT EXISTS
          FOR (user:User)
          REQUIRE user.username IS UNIQUE
        `
      )
    )
  } finally {
    await session.close()
  }
}