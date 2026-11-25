import "server-only";
import type { PrintData } from "./types";
import { loadStore, loadPrintDataFromStore } from "./store";

export async function loadPrintData(
  id: string,
  _client?: any,
  _shopId?: string,
): Promise<PrintData> {
  await loadStore();
  return loadPrintDataFromStore(id);
}
