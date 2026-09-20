-- AlterTable
ALTER TABLE "Account" ADD COLUMN "enabledModels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
