import { DefaultAzureCredential } from "@azure/identity";
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

const resolveAzureClient = (
  accountName: string,
  accountKey: string | undefined,
  connectionString: string | undefined,
): BlobServiceClient => {
  const endpoint = `https://${accountName}.blob.core.windows.net`;
  if (accountKey) {
    return new BlobServiceClient(endpoint, new StorageSharedKeyCredential(accountName, accountKey));
  }
  if (connectionString) {
    return BlobServiceClient.fromConnectionString(connectionString);
  }
  // Geen sleutel of connection-string: managed identity (DefaultAzureCredential).
  // De veilige weg op Azure Container Apps via de Blob Data Contributor-rol,
  // zonder langlevende account-key in de configuratie.
  return new BlobServiceClient(endpoint, new DefaultAzureCredential());
};

const azureProvider = (): StorageProvider | null => {
  const { accountName, accountKey, connectionString, containerName } = config.storage.azure;
  if (!accountName || !containerName) return null;

  const client = resolveAzureClient(accountName, accountKey, connectionString);
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
      "No storage provider configured. Set AZURE_STORAGE_ACCOUNT_NAME (+ key, connection string, or managed identity).",
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
