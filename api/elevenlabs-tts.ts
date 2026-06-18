// Vercel Edge Function: relays the ElevenLabs streaming TTS request server-to-server.
// NOTE: In this Vite project the browser calls ElevenLabs directly (ElevenLabs supports
// CORS for browser requests), so this file is NOT used at runtime. It is kept here as a
// server-side relay in case the project is ever deployed on a platform that needs it
// (e.g. migrated to Next.js with server-side rendering).

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { text, apiKey, voiceId, modelId } = await req.json();

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'ELEVENLABS_API_KEY_MISSING' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!text || !voiceId) {
      return new Response(JSON.stringify({ error: 'Missing required field: text or voiceId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=pcm_24000`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/pcm',
        },
        body: JSON.stringify({
          text,
          model_id: modelId || 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => '');
      return new Response(JSON.stringify({ error: `ElevenLabs error (${upstream.status}): ${detail}` }), {
        status: upstream.status || 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Pass the upstream ReadableStream straight through to the client.
    return new Response(upstream.body, {
      status: 200,
      headers: { 'Content-Type': 'audio/pcm' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Unknown relay error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
