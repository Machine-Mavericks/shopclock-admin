import chalk from "chalk";
import { closeSync, openSync, writeSync } from "node:fs";
import { inspect } from "node:util";
import { IS_PRODUCTION } from "./constants";

export type Severity = "DEBUG" | "INFO" | "WARN" | "ERROR"

export abstract class Logger {
  abstract log(severity: Severity, message: unknown): void;

  info(message: unknown): void {
    this.log("INFO", message);
  }

  debug(message: unknown): void {
    this.log("DEBUG", message);
  
  }

  warn(message: unknown): void {
    this.log("WARN", message);
  }

  error(message: unknown): void {
    this.log("ERROR", message);
  }

  protected formatMessage(message: unknown): string {
    if (message instanceof Error) {
      return message.stack ?? message.message;
    }

    if (typeof message === "string") {
      return message;
    }

    return inspect(message, {
      depth: null,
      colors: false,
    });
  }
}

export class FileLogger extends Logger {
  private readonly fileHandle: number;

  constructor(filePath: string) {
    super();
    this.fileHandle = openSync(filePath, "a")
  }

  log(severity: Severity, message: unknown): void {
    const timestamp = new Date().toISOString();
    const formatted = this.formatMessage(message);

    writeSync(
      this.fileHandle,
      `[${timestamp}] [${severity}] ${formatted}\n`
    );
  }

  close(): void {
    closeSync(this.fileHandle);
  }
}

export class ConsoleLogger extends Logger {
  log(severity: Severity, message: unknown): void {
    if (severity === "DEBUG" && IS_PRODUCTION) {
      return;
    }

    const timestamp = new Date().toLocaleTimeString();
    const formatted = this.formatMessage(message);

    const prefix = `[${timestamp}] [${severity}]`;

    const output = {
      DEBUG: chalk.blueBright(`${prefix} ${formatted}`),
      INFO: chalk.greenBright(`${prefix} ${formatted}`),
      WARN: chalk.yellow(`${prefix} ${formatted}`),
      ERROR: chalk.bold.red(`${prefix} ${formatted}`),
    } satisfies Record<Severity, string>;

    if (severity === "ERROR") {
      console.error(output[severity]);
    } else if (severity === "WARN") {
      console.warn(output[severity]);
    } else {
      console.log(output[severity]);
    }
  }
}
