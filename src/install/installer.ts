import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export class InstallConflictError extends Error {
  readonly path: string;

  constructor(message: string, conflictPath: string) {
    super(message);
    this.name = "InstallConflictError";
    this.path = conflictPath;
  }
}

export type InstallMethod = "symlink" | "copy";

export type InstallSkillOptions = {
  sourceId: string;
  sourceSkillPath: string;
  storageRoot: string;
  targetSkillsDir: string;
  preferCopy?: boolean;
  symlinkFn?: (targetPath: string, linkPath: string, type: fs.symlink.Type) => void;
};

export type InstallSkillResult = {
  skillName: string;
  storagePath: string;
  installedPath: string;
  method: InstallMethod;
  changed: boolean;
  message: string;
};

export function installSkill(options: InstallSkillOptions): InstallSkillResult {
  const sourceSkillPath = path.resolve(options.sourceSkillPath);
  const storageRoot = path.resolve(options.storageRoot);
  const targetSkillsDir = path.resolve(options.targetSkillsDir);

  if (!isDirectory(sourceSkillPath)) {
    throw new InstallConflictError(`Source skill path is not a directory: ${sourceSkillPath}`, sourceSkillPath);
  }

  if (fs.existsSync(targetSkillsDir) && !isDirectory(targetSkillsDir)) {
    throw new InstallConflictError(
      `Target skills directory must be a directory: ${targetSkillsDir}`,
      targetSkillsDir
    );
  }

  const skillName = path.basename(sourceSkillPath);
  const sourceDigest = digestSourceId(options.sourceId);
  const storagePath = path.join(storageRoot, sourceDigest, skillName);
  const installedPath = path.join(targetSkillsDir, skillName);

  assertReplaceableInstallPath(installedPath);
  fs.mkdirSync(targetSkillsDir, { recursive: true });
  replaceDirectoryAtomically(sourceSkillPath, storagePath);

  const method = installIntoTarget({
    storagePath,
    installedPath,
    preferCopy: options.preferCopy === true,
    symlinkFn: options.symlinkFn,
  });

  const action = method === "symlink" ? "symlinked" : "copied";

  return {
    skillName,
    storagePath,
    installedPath,
    method,
    changed: true,
    message: `${action} ${skillName} to ${installedPath}`,
  };
}

function installIntoTarget(options: {
  storagePath: string;
  installedPath: string;
  preferCopy: boolean;
  symlinkFn?: (targetPath: string, linkPath: string, type: fs.symlink.Type) => void;
}): InstallMethod {
  if (options.preferCopy) {
    replaceDirectoryAtomically(options.storagePath, options.installedPath);
    return "copy";
  }

  try {
    replaceSymlinkAtomically(
      options.storagePath,
      options.installedPath,
      options.symlinkFn ?? fs.symlinkSync
    );
    return "symlink";
  } catch {
    replaceDirectoryAtomically(options.storagePath, options.installedPath);
    return "copy";
  }
}

function replaceDirectoryAtomically(sourcePath: string, destinationPath: string): void {
  const destinationParent = path.dirname(destinationPath);
  fs.mkdirSync(destinationParent, { recursive: true });

  const tempPath = path.join(destinationParent, `${path.basename(destinationPath)}.tmp-${randomSuffix()}`);
  fs.cpSync(sourcePath, tempPath, { recursive: true, force: true });

  try {
    removePathIfExists(destinationPath);
    fs.renameSync(tempPath, destinationPath);
  } catch (error) {
    removePathIfExists(tempPath);
    throw error;
  }
}

function replaceSymlinkAtomically(
  targetPath: string,
  linkPath: string,
  symlinkFn: (targetPath: string, linkPath: string, type: fs.symlink.Type) => void
): void {
  const linkParent = path.dirname(linkPath);
  fs.mkdirSync(linkParent, { recursive: true });

  const tempLinkPath = path.join(linkParent, `${path.basename(linkPath)}.tmp-link-${randomSuffix()}`);
  symlinkFn(targetPath, tempLinkPath, "dir");

  try {
    removePathIfExists(linkPath);
    fs.renameSync(tempLinkPath, linkPath);
  } catch (error) {
    removePathIfExists(tempLinkPath);
    throw error;
  }
}

function assertReplaceableInstallPath(installPath: string): void {
  if (!fs.existsSync(installPath)) {
    return;
  }

  const entry = fs.lstatSync(installPath);
  if (entry.isDirectory() || entry.isSymbolicLink()) {
    return;
  }

  throw new InstallConflictError(
    `Install conflict at ${installPath}: existing path is not a directory or symlink`,
    installPath
  );
}

function removePathIfExists(targetPath: string): void {
  if (!fs.existsSync(targetPath)) {
    return;
  }

  fs.rmSync(targetPath, { recursive: true, force: true });
}

function isDirectory(candidatePath: string): boolean {
  try {
    return fs.statSync(candidatePath).isDirectory();
  } catch {
    return false;
  }
}

function digestSourceId(sourceId: string): string {
  return crypto.createHash("sha256").update(sourceId).digest("hex").slice(0, 16);
}

function randomSuffix(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}
