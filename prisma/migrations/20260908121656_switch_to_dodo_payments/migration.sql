-- DropIndex
DROP INDEX "Payment_razorpayOrderId_key";

-- DropIndex
DROP INDEX "Payment_razorpayPaymentId_key";

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "amountInr",
DROP COLUMN "razorpayOrderId",
DROP COLUMN "razorpayPaymentId",
ADD COLUMN     "amountCents" INTEGER NOT NULL,
ADD COLUMN     "dodoCheckoutId" TEXT NOT NULL,
ADD COLUMN     "dodoPaymentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_dodoCheckoutId_key" ON "Payment"("dodoCheckoutId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_dodoPaymentId_key" ON "Payment"("dodoPaymentId");

