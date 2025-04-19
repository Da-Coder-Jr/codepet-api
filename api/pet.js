// File: api/pet.js
import { promises as fs } from 'fs';
import path              from 'path';

export default async function handler(req, res) {
  // 1. Sanitize query
  const { username = 'Anonymous', theme = 'dark', pet = 'dragon' } = req.query;
  const safeUser  = String(username).replace(/[^a-zA-Z0-9_-]/g, '');
  const safeTheme = /^(light|dark)$/.test(theme) ? theme : 'dark';
  const safePet   = /^[a-z]+$/.test(pet) ? pet : 'dragon';

  // 2. Compute “level” & “growth” from GitHub
  let level  = 1;
  let growth = 0;
  try {
    // Fetch public repo count as “level”
    const userResp = await fetch(`https://api.github.com/users/${safeUser}`);
    const userJson = await userResp.json();
    level = Math.max(1, userJson.public_repos || 1);

    // Count PushEvents in past 30 days
    const eventsResp = await fetch(`https://api.github.com/users/${safeUser}/events/public`);
    const events    = await eventsResp.json();
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const pushes = Array.isArray(events)
      ? events.filter(e => e.type === 'PushEvent' && new Date(e.created_at).getTime() > thirtyDaysAgo).length
      : 0;

    // growth: clamp to 100%
    growth = Math.min(100, Math.floor((pushes / 30) * 100));
  } catch (err) {
    // ignore errors; fall back to defaults
  }

  // 3. Load SVG & inject username, level, growth
  const svgPath = path.join(process.cwd(), 'templates', safeTheme, `${safePet}.svg`);
  try {
    let svg = await fs.readFile(svgPath, 'utf8');
    svg = svg
      .replace(/{{\s*username\s*}}/g, safeUser)
      .replace(/{{\s*level\s*}}/g, String(level))
      .replace(/{{\s*growth\s*}}/g, `${growth}%`);

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600');
    return res.status(200).send(svg);
  } catch {
    return res.status(404).json({ error: 'Template not found' });
  }
}
