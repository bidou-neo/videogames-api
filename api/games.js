const GITHUB_REPO = 'bidou-neo/videogames';
const GITHUB_FILE = 'games.json';
const TOKEN = process.env.GITHUB_TOKEN;

async function getFile() {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`, {
    headers: {
      'Authorization': `token ${TOKEN}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  if (!res.ok) throw new Error('GitHub read error: ' + res.status);
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const data = await getFile();
      const games = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
      return res.status(200).json({ games, sha: data.sha });
    }

    if (req.method === 'PUT') {
      const { games, sha } = req.body;
      const content = Buffer.from(JSON.stringify(games, null, 2)).toString('base64');
      const updateRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: 'update games list',
          content,
          sha
        })
      });
      if (!updateRes.ok) throw new Error('GitHub write error: ' + updateRes.status);
      const updated = await updateRes.json();
      return res.status(200).json({ sha: updated.content.sha });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
