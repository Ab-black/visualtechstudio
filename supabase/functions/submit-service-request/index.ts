import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 5;
const RECIPIENT = Deno.env.get("QUOTE_RECIPIENT_EMAIL") || "abrahamgift788@gmail.com";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const clean = (value: FormDataEntryValue | null, max = 5000) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const form = await req.formData();
    if (clean(form.get("website"), 100)) return json({ ok: true });

    const name = clean(form.get("name"), 120);
    const email = clean(form.get("email"), 254);
    const phone = clean(form.get("phone"), 60);
    const company = clean(form.get("company"), 160);
    const service = clean(form.get("service"), 160);
    const budget = clean(form.get("budget"), 120);
    const projectDetails = clean(form.get("project_details"), 8000);

    if (!name || !email || !projectDetails) return json({ error: "Name, email, and project details are required." }, 400);
    if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: "Please provide a valid email address." }, 400);

    const files = form.getAll("attachments").filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (files.length > MAX_FILES) return json({ error: `Please upload no more than ${MAX_FILES} files.` }, 400);
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) return json({ error: `${file.name} is larger than 10MB.` }, 400);
      if (!ALLOWED_MIME.has(file.type)) return json({ error: `${file.name} is not a supported file type.` }, 400);
    }

    const { data: request, error: requestError } = await supabase.from("service_requests").insert({
      name, email, phone, company, service, budget, project_details: projectDetails,
      status: "new", email_status: "pending"
    }).select("id,created_at").single();
    if (requestError) throw requestError;

    const storedFiles: { file_name: string; file_path: string; mime_type: string; file_size: number }[] = [];
    try {
      for (const file of files) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120);
        const path = `${request.id}/${crypto.randomUUID()}-${safeName}`;
        const bytes = new Uint8Array(await file.arrayBuffer());
        const { error } = await supabase.storage.from("request-attachments").upload(path, bytes, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
        if (error) throw error;
        storedFiles.push({ file_name: file.name, file_path: path, mime_type: file.type, file_size: file.size });
      }
      if (storedFiles.length) {
        const { error } = await supabase.from("service_request_files").insert(storedFiles.map((file) => ({ request_id: request.id, ...file })));
        if (error) throw error;
      }
    } catch (storageError) {
      if (storedFiles.length) await supabase.storage.from("request-attachments").remove(storedFiles.map((file) => file.file_path));
      await supabase.from("service_requests").delete().eq("id", request.id);
      throw storageError;
    }

    const attachmentRows = storedFiles.length
      ? `<ul>${storedFiles.map((file) => `<li>${escapeHtml(file.file_name)}</li>`).join("")}</ul>`
      : "<p>No attachments.</p>";
    const emailHtml = `
      <h2>New Request a Quote submission</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(phone || "Not provided")}</p>
      <p><strong>Company:</strong> ${escapeHtml(company || "Not provided")}</p>
      <p><strong>Service:</strong> ${escapeHtml(service || "Not specified")}</p>
      <p><strong>Budget:</strong> ${escapeHtml(budget || "Not specified")}</p>
      <h3>Project details</h3><p>${escapeHtml(projectDetails).replaceAll("\n", "<br>")}</p>
      <h3>Attachments</h3>${attachmentRows}
      <p><strong>Request ID:</strong> ${escapeHtml(request.id)}</p>
    `;

    let emailSent = false;
    let emailError = "";
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_API_KEY) {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Visual Tech Studio <onboarding@resend.dev>",
          to: [RECIPIENT],
          reply_to: email,
          subject: `New quote request — ${name}`,
          html: emailHtml,
        }),
      });
      if (emailResponse.ok) emailSent = true;
      else emailError = await emailResponse.text();
    } else {
      emailError = "Email provider is not configured yet.";
    }

    await supabase.from("service_requests").update({
      email_status: emailSent ? "sent" : "failed",
      email_sent_at: emailSent ? new Date().toISOString() : null,
      email_error: emailSent ? null : emailError.slice(0, 2000),
    }).eq("id", request.id);

    if (!emailSent) return json({ ok: false, error: "Your request was saved, but email delivery is not configured yet. Please try again later.", request_id: request.id }, 503);
    return json({ ok: true, request_id: request.id });
  } catch (error) {
    console.error("submit-service-request error", error);
    return json({ error: "We could not submit your request. Please try again." }, 500);
  }
});
