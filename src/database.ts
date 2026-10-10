import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USER, LOGGER } from "./constants";

export interface Student {
  id: number;
  fullName: string;
}

export type PunchCredentialType = "rotating" | "static";

export interface PunchCredential {
  id: string;
  studentId: number;
  type: PunchCredentialType;
  secret: string;
  revoked: boolean;
}

export interface Session {
  id: number;
  studentId: number;
  timeIn: number;
  timeOut: number | null;
}

export interface StudentWithCredential {
  student: Student;
  credential: PunchCredential;
}

export interface AdminUser {
  id: number;
  username: string;
  passwordHash: string;
  disabled: boolean;
}

const DUPLICATE_PUNCH_WINDOW_MS = 5000;

const pool = new Pool({
  user: DB_USER,
  password: DB_PASSWORD,
  host: DB_HOST,
  port: DB_PORT,
  database: DB_NAME,
});

function mapStudent(row: Record<string, unknown>): Student {
  return {
    id: Number(row.id),
    fullName: String(row.full_name),
  };
}

function mapCredential(row: Record<string, unknown>): PunchCredential {
  return {
    id: String(row.id),
    studentId: Number(row.student_id),
    type: row.type as PunchCredentialType,
    secret: String(row.secret),
    revoked: Boolean(row.revoked),
  };
}

