import neo4j from 'neo4j-driver'

import { env } from './env.js'

export const driver = neo4j.driver(
  env.neo4jUri,
  neo4j.auth.basic(env.neo4jUser, env.neo4jPassword),
  {
    connectionTimeout: 5000,
    connectionAcquisitionTimeout: 5000,
    maxTransactionRetryTime: 5000,
  }
)

export async function closeNeo4j() {
  await driver.close()
}