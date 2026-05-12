-- Make broker license_number optional. Brokers are not required to have a
-- license at signup; admins verify credentials out-of-band before flipping
-- verificationStatus to VERIFIED.
ALTER TABLE "brokers" ALTER COLUMN "licenseNumber" DROP NOT NULL;
