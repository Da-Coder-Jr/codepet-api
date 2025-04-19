// File: api/pet.js
import { promises as fs } from 'fs';
import path              from 'path';

export default async function handler(req, res) {
  // 1. Extract & sanitize
  const {
    username = 'Anonymous',
    theme    = 'dark',
    pet      = 'dragon'
  } = req.query;

  const safeUsername = String(username).replace(/[^a-zA-Z0-9 _-]/g, '');
  const safeTheme    = /^(light|dark)$/.test(theme) ? theme : 'dark';
  const safePet      = /^[a-z]+$/.test(pet)      ? pet     : 'dragon';

  // 2. Locate template
  const templatePath = path.join(
    process.cwd(),
    'templates',
    safeTheme,
    `${safePet}.svg`
  );

  try {
    // 3. Load & inject username
    let svg = await fs.readFile(templatePath, 'utf8');
    svg = svg.replace(/{{\s*username\s*}}/g, safeUsername);

    // 4. Serve SVG with caching
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader(
      'Cache-Control',
      'public, max-age=0, s-maxage=86400, stale-while-revalidate'
    );
    return res.status(200).send(svg);

  } catch (err) {
    return res.status(404).json({ error: 'Template not found' });
  }
}
