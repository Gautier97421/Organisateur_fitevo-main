-- Pointage par QR code : heure de sortie sur le pointage, et codes à usage unique
-- envoyés par email pour valider un scan.

-- AlterTable
ALTER TABLE "time_entries" ADD COLUMN     "check_out_time" TIMESTAMP(3);
ALTER TABLE "time_entries" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'app';

-- CreateTable
CREATE TABLE "check_in_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "check_in_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "check_in_codes_user_id_gym_id_idx" ON "check_in_codes"("user_id", "gym_id");

-- AddForeignKey
ALTER TABLE "check_in_codes" ADD CONSTRAINT "check_in_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_in_codes" ADD CONSTRAINT "check_in_codes_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
