// Supabase Edge Function: Storage OBJECT_CREATED → synthetic_dataset 업서트
// 배치 트리거나 단건 이벤트 모두 처리 가능하게 설계

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type StorageRecord = {
  bucket: string
  name: string // object key, e.g., synthetic/3001/abc.webp
  size?: number
};

function extractPartAndPaths(objectName: string) {
  // expected: synthetic/<partId>/<filename>
  const parts = objectName.split('/');
  if (parts.length < 3) return null;
  const partId = parts[1];
  const filename = parts[2];
  const folder = `${parts[0]}/${parts[1]}`;
  return { partId, filename, folder };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok');

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(url, serviceRoleKey);

  try {
    const event = await req.json();
    const records: StorageRecord[] = Array.isArray(event?.records) ? event.records : (event?.record ? [event.record] : []);
    if (!records.length) {
      return new Response(JSON.stringify({ success: true, message: 'no records' }), { headers: { 'Content-Type': 'application/json' } });
    }

    const bucket = records[0].bucket || 'lego-synthetic';

    const upserts: any[] = [];
    for (const rec of records) {
      const info = extractPartAndPaths(rec.name);
      if (!info) continue;
      const { partId, filename, folder } = info;

      // public URL
      const { data: pub } = (supabase as any).storage.from(bucket).getPublicUrl(`${folder}/${filename}`);
      upserts.push({
        part_id: partId,
        filename,
        image_url: pub?.publicUrl,
        file_size: rec.size || null,
        image_path: `${folder}/${filename}`,
        status: 'completed',
        upload_method: 'edge_auto'
      });
    }

    if (!upserts.length) {
      return new Response(JSON.stringify({ success: true, message: 'no upserts' }), { headers: { 'Content-Type': 'application/json' } });
    }

    const { error } = await supabase.from('synthetic_dataset')
      .upsert(upserts, { onConflict: 'part_id,filename' });

    if (error) {
      // 실패 로그 적재
      try {
        for (const u of upserts) {
          await supabase.from('synthetic_sync_failures').upsert({
            part_id: u.part_id,
            filename: u.filename,
            image_url: u.image_url,
            error_message: error.message,
            last_attempt_at: new Date().toISOString()
          }, { onConflict: 'part_id,filename' });
        }
      } catch (_) {}
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, count: upserts.length }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});



