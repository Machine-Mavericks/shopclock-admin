import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USER, LOGGER } from "./constants";

export type UserRole = "student" | "mentor";

export interface User {
  id: number;
  fullName: string;
  role: UserRole;
}

export type PunchCredentialType = "rotating" | "static";

export interface PunchCredential {
  id: string;
  userId: number;
  type: PunchCredentialType;
  secret: string;
  revoked: boolean;
}

export interface Session {
  id: number;
  userId: number;
  timeIn: number;
  timeOut: number | null;
}

export interface UserWithCredential {
  user: User;
  credential: PunchCredential;
}

export interface AdminUser {
  id: number;
  username: string;
  passwordHash: string;
  disabled: boolean;
  createdAt: string;
}

export interface FluxerAdminId {
  id: number;
  fluxerId: string;
  label: string | null;
  addedBy: string | null;
  createdAt: string;
}

export interface CurrentlyPunchedIn {
  userId: number;
  fullName: string;
  timeIn: number;
}

export interface SessionWithUser extends Session {
  fullName: string;
}

const DUPLICATE_PUNCH_WINDOW_MS = 5000;

const pool = new Pool({
  user: DB_USER,
  password: DB_PASSWORD,
  host: DB_HOST,
  port: DB_PORT,
  database: DB_NAME,
});

function mapUser(row: Record<string, unknown>): User {
  return {
    id: Number(row.id),
    fullName: String(row.full_name),
    role: (row.role as UserRole | undefined) ?? "student",
  };
}

function mapCredential(row: Record<string, unknown>): PunchCredential {
  return {
    id: String(row.id),
    userId: Number(row.user_id),
    type: row.type as PunchCredentialType,
    secret: String(row.secret),
    revoked: Boolean(row.revoked),
  };
}

function mapSession(row: Record<string, unknown>): Session {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    timeIn: Number(row.time_in),
    timeOut: row.time_out === null ? null : Number(row.time_out),
  };
}

function mapAdminUser(row: Record<string, unknown>): AdminUser {
  return {
    id: Number(row.id),
    username: String(row.username),
    passwordHash: String(row.password_hash),
    disabled: Boolean(row.disabled),
    createdAt: String(row.created_at),
  };
}

function mapFluxerAdminId(row: Record<string, unknown>): FluxerAdminId {
  return {
    id: Number(row.id),
    fluxerId: String(row.fluxer_id),
    label: row.label === null ? null : String(row.label),
    addedBy: row.added_by === null ? null : String(row.added_by),
    createdAt: String(row.created_at),
  };
}

export async function verifyConnection(): Promise<void> {
  const client = await pool.connect();

  try {
    LOGGER.info("Connected to Database");
  } finally {
    client.release();
  }
}

