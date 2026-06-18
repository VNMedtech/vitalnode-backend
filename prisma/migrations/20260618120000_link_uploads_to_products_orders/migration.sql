-- Link FileUpload records to ProductMedia, ProductDocument, and OrderProof

ALTER TABLE "ProductMedia" ADD COLUMN "fileUploadId" TEXT;
ALTER TABLE "ProductDocument" ADD COLUMN "fileUploadId" TEXT;
ALTER TABLE "OrderProof" ADD COLUMN "fileUploadId" TEXT;

CREATE UNIQUE INDEX "ProductMedia_fileUploadId_key" ON "ProductMedia"("fileUploadId");
CREATE UNIQUE INDEX "ProductDocument_fileUploadId_key" ON "ProductDocument"("fileUploadId");
CREATE UNIQUE INDEX "OrderProof_fileUploadId_key" ON "OrderProof"("fileUploadId");

ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_fileUploadId_fkey" FOREIGN KEY ("fileUploadId") REFERENCES "FileUpload"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductDocument" ADD CONSTRAINT "ProductDocument_fileUploadId_fkey" FOREIGN KEY ("fileUploadId") REFERENCES "FileUpload"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderProof" ADD CONSTRAINT "OrderProof_fileUploadId_fkey" FOREIGN KEY ("fileUploadId") REFERENCES "FileUpload"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
