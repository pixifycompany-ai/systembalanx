import { encode as encodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import type { ResendAnexo } from "./email.ts";

/**
 * Baixa a nota fiscal do Storage e devolve o anexo com o CONTEÚDO (base64).
 * Não usar `path` (URL assinada): o Resend baixa a URL depois de aceitar o e-mail,
 * e a nota é apagada do Storage logo após o envio → "invalid_attachment_paths".
 */
// deno-lint-ignore no-explicit-any
export async function anexoDaNota(client: any, path: string, nome: string): Promise<ResendAnexo | null> {
  try {
    const { data, error } = await client.storage.from("notas-fiscais").download(path);
    if (error || !data) return null;
    return { filename: nome || "nota-fiscal.pdf", content: encodeBase64(await data.arrayBuffer()) };
  } catch {
    return null;
  }
}
