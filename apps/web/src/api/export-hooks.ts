import {
  buildExportZip,
  exportZipName,
  type VaultExport,
} from "@book-tracking-system/core/export";
import { useMutation } from "@tanstack/react-query";
import { api, unwrap } from "./client.ts";

export function useExportVault() {
  return useMutation({
    mutationFn: async () => {
      const data = unwrap(
        await api.GET("/export", { params: { query: { format: "json" } } }),
      ) as VaultExport;
      const url = URL.createObjectURL(
        new Blob([buildExportZip(data)], { type: "application/zip" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = exportZipName(data);
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
  });
}