export async function initDatabase(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Migrate legacy "students" naming to "users", if present. Postgres has no
    // "RENAME COLUMN IF EXISTS", so the column renames are wrapped in DO blocks
    // that swallow "already renamed" (undefined_column) and "doesn't exist yet
    // on a fresh install" (undefined_table) so this stays safe to run every time.
    await client.query(`ALTER TABLE IF EXISTS students RENAME TO users;`);

    await client.query(`
      DO $$
      BEGIN
        ALTER TABLE sessions RENAME COLUMN student_id TO user_id;
      EXCEPTION
        WHEN undefined_column THEN NULL;
        WHEN undefined_table THEN NULL;
      END $$;
    `);

    await client.query(`
      DO $$
      BEGIN
        ALTER TABLE punch_credentials RENAME COLUMN student_id TO user_id;
      EXCEPTION
        WHEN undefined_column THEN NULL;
        WHEN undefined_table THEN NULL;
      END $$;
    `);

    await client.query(`ALTER INDEX IF EXISTS one_open_session_per_student RENAME TO one_open_session_per_user;`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'student',
        CONSTRAINT users_role_check CHECK (role IN ('student', 'mentor'))
      );
    `);

    // Upgrade path: a users/students table from before the role column existed.
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'student';`);
    await client.query(`
      DO $$
      BEGIN
        ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'mentor'));
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS punch_credentials (
        id UUID PRIMARY KEY,
        user_id INTEGER NOT NULL,
        type VARCHAR(10) NOT NULL,
        secret VARCHAR(128) NOT NULL UNIQUE,
        revoked BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT fk_punch_credentials_user
          FOREIGN KEY (user_id)
          REFERENCES users(id)
          ON DELETE CASCADE,

        CONSTRAINT punch_credentials_type_check
          CHECK (type IN ('rotating', 'static'))
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        time_in BIGINT NOT NULL,
        time_out BIGINT,

        CONSTRAINT fk_sessions_user
          FOREIGN KEY (user_id)
          REFERENCES users(id)
          ON DELETE CASCADE
      );
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS one_open_session_per_user
      ON sessions (user_id)
      WHERE time_out IS NULL;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(64) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        disabled BOOLEAN NOT NULL DEFAULT FALSE
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS fluxer_admin_ids (
        id SERIAL PRIMARY KEY,
        fluxer_id VARCHAR(64) NOT NULL UNIQUE,
        label VARCHAR(100),
        added_by VARCHAR(64),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query("COMMIT");
    LOGGER.info("Database initialized");
  } catch (error) {
    await client.query("ROLLBACK");
    LOGGER.error(`Error initializing database\n${error}`);
    throw error;
  } finally {
    client.release();
  }
}

export async function getUser(id: number): Promise<User | null>;
export async function getUser(staticSecret: string): Promise<User | null>;

export async function getUser(value: number | string): Promise<User | null> {
  const client = await pool.connect();

  try {
    const result = typeof value === "number"
      ? await client.query(`
        SELECT id, full_name, role
        FROM users
        WHERE id = $1;
      `, [value])
      : await client.query(`
        SELECT users.id, users.full_name, users.role
        FROM users
        INNER JOIN punch_credentials
          ON punch_credentials.user_id = users.id
        WHERE punch_credentials.secret = $1
          AND punch_credentials.type = 'static'
          AND punch_credentials.revoked = FALSE;
      `, [value]);

    const user = result.rows[0];
    return user ? mapUser(user) : null;
  } catch (error) {
    LOGGER.error(`${DATABASE_QUERY_ERROR}\n${error}`);
    return null;
  } finally {
    client.release();
  }
}

export async function isSecretInUse(secret: string): Promise<boolean> {
  try {
    const result = await pool.query(`
      SELECT 1
      FROM punch_credentials
      WHERE secret = $1;
    `, [secret]);

    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    LOGGER.error(`${DATABASE_QUERY_ERROR}\n${error}`);
    return false;
  }
}

export async function getPunchCredential(id: string): Promise<PunchCredential | null> {
  try {
    const result = await pool.query(`
      SELECT id, user_id, type, secret, revoked
      FROM punch_credentials
      WHERE id = $1
        AND revoked = FALSE;
    `, [id]);

    const credential = result.rows[0];
    return credential ? mapCredential(credential) : null;
  } catch (error) {
    LOGGER.error(`${DATABASE_QUERY_ERROR}\n${error}`);
    return null;
  }
}

export async function createPunchCredential(userId: number, type: PunchCredentialType, secret: string): Promise<PunchCredential | null> {
  try {
    const result = await pool.query(`
      INSERT INTO punch_credentials (id, user_id, type, secret)
      VALUES ($1, $2, $3, $4)
      RETURNING id, user_id, type, secret, revoked;
    `, [randomUUID(), userId, type, secret]);

    const credential = result.rows[0];
    return credential ? mapCredential(credential) : null;
  } catch (error) {
    LOGGER.error(`${DATABASE_QUERY_ERROR}\n${error}`);
    return null;
  }
}

export async function regeneratePunchCredential(userId: number, type: PunchCredentialType, secret: string): Promise<PunchCredential | null> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(`
      UPDATE punch_credentials
      SET revoked = TRUE
      WHERE user_id = $1
        AND type = $2
        AND revoked = FALSE;
    `, [userId, type]);

    const result = await client.query(`
      INSERT INTO punch_credentials (id, user_id, type, secret)
      VALUES ($1, $2, $3, $4)
      RETURNING id, user_id, type, secret, revoked;
    `, [randomUUID(), userId, type, secret]);

    const credential = result.rows[0];

    if (!credential) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query("COMMIT");
    return mapCredential(credential);
  } catch (error) {
    await client.query("ROLLBACK");
    LOGGER.error(`${DATABASE_QUERY_ERROR}\n${error}`);
    return null;
  } finally {
    client.release();
  }
}

export async function revokePunchCredential(id: string): Promise<boolean> {
  const result = await pool.query(`
    UPDATE punch_credentials
    SET revoked = TRUE
    WHERE id = $1
      AND revoked = FALSE;
  `, [id]);

  return (result.rowCount ?? 0) === 1;
}

export async function isPunchedIn(user: User): Promise<boolean | null> {
  try {
    const result = await pool.query(`
      SELECT 1
      FROM sessions
      WHERE user_id = $1
        AND time_out IS NULL;
    `, [user.id]);

    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    LOGGER.error(`${DATABASE_QUERY_ERROR}\n${error}`);
    return null;
  }
}

export async function createUser(fullName: string, role: UserRole, credentialType: PunchCredentialType, credentialSecret: string): Promise<UserWithCredential | null> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(`
      INSERT INTO users (full_name, role)
      VALUES ($1, $2)
      RETURNING id, full_name, role;
    `, [fullName, role]);

    const userRow = result.rows[0];

    if (!userRow) {
      await client.query("ROLLBACK");
      return null;
    }

    const credentialResult = await client.query(`
      INSERT INTO punch_credentials (id, user_id, type, secret)
      VALUES ($1, $2, $3, $4)
      RETURNING id, user_id, type, secret, revoked;
    `, [randomUUID(), userRow.id, credentialType, credentialSecret]);

    const credentialRow = credentialResult.rows[0];

    if (!credentialRow) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query("COMMIT");
    return {
      user: mapUser(userRow),
      credential: mapCredential(credentialRow),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    LOGGER.error(`${DATABASE_QUERY_ERROR}\n${error}`);
    return null;
  } finally {
    client.release();
  }
}

export async function setUserRole(id: number, role: UserRole): Promise<User | null> {
  try {
    const result = await pool.query(`
      UPDATE users
      SET role = $2
      WHERE id = $1
      RETURNING id, full_name, role;
    `, [id, role]);

    const userRow = result.rows[0];
    return userRow ? mapUser(userRow) : null;
  } catch (error) {
    LOGGER.error(`${DATABASE_QUERY_ERROR}\n${error}`);
    return null;
  }
}

async function getMostRecentSession(client: PoolClient, userId: number): Promise<Session | null> {
  const result = await client.query(`
    SELECT id, user_id, time_in, time_out
    FROM sessions
    WHERE user_id = $1
    ORDER BY GREATEST(time_in, COALESCE(time_out, time_in)) DESC
    LIMIT 1;
  `, [userId]);

  const session = result.rows[0];
  return session ? mapSession(session) : null;
}

export async function handlePunch(user: User): Promise<Session | null> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Block other transactions for this user
    await client.query("SELECT pg_advisory_xact_lock($1);", [user.id]);

    const now = Date.now();
    const mostRecentSession = await getMostRecentSession(client, user.id);
    const mostRecentPunch = mostRecentSession ? (mostRecentSession.timeOut ?? mostRecentSession.timeIn) : null;

    // Treat rapid repeat scans as the same punch instead of toggling twice.
    if (mostRecentSession && mostRecentPunch !== null && now - mostRecentPunch < DUPLICATE_PUNCH_WINDOW_MS) {
      await client.query("COMMIT");
      return mostRecentSession;
    }

    const openSession = await client.query(`
      SELECT id
      FROM sessions
      WHERE user_id = $1
        AND time_out IS NULL;
    `, [user.id]);

    const result = (openSession.rowCount ?? 0) > 0
      ? await client.query(`
        UPDATE sessions
        SET time_out = $2
        WHERE user_id = $1
          AND time_out IS NULL
        RETURNING id, user_id, time_in, time_out;
      `, [user.id, now])
      : await client.query(`
        INSERT INTO sessions (user_id, time_in)
        VALUES ($1, $2)
        RETURNING id, user_id, time_in, time_out;
      `, [user.id, now]);

    const session = result.rows[0];

    if (!session) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query("COMMIT");
    return mapSession(session);
  } catch (error) {
    await client.query("ROLLBACK");
    LOGGER.error(`${DATABASE_QUERY_ERROR}\n${error}`);
    return null;
  } finally {
    client.release();
  }
}

export async function getSessions(user: User): Promise<Session[] | null> {
  try {
    const result = await pool.query(`
      SELECT id, user_id, time_in, time_out
      FROM sessions
      WHERE user_id = $1
      ORDER BY time_in DESC;
    `, [user.id]);

    return result.rows.map(mapSession);
  } catch (error) {
    LOGGER.error(`${DATABASE_QUERY_ERROR}\n${error}`);
    return null;
  }
}

export async function listUsers(): Promise<User[]> {
  try {
    const result = await pool.query(`
      SELECT id, full_name, role
      FROM users
      ORDER BY full_name;
    `);

    return result.rows.map(mapUser);
  } catch (error) {
    LOGGER.error(`${DATABASE_QUERY_ERROR}\n${error}`);
    return [];
  }
}

export async function getAdminUserByUsername(username: string): Promise<AdminUser | null> {
  try {
    const result = await pool.query(`
      SELECT id, username, password_hash, disabled, created_at
      FROM admin_users
      WHERE username = $1;
    `, [username]);

    const adminUser = result.rows[0];
    return adminUser ? mapAdminUser(adminUser) : null;
  } catch (error) {
    LOGGER.error(`${DATABASE_QUERY_ERROR}\n${error}`);
    return null;
  }
}

export async function createAdminUser(username: string, passwordHash: string): Promise<AdminUser | null> {
  try {
    const result = await pool.query(`
      INSERT INTO admin_users (username, password_hash)
      VALUES ($1, $2)
      RETURNING id, username, password_hash, disabled, created_at;
    `, [username, passwordHash]);

    const adminUser = result.rows[0];
    return adminUser ? mapAdminUser(adminUser) : null;
  } catch (error) {
    LOGGER.error(`${DATABASE_QUERY_ERROR}\n${error}`);
    return null;
  }
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  try {
    const result = await pool.query(`
      SELECT id, username, password_hash, disabled, created_at
      FROM admin_users
      ORDER BY created_at;
    `);

    return result.rows.map(mapAdminUser);
  } catch (error) {
    LOGGER.error(`${DATABASE_QUERY_ERROR}\n${error}`);
    return [];
  }
}

export async function setAdminUserDisabled(id: number, disabled: boolean): Promise<AdminUser | null> {
  try {
    const result = await pool.query(`
      UPDATE admin_users
      SET disabled = $2
      WHERE id = $1
      RETURNING id, username, password_hash, disabled, created_at;
    `, [id, disabled]);

    const adminUser = result.rows[0];
    return adminUser ? mapAdminUser(adminUser) : null;
  } catch (error) {
    LOGGER.error(`${DATABASE_QUERY_ERROR}\n${error}`);
    return null;
  }
}

export async function listFluxerAdminIds(): Promise<FluxerAdminId[]> {
  try {
    const result = await pool.query(`
      SELECT id, fluxer_id, label, added_by, created_at
      FROM fluxer_admin_ids
      ORDER BY created_at;
    `);

    return result.rows.map(mapFluxerAdminId);
  } catch (error) {
    LOGGER.error(`${DATABASE_QUERY_ERROR}\n${error}`);
    return [];
  }
}

export async function isFluxerIdInDatabase(fluxerId: string): Promise<boolean> {
  try {
    const result = await pool.query(`
      SELECT 1
      FROM fluxer_admin_ids
      WHERE fluxer_id = $1;
    `, [fluxerId]);

    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    LOGGER.error(`${DATABASE_QUERY_ERROR}\n${error}`);
    return false;
  }
}

export async function addFluxerAdminId(fluxerId: string, label: string | null, addedBy: string | null): Promise<FluxerAdminId | null> {
  try {
    const result = await pool.query(`
      INSERT INTO fluxer_admin_ids (fluxer_id, label, added_by)
      VALUES ($1, $2, $3)
      RETURNING id, fluxer_id, label, added_by, created_at;
    `, [fluxerId, label, addedBy]);

    const fluxerAdminId = result.rows[0];
    return fluxerAdminId ? mapFluxerAdminId(fluxerAdminId) : null;
  } catch (error) {
    LOGGER.error(`${DATABASE_QUERY_ERROR}\n${error}`);
    return null;
  }
}

export async function removeFluxerAdminId(id: number): Promise<boolean> {
  try {
    const result = await pool.query(`
      DELETE FROM fluxer_admin_ids
      WHERE id = $1;
    `, [id]);

    return (result.rowCount ?? 0) === 1;
  } catch (error) {
    LOGGER.error(`${DATABASE_QUERY_ERROR}\n${error}`);
    return false;
  }
}

export async function listCurrentlyPunchedIn(): Promise<CurrentlyPunchedIn[]> {
  try {
    const result = await pool.query(`
      SELECT users.id AS user_id, users.full_name, sessions.time_in
      FROM sessions
      INNER JOIN users ON users.id = sessions.user_id
      WHERE sessions.time_out IS NULL
      ORDER BY sessions.time_in ASC;
    `);

    return result.rows.map((row) => ({
      userId: Number(row.user_id),
      fullName: String(row.full_name),
      timeIn: Number(row.time_in),
    }));
  } catch (error) {
    LOGGER.error(`${DATABASE_QUERY_ERROR}\n${error}`);
    return [];
  }
}

export async function getSessionsForDateRange(startMs: number, endMs: number): Promise<SessionWithUser[]> {
  try {
    const result = await pool.query(`
      SELECT sessions.id, sessions.user_id, sessions.time_in, sessions.time_out, users.full_name
      FROM sessions
      INNER JOIN users ON users.id = sessions.user_id
      WHERE sessions.time_in >= $1
        AND sessions.time_in < $2
      ORDER BY users.full_name, sessions.time_in;
    `, [startMs, endMs]);

    return result.rows.map((row) => ({
      ...mapSession(row),
      fullName: String(row.full_name),
    }));
  } catch (error) {
    LOGGER.error(`${DATABASE_QUERY_ERROR}\n${error}`);
    return [];
  }
}

export const DATABASE_QUERY_ERROR = "Database query error";
