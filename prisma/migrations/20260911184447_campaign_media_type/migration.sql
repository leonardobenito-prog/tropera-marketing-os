-- CreateEnum
CREATE TYPE "CampaignMediaType" AS ENUM ('DIGITAL', 'ANALOG');

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "mediaType" "CampaignMediaType";
