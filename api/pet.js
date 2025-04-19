import { promises as fs } from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // 1. Sanitize query
  const { username = 'Anonymous', theme = 'dark', pet = 'dragon' } = req.query;
  const safeUser  = String(username).replace(/[^a-zA-Z0-9 _-]/g, '');
  const safeTheme = /^(light|dark)$/.test(theme) ? theme : 'dark';
  const safePet   = /^[a-z]+$/.test(pet)      ? pet     : 'dragon';

  // 2. Fetch GitHub stats
  let level = 1, growthPct = 0;
  try {
    const uRes = await fetch(`https://api.github.com/users/${safeUser}`);
    if (uRes.ok) {
      const uJson = await uRes.json();
      level = Math.max(1, uJson.public_repos || 1);
    }
    const eRes = await fetch(`https://api.github.com/users/${safeUser}/events/public`);
    if (eRes.ok) {
      const events = await eRes.json();
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const pushes = Array.isArray(events)
        ? events.filter(e => e.type === 'PushEvent' && new Date(e.created_at).getTime() > cutoff).length
        : 0;
      growthPct = Math.min(100, Math.floor((pushes / 30) * 100));
    }
  } catch (err) {
    // fallback to defaults
  }
  const growth      = `${growthPct}%`;
  const growthWidth = Math.floor((growthPct / 100) * 300);
  const growthPlus  = growthWidth + 5;

  // 3. Load & inject into SVG
  const svgPath = path.join(process.cwd(), 'templates', safeTheme, `${safePet}.svg`);
  try {
    let svg = await fs.readFile(svgPath, 'utf8');
    svg = svg
      .replace(/{{\s*username\s*}}/g, safeUser)
      .replace(/{{\s*level\s*}}/g, String(level))
      .replace(/{{\s*growth\s*}}/g, growth)
      .replace(/{{\s*growthWidth\s*}}/g, String(growthWidth))
      .replace(/{{\s*growthPlus\s*}}/g, String(growthPlus));

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600');
    return res.status(200).send(svg);

  } catch {
    return res.status(404).json({ error: 'Template not found' });
  }
}
