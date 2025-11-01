import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Uppy from "@uppy/core";
import type { UppyFile, UploadResult } from "@uppy/core";
import { DashboardModal } from "@uppy/react";
import XHRUpload from "@uppy/xhr-upload";
import { Button } from "@/components/ui/button";

interface CloudinaryUploadParams {
  uploadUrl: string;
  uploadPreset?: string;
  signature?: string;
  timestamp?: number;
  apiKey?: string;
  folder?: string;
}

interface CloudinaryUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onGetUploadParameters: () => Promise<CloudinaryUploadParams>;
  onComplete?: (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => void;
  buttonClassName?: string;
  children: ReactNode;
  allowedFileTypes?: string[];
}

export function CloudinaryUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 524288000, // 500MB for videos
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
  allowedFileTypes = ['video/*', 'image/*'],
}: CloudinaryUploaderProps) {
  const [showModal, setShowModal] = useState(false);
  const [uppy] = useState(() =>
    new Uppy({
      restrictions: {
        maxNumberOfFiles,
        maxFileSize,
        allowedFileTypes: allowedFileTypes.length > 0 ? allowedFileTypes : undefined,
      },
      autoProceed: false,
    }).use(XHRUpload, {
      endpoint: "placeholder", // Will be updated before upload
      method: "POST",
      formData: true,
      fieldName: "file",
      responseType: "json",
      getResponseData: (responseText: string) => {
        try {
          const response = JSON.parse(responseText);
          return {
            ...response,
            uploadURL: response.secure_url || response.url,
          };
        } catch (error) {
          console.error("Failed to parse upload response", error);
          return {};
        }
      },
    })
  );

  useEffect(() => {
    const handleComplete = (
      result: UploadResult<Record<string, unknown>, Record<string, unknown>>
    ) => {
      if (result.failed.length > 0 && result.successful.length === 0) {
        uppy.info("Upload failed. Please try again.", "error", 5000);
        return;
      }

      if (result.successful.length > 0) {
        setShowModal(false);
        onComplete?.(result);
        uppy.reset();
      }
    };

    const handleUploadError = (file: UppyFile, error: Error) => {
      console.error("Upload error", error, file);
      uppy.info("Upload failed. Please try again.", "error", 5000);
    };

    uppy.on("complete", handleComplete);
    uppy.on("upload-error", handleUploadError);

    return () => {
      uppy.off("complete", handleComplete);
      uppy.off("upload-error", handleUploadError);
    };
  }, [onComplete, uppy]);

  useEffect(() => {
    const prepareUpload = async (fileIDs: string[]) => {
      await Promise.all(
        fileIDs.map(async (fileID) => {
          const file = uppy.getFile(fileID) as UppyFile | undefined;

          if (!file) {
            return;
          }

          try {
            const params = await onGetUploadParameters();
            const xhrUpload = uppy.getPlugin<XHRUpload>("XHRUpload") as XHRUpload | undefined;

            if (xhrUpload) {
              xhrUpload.setOptions({ endpoint: params.uploadUrl });
            }

            const xhrOptions = {
              ...(file.xhrUpload ?? {}),
              endpoint: params.uploadUrl,
              method: "POST",
              formData: true,
              fieldName: "file",
            };

            uppy.setFileState(fileID, {
              xhrUpload: xhrOptions,
            });

            const meta: Record<string, string> = {};

            if (params.uploadPreset) {
              meta.upload_preset = params.uploadPreset;
            } else {
              if (params.signature) {
                meta.signature = params.signature;
              }
              if (params.timestamp) {
                meta.timestamp = params.timestamp.toString();
              }
              if (params.apiKey) {
                meta.api_key = params.apiKey;
              }
            }

            if (params.folder) {
              meta.folder = params.folder;
            }

            // Let Cloudinary detect the appropriate resource type (video/image)
            meta.resource_type = "auto";

            uppy.setFileMeta(fileID, meta);
          } catch (error) {
            console.error("Failed to prepare Cloudinary upload", error);
            uppy.info("Failed to prepare upload. Please try again.", "error", 5000);
            uppy.removeFile(fileID);
          }
        })
      );
    };

    uppy.addPreProcessor(prepareUpload);

    return () => {
      uppy.removePreProcessor(prepareUpload);
    };
  }, [onGetUploadParameters, uppy]);

  useEffect(() => {
    return () => {
      uppy.close({ reason: "unmount" });
    };
  }, [uppy]);

  return (
    <div>
      <Button
        onClick={() => setShowModal(true)}
        className={buttonClassName}
        data-testid="button-upload"
        type="button"
      >
        {children}
      </Button>

      <DashboardModal
        uppy={uppy}
        open={showModal}
        onRequestClose={() => setShowModal(false)}
        proudlyDisplayPoweredByUppy={false}
      />
    </div>
  );
}