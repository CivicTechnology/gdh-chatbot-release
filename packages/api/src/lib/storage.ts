import { BlobServiceClient, StorageSharedKeyCredential } from "@azure/storage-blob";
import { config } from "@/config/index.js";

export type UploadResult = {
  url: string;
  pathname: string;
  contentType: string;
};

type StorageProvider = {
  upload: (filename: string, buffer: Buffer, contentType: string) => Promise<UploadResult>;
};

const azureProvider = (): StorageProvider | null => {
  const { accountName, accountKey, containerName } = config.storage.azure;
  if (!accountName || !containerName) return null;

  const credential = accountKey
    ? new StorageSharedKeyCredential(accountName, accountKey)
    : undefined;

  const client = credential
    ? new BlobServiceClient(`https://${accountName}.blob.core.windows.net`, credential)
    : BlobServiceClient.fromConnectionString(
        config.storage.azure.connectionString ?? "",
      );

  const container = client.getContainerClient(containerName);

  return {
    upload: async (filename, buffer, contentType) => {
      const blob = container.getBlockBlobClient(filename);
      await blob.uploadData(buffer, {
        blobHTTPHeaders: { blobContentType: contentType },
      });
      return {
        url: blob.url,
        pathname: filename,
        contentType,
      };
    },
  };
};

const resolveProvider = (): StorageProvider => {
  const provider = azureProvider();
  if (!provider) {
    throw new Error(
      "No storage provider configured. Set AZURE_STORAGE_ACCOUNT_NAME (+ key or connection string).",
    );
  }
  return provider;
};

let cached: StorageProvider | null = null;
export const storage = {
  upload: (filename: string, buffer: Buffer, contentType: string) => {
    cached ??= resolveProvider();
    return cached.upload(filename, buffer, contentType);
  },
};
