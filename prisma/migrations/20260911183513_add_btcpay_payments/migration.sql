-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('DODO', 'BTCPAY');

-- AlterTable
ALTER TABLE "Payment"
  ALTER COLUMN "dodoCheckoutId" DROP NOT NULL,
  ADD COLUMN     "method" "PaymentMethod" NOT NULL DEFAULT 'DODO',
  ADD COLUMN     "btcpayInvoiceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_btcpayInvoiceId_key" ON "Payment"("btcpayInvoiceId");
