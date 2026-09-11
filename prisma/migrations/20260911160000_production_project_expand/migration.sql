-- AlterTable
ALTER TABLE "ProductionProject" DROP COLUMN "purpose",
ADD COLUMN     "assigneeId" TEXT,
ADD COLUMN     "budgetAmount" INTEGER,
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "format" TEXT NOT NULL DEFAULT 'Post',
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "referenceUrl" TEXT;

-- DropEnum
DROP TYPE "ProductionPurpose";

-- CreateIndex
CREATE INDEX "ProductionProject_assigneeId_idx" ON "ProductionProject"("assigneeId");

-- CreateIndex
CREATE INDEX "ProductionProject_campaignId_idx" ON "ProductionProject"("campaignId");

-- AddForeignKey
ALTER TABLE "ProductionProject" ADD CONSTRAINT "ProductionProject_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

