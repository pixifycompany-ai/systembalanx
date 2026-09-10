import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Transcrição de áudio (voz → texto) via OpenAI Whisper.
// A Web Speech API do navegador é furada no iOS; aqui gravamos o áudio no
// cliente (MediaRecorder) e transcrevemos no servidor — funciona no iPhone.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("IARA_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "IA não configurada (OPENAI_API_KEY)." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // Whisper vive no OpenAI real (não use IARA_API_BASE, que pode ser um proxy só de chat).
    const apiBase = (Deno.env.get("TRANSCRIBE_API_BASE") || "https://api.openai.com/v1").replace(/\/$/, "");
    const model = Deno.env.get("TRANSCRIBE_MODEL") || "whisper-1";

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: "Envie o áudio no campo 'file'." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const oaForm = new FormData();
    oaForm.append("file", file, file.name || "audio.webm");
    oaForm.append("model", model);
    oaForm.append("language", "pt");
    oaForm.append("response_format", "json");

    const resp = await fetch(`${apiBase}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: oaForm,
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("transcrever AI error", resp.status, t);
      return new Response(JSON.stringify({ error: "Erro ao transcrever o áudio." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await resp.json();
    return new Response(JSON.stringify({ text: (data.text || "").trim() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("transcrever error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
