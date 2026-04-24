import fs from "node:fs";
import path from "node:path";

import initSqlJs from "sql.js";

const dbPath = path.join(process.cwd(), "prisma", "dev.db");

const schemaSql = `
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS "StatusHistory";
DROP TABLE IF EXISTS "Candidate";
DROP TABLE IF EXISTS "Project";
DROP TABLE IF EXISTS "CVFile";
DROP TABLE IF EXISTS "WorkspaceMember";
DROP TABLE IF EXISTS "Workspace";
DROP TABLE IF EXISTS "User";

CREATE TABLE "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'USER',
  "emailVerifiedAt" DATETIME,
  "emailVerificationTokenHash" TEXT,
  "emailVerificationTokenExpiresAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_emailVerificationTokenHash_key" ON "User"("emailVerificationTokenHash");

CREATE TABLE "Workspace" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Workspace_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "WorkspaceMember" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'HR',
  "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceMember_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorkspaceMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key"
  ON "WorkspaceMember"("workspaceId", "userId");

CREATE TABLE "CVFile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "uploadedBy" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "filePath" TEXT,
  "mimeType" TEXT,
  "fileSize" INTEGER NOT NULL,
  "rawText" TEXT NOT NULL,
  "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CVFile_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CVFile_uploadedBy_fkey"
    FOREIGN KEY ("uploadedBy") REFERENCES "User" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Project" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Project_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Project_workspaceId_name_key" ON "Project"("workspaceId", "name");

CREATE TABLE "Candidate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "hrId" TEXT NOT NULL,
  "cvFileId" TEXT,
  "projectId" TEXT,
  "fullName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "dateOfBirth" TEXT,
  "address" TEXT,
  "hometown" TEXT,
  "school" TEXT,
  "graduationYear" TEXT,
  "yearsOfExperience" INTEGER,
  "skillsJson" TEXT,
  "summary" TEXT,
  "position" TEXT,
  "source" TEXT,
  "offerSalary" TEXT,
  "notes" TEXT,
  "interviewDate" TEXT,
  "interviewerName" TEXT,
  "interviewFeedback" TEXT,
  "managerDecision" TEXT,
  "managerOfferSalary" TEXT,
  "managerReviewNote" TEXT,
  "managerReviewedAt" DATETIME,
  "managerReviewedById" TEXT,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Candidate_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Candidate_hrId_fkey"
    FOREIGN KEY ("hrId") REFERENCES "User" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Candidate_cvFileId_fkey"
    FOREIGN KEY ("cvFileId") REFERENCES "CVFile" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Candidate_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Candidate_managerReviewedById_fkey"
    FOREIGN KEY ("managerReviewedById") REFERENCES "User" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Candidate_cvFileId_key" ON "Candidate"("cvFileId");

CREATE TABLE "StatusHistory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "candidateId" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "note" TEXT,
  "changedBy" TEXT NOT NULL,
  "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StatusHistory_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StatusHistory_changedBy_fkey"
    FOREIGN KEY ("changedBy") REFERENCES "User" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

PRAGMA foreign_keys = ON;
`;

async function main() {
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(process.cwd(), "node_modules", "sql.js", "dist", file),
  });

  const db = new SQL.Database();
  db.run(schemaSql);

  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
  db.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