function mapSession(row: Record<string, unknown>): Session {
  return {
    id: Number(row.id),
    studentId: Number(row.student_id),
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

    await client.query(`
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(100) NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS punch_credentials (
        id UUID PRIMARY KEY,
        student_id INTEGER NOT NULL,
        type VARCHAR(10) NOT NULL,
        secret VARCHAR(128) NOT NULL UNIQUE,
        revoked BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT fk_punch_credentials_student
          FOREIGN KEY (student_id)
          REFERENCES students(id)
          ON DELETE CASCADE,

        CONSTRAINT punch_credentials_type_check
          CHECK (type IN ('rotating', 'static'))
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL,
        time_in BIGINT NOT NULL,
        time_out BIGINT,

        CONSTRAINT fk_sessions_student
          FOREIGN KEY (student_id)
          REFERENCES students(id)
          ON DELETE CASCADE
      );
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS one_open_session_per_student
      ON sessions (student_id)
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

export async function getStudent(id: number): Promise<Student | null>;
export async function getStudent(staticSecret: string): Promise<Student | null>;

export async function getStudent(value: number | string): Promise<Student | null> {
  const client = await pool.connect();

  try {
    const result = typeof value === "number"
      ? await client.query(`
        SELECT id, full_name
        FROM students
        WHERE id = $1;
      `, [value])
      : await client.query(`
        SELECT students.id, students.full_name
        FROM students
        INNER JOIN punch_credentials
          ON punch_credentials.student_id = students.id
        WHERE punch_credentials.secret = $1
          AND punch_credentials.type = 'static'
          AND punch_credentials.revoked = FALSE;  
      `, [value]);

    const student = result.rows[0];
    return student ? mapStudent(student) : null;
  } catch (error) {
    LOGGER.error(`${DATABASE_QUERY_ERROR}\n${error}`);
    return null;
  } finally {
    client.release();
  }
}

export async function getPunchCredential(id: string): Promise<PunchCredential | null> {
  try {
    const result = await pool.query(`
      SELECT id, student_id, type, secret, revoked
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

export async function createPunchCredential(studentId: number, type: PunchCredentialType, secret: string): Promise<PunchCredential | null> {
  try {
    const result = await pool.query(`
      INSERT INTO punch_credentials (id, student_id, type, secret)
      VALUES ($1, $2, $3, $4)
      RETURNING id, student_id, type, secret, revoked;  
    `, [randomUUID(), studentId, type, secret]);

    const credential = result.rows[0];
    return credential ? mapCredential(credential) : null;
  } catch (error) {
    LOGGER.error(`${DATABASE_QUERY_ERROR}\n${error}`);
    return null;
  }
}

export async function regeneratePunchCredential(studentId: number, type: PunchCredentialType, secret: string): Promise<PunchCredential | null> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(`
      UPDATE punch_credentials
      SET revoked = TRUE
      WHERE student_id = $1
        AND type = $2
        AND revoked = FALSE;
    `, [studentId, type]);

    const result = await client.query(`
      INSERT INTO punch_credentials (id, student_id, type, secret)
      VALUES ($1, $2, $3, $4)
      RETURNING id, student_id, type, secret, revoked;
    `, [randomUUID(), studentId, type, secret]);

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

export async function isPunchedIn(student: Student): Promise<boolean | null> {
  try {
    const result = await pool.query(`
      SELECT 1
      FROM sessions
      WHERE student_id = $1
        AND time_out IS NULL;
    `, [student.id]);

    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    LOGGER.error(`${DATABASE_QUERY_ERROR}\n${error}`);
    return null;
  }
}

export async function createStudent(fullName: string, credentialType: PunchCredentialType, credentialSecret: string): Promise<StudentWithCredential | null> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(`
      INSERT INTO students (full_name)
      VALUES ($1)
      RETURNING id, full_name;
    `, [fullName]);

    const studentRow = result.rows[0];

    if (!studentRow) {
      await client.query("ROLLBACK");
      return null;
    }

    const credentialResult = await client.query(`
      INSERT INTO punch_credentials (id, student_id, type, secret)
      VALUES ($1, $2, $3, $4)
      RETURNING id, student_id, type, secret, revoked;  
    `, [randomUUID(), studentRow.id, credentialType, credentialSecret]);
    
    const credentialRow = credentialResult.rows[0];

    if (!credentialRow) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query("COMMIT");
    return {
      student: mapStudent(studentRow),
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

async function getMostRecentSession(client: PoolClient, studentId: number): Promise<Session | null> {
  const result = await client.query(`
    SELECT id, student_id, time_in, time_out
    FROM sessions
    WHERE student_id = $1
    ORDER BY GREATEST(time_in, COALESCE(time_out, time_in)) DESC
    LIMIT 1;
  `, [studentId]);

  const session = result.rows[0];
  return session ? mapSession(session) : null;
}

export async function handlePunch(student: Student): Promise<Session | null> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Block other transactions for student
    await client.query("SELECT pg_advisory_xact_lock($1);", [student.id]);

    const now = Date.now();
    const mostRecentSession = await getMostRecentSession(client, student.id);
    const mostRecentPunch = mostRecentSession ? (mostRecentSession.timeOut ?? mostRecentSession.timeIn) : null;

    // Treat rapid repeat scans as the same punch instead of toggling twice.
    if (mostRecentSession && mostRecentPunch !== null && now - mostRecentPunch < DUPLICATE_PUNCH_WINDOW_MS) {
      await client.query("COMMIT");
      return mostRecentSession;
    }

    const openSession = await client.query(`
      SELECT id
      FROM sessions
      WHERE student_id = $1
        AND time_out IS NULL;
    `, [student.id]);

    const result = (openSession.rowCount ?? 0) > 0
      ? await client.query(`
        UPDATE sessions
        SET time_out = $2
        WHERE student_id = $1
          AND time_out IS NULL
        RETURNING id, student_id, time_in, time_out;  
      `, [student.id, now])
      : await client.query(`
        INSERT INTO sessions (student_id, time_in)
        VALUES ($1, $2)
        RETURNING id, student_id, time_in, time_out;  
      `, [student.id, now]);

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

export async function getSessions(student: Student): Promise<Session[] | null> {
  try {
    const result = await pool.query(`
      SELECT id, student_id, time_in, time_out
      FROM sessions
      WHERE student_id = $1
      ORDER BY time_in DESC;  
    `, [student.id]);

    return result.rows.map(mapSession);
  } catch (error) {
    LOGGER.error(`${DATABASE_QUERY_ERROR}\n${error}`);
    return null;
  }
}

export async function listStudents(): Promise<Student[]> {
  try {
    const result = await pool.query(`
      SELECT id, full_name
      FROM students
      ORDER BY full_name;
    `);

    return result.rows.map(mapStudent);
  } catch (error) {
    LOGGER.error(`${DATABASE_QUERY_ERROR}\n${error}`);
    return [];
  }
}

export async function getAdminUserByUsername(username: string): Promise<AdminUser | null> {
  try {
    const result = await pool.query(`
      SELECT id, username, password_hash, disabled
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
      RETURNING id, username, password_hash, disabled;
    `, [username, passwordHash]);

    const adminUser = result.rows[0];
    return adminUser ? mapAdminUser(adminUser) : null;
  } catch (error) {
    LOGGER.error(`${DATABASE_QUERY_ERROR}\n${error}`);
    return null;
  }
}

export const DATABASE_QUERY_ERROR = "Database query error";