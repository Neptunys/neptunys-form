import { MongooseModuleOptions, MongooseOptionsFactory } from '@nestjs/mongoose'
import * as mongoose from 'mongoose'
import { Connection } from 'mongoose'

import { MONGO_PASSWORD, MONGO_SSL_CA_PATH, MONGO_URI, MONGO_USER } from '@environments'
import { clone } from '@heyform-inc/utils'
import { Logger } from '@utils'

// Setup migrations logger
const logger = new Logger('MongooseModule')
const MONGO_SERVER_SELECTION_TIMEOUT_MS = +(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000)
const MONGO_CONNECT_TIMEOUT_MS = +(process.env.MONGO_CONNECT_TIMEOUT_MS || 10000)
const MONGO_SOCKET_TIMEOUT_MS = +(process.env.MONGO_SOCKET_TIMEOUT_MS || 45000)
const MONGO_CONNECT_RETRY_DELAY_MS = +(process.env.MONGO_CONNECT_RETRY_DELAY_MS || 5000)

const reconnectTimers = new WeakMap<Connection, NodeJS.Timeout>()
const reconnectingConnections = new WeakSet<Connection>()
const managedConnections = new WeakSet<Connection>()

const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

const createConnectOptions = (): MongooseModuleOptions => ({
  user: MONGO_USER,
  pass: MONGO_PASSWORD,
  sslCA: MONGO_SSL_CA_PATH as any,
  serverSelectionTimeoutMS: MONGO_SERVER_SELECTION_TIMEOUT_MS,
  connectTimeoutMS: MONGO_CONNECT_TIMEOUT_MS,
  socketTimeoutMS: MONGO_SOCKET_TIMEOUT_MS
})

const clearReconnectTimer = (connection: Connection): void => {
  const timer = reconnectTimers.get(connection)

  if (timer) {
    clearTimeout(timer)
    reconnectTimers.delete(connection)
  }
}

const scheduleReconnect = (connection: Connection): void => {
  if (connection.readyState === 1 || connection.readyState === 2 || reconnectTimers.has(connection)) {
    return
  }

  logger.warn(`MongoDB unavailable. Retrying in ${Math.round(MONGO_CONNECT_RETRY_DELAY_MS / 1000)}s...`)

  const timer = setTimeout(() => {
    reconnectTimers.delete(connection)
    void reconnect(connection)
  }, MONGO_CONNECT_RETRY_DELAY_MS)

  timer.unref?.()
  reconnectTimers.set(connection, timer)
}

const reconnect = async (connection: Connection): Promise<void> => {
  if (reconnectingConnections.has(connection) || connection.readyState === 1 || connection.readyState === 2) {
    return
  }

  reconnectingConnections.add(connection)

  try {
    await connection.openUri(MONGO_URI, createConnectOptions())
  } catch (error) {
    logger.warn(`MongoDB connection failed: ${formatError(error)}`)
    scheduleReconnect(connection)
  } finally {
    reconnectingConnections.delete(connection)
  }
}

const manageConnection = (connection: Connection): Connection => {
  if (managedConnections.has(connection)) {
    return connection
  }

  managedConnections.add(connection)

  connection.on('connected', () => {
    clearReconnectTimer(connection)
    logger.info('MongoDB connection established')
  })

  connection.on('disconnected', () => {
    scheduleReconnect(connection)
  })

  connection.on('error', error => {
    logger.warn(`MongoDB connection error: ${formatError(error)}`)
  })

  void connection.asPromise().catch(error => {
    logger.warn(`Initial MongoDB connection failed: ${formatError(error)}`)
    scheduleReconnect(connection)
  })

  return connection
}

mongoose.set('debug', (collection: string, method: string, query: any, doc: any) => {
  const newQuery = clone(query)

  // Hide passwords from query logs
  if (newQuery.password) {
    newQuery.password = '******'
  }

  logger.info([collection, method, JSON.stringify(newQuery), JSON.stringify(doc)].join(' '))
})

export class MongoService implements MongooseOptionsFactory {
  createMongooseOptions(): Promise<MongooseModuleOptions> | MongooseModuleOptions {
    return {
      uri: MONGO_URI,
      ...createConnectOptions(),
      lazyConnection: true,
      connectionFactory: connection => manageConnection(connection)
    }
  }
}
