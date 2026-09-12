export async function onRequestPost({ request, env }) {
  try {
    const { name, alias, styleName, styleDesc, isCustom } = await request.json();

    const prompt = `你是一位国风诗人。请为以下风物创作一首四句七言国风小诗。

风物：${name}${alias ? `（${alias}）` : ''}
艺术风格：${styleName} — ${styleDesc}
${isCustom ? '这是用户自定义上传的风物，请将风物名融入诗中。\n' : ''}要求：
1. 严格四句，每句七字，共二十八字
2. 融入该风物特征与信阳大别山乡土意境
3. 诗意契合「${styleName}」风格
4. 仅输出四句诗，换行分隔，不要标题、序号或任何解释`;

    const response = await env.AI.run('@cf/qwen/qwen3-30b-a3b-fp8', {
      messages: [
        { role: 'system', content: '你是一位专精国风诗词的AI诗人，擅长即兴创作七言绝句。只输出诗句，不加任何额外文字。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.85,
      max_tokens: 200
    });

    let poem = '';
    if (response.choices && response.choices[0]) {
      poem = response.choices[0].message.content;
    } else if (response.response) {
      poem = response.response;
    }

    poem = poem.replace(/^[\d\s•\-、。.]+/gm, '').replace(/["""''"]/g, '').trim();

    return Response.json({ poem });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
