export interface PreviewResult {
  html: string;
  plainText: string;
  estimatedSize: number;
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function wrapInEmailTemplate(body: string, device: 'desktop' | 'mobile'): string {
  const maxWidth = device === 'mobile' ? '100%' : '600px';
  const padding = device === 'mobile' ? '10px' : '20px';
  const fontSize = device === 'mobile' ? '14px' : '16px';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Email Preview</title>
<style>
  body { margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif; font-size: ${fontSize}; line-height: 1.6; color: #333333; }
  .email-wrapper { width: 100%; background-color: #f4f4f4; padding: 20px 0; }
  .email-container { max-width: ${maxWidth}; margin: 0 auto; background-color: #ffffff; border-radius: 4px; overflow: hidden; }
  .email-body { padding: ${padding}; }
  img { max-width: 100%; height: auto; }
  a { color: #1a73e8; }
</style>
</head>
<body>
<div class="email-wrapper">
<div class="email-container">
<div class="email-body">
${body}
</div>
</div>
</div>
</body>
</html>`;
}

export function generatePreview(
  templateBody: string,
  variables: Record<string, string>,
  device: 'desktop' | 'mobile' = 'desktop',
): PreviewResult {
  // Replace Handlebars-style variables
  let renderedBody = templateBody;
  for (const [key, value] of Object.entries(variables)) {
    const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    renderedBody = renderedBody.replace(pattern, value);
  }

  const html = wrapInEmailTemplate(renderedBody, device);
  const plainText = stripHtmlTags(renderedBody);
  const estimatedSize = Buffer.byteLength(html, 'utf-8');

  return { html, plainText, estimatedSize };
}
