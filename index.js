const express = require('express');
const axios = require('axios');
const querystring = require('querystring');

const app = express();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const ALLOWED_TIER_IDS = process.env.ALLOWED_TIER_IDS; // Your Patreon tier ID

app.get('/', (req, res) => {
  res.send('<a href="/login">Login with Patreon</a>');
});

app.get('/login', (req, res) => {
  const params = querystring.stringify({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'identity identity.memberships'
  });
  res.redirect(`https://www.patreon.com/oauth2/authorize?${params}`);
});

app.get('/callback', async (req, res) => {
  const code = req.query.code;
  try {
    // Exchange code for token
    const tokenRes = await axios.post('https://www.patreon.com/api/oauth2/token', querystring.stringify({
      code,
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI
    }));

    const accessToken = tokenRes.data.access_token;

    // Fetch identity + memberships
    const userRes = await axios.get(
      'https://www.patreon.com/api/oauth2/v2/identity?include=memberships.currently_entitled_tiers,memberships&fields%5Bmember%5D=currently_entitled_tiers',
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    // DEBUG: show what we got
    console.log(JSON.stringify(userRes.data, null, 2));

    const allowedTierIds = (process.env.ALLOWED_TIER_IDS || '')
      .split(',')
      .map(id => id.trim())
      .filter(id => id); // remove empty strings

    const memberships = userRes.data.included || [];
    const userTierIds = memberships
      .filter(item => item.type === 'tier')
      .map(tier => tier.id);

    console.log('User tier IDs:', userTierIds);
    console.log('Allowed tier IDs:', allowedTierIds);

    const matched = userTierIds.some(id => allowedTierIds.includes(id));

    if (matched) {
      res.redirect('https://your-success-url.com'); // ✅ Replace with your real success URL
    } else {
      res.status(403).send('❌ Access denied: You are not subscribed to the required tier.');
    }

  } catch (err) {
    console.error('Error:', err.response ? err.response.data : err);
    res.status(500).send('⚠️ An error occurred during authentication.');
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ Server running on port ${port}`));
