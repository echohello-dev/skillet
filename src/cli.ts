#!/usr/bin/env bun
import { cac } from "cac";

const COMMANDS = ["add", "find", "check", "update", "init", "generate-lock"] as const;
type CommandName = (typeof COMMANDS)[number];

type GlobalFlags = {
  yes: boolean;
  verbose: boolean;
};

type CommandOptions = {
  yes?: boolean;
  verbose?: boolean;
};

declare const SKILLET_VERSION: string | undefined;

const VERSION =
  typeof SKILLET_VERSION === "string" && SKILLET_VERSION.length > 0
    ? SKILLET_VERSION
    : process.env.SKILLET_VERSION ?? "dev";

const COMMAND_HELP: Record<CommandName, string> = {
  add: "Install skills from a source",
  find: "Search available skills",
  check: "Check for updates to installed skills",
  update: "Update installed skills",
  init: "Create a SKILL.md template",
  "generate-lock": "Generate skillet.lock.yaml",
};

const cli = cac("skillet");

cli
  .option("-y, --yes", "Skip confirmations")
  .option("--verbose", "Enable verbose output")
  .version(VERSION, "-v, --version")
  .help();

function toGlobalFlags(options: CommandOptions): GlobalFlags {
  return {
    yes: Boolean(options.yes),
    verbose: Boolean(options.verbose),
  };
}

function runCommand(command: CommandName, args: string[], flags: GlobalFlags): number {
  if (flags.verbose) {
    console.error(`Running ${command} with args: ${args.join(" ")}`);
  }

  console.error(`Command "${command}" is not implemented yet.`);
  return 2;
}

function addCommand(command: CommandName): void {
  cli
    .command(`${command} [...args]`, COMMAND_HELP[command])
    .action((args: string[], options: CommandOptions) => {
      const exitCode = runCommand(command, args, toGlobalFlags(options));
      process.exitCode = exitCode;
    });
}

for (const command of COMMANDS) {
  addCommand(command);
}

cli.on("command:*", (commands) => {
  console.error(`Unknown command: ${commands.join(" ")}`);
  cli.outputHelp();
  process.exit(1);
});

if (process.argv.length <= 2) {
  cli.outputHelp();
} else {
  cli.parse();
}
