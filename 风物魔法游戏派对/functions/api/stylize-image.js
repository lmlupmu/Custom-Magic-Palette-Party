const STYLE_PROMPTS = {
  '春日青绿': 'Traditional Chinese ink painting, spring green palette, fresh vibrant, elegant botanical art',
  '秋意赅黄': 'Traditional Chinese ink painting, autumn golden brown palette, warm harvest colors',
  '国潮艳彩': 'Chinese guochao art style, bold vibrant saturated colors, modern traditional fusion',
  '淡雅水墨': 'Chinese ink wash painting, minimalist black and white, zen aesthetic, subtle brushwork'
};

async function extractImageBase64(response) {
  if (typeof response === 'string') return response;
  if (response.image) return response.image;
  if (response instanceof ReadableStream) {
    const buffer = await new Response(response).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  }
  throw new Error('Unknown image response format');
}

export async function onRequestPost({ request, env }) {
  try {
    const { image, styleName, styleDesc } = await request.json();
    const base64 = image.replace(/^data:image\/\w+;base64,/, '');
    const stylePrompt = STYLE_PROMPTS[styleName] || `Chinese art style, ${styleName}, ${styleDesc}`;

    const response = await env.AI.run('@cf/stabilityai/stable-diffusion-xl-base-1.0', {
      prompt: stylePrompt,
      image_b64: base64,
      strength: 0.6,
      guidance: 7.5,
      num_steps: 20,
      width: 512,
      height: 512
    });

    const imageBase64 = await extractImageBase64(response);
    return Response.json({ image: `data:image/png;base64,${imageBase64}` });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
