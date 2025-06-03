-- CreateTable
CREATE TABLE "billing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "emailCount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "billing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "email_analytics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "emailLogId" TEXT NOT NULL,
    "openedAt" DATETIME,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "lastClickedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_analytics_emailLogId_fkey" FOREIGN KEY ("emailLogId") REFERENCES "email_logs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "email_analytics_emailLogId_key" ON "email_analytics"("emailLogId");
