import "server-only";
import type { PrintData } from "./types";
import { loadPrintDataFromStore } from "./store";

export async function loadPrintData(
  id: string,
  _client?: any,
  _shopId?: string,
): Promise<PrintData> {
  return loadPrintDataFromStore(id);
}
