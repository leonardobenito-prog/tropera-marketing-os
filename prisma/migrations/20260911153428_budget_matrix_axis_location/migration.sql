-- CreateEnum
CREATE TYPE "BudgetAxis" AS ENUM ('RECOGNITION', 'PROMOTIONS', 'EVENTS', 'DELIVERY');

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "axis" "BudgetAxis";

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "axis" "BudgetAxis",
ADD COLUMN     "locationId" TEXT;

-- CreateTable
CREATE TABLE "BudgetMatrixEntry" (
    "id" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetMatrixEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BudgetMatrixEntry_periodYear_periodMonth_key" ON "BudgetMatrixEntry"("periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "Expense_locationId_idx" ON "Expense"("locationId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
