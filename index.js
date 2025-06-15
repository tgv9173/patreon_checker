const express = require('express');
const axios = require('axios');
const querystring = require('querystring');

const app = express();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = 'https://patreon-checker.onrender.com/callback'; // Ensure this matches Patreon settings
const ALLOWED_TIER_IDS = process.env.ALLOWED_TIER_IDS; // Your Patreon tier ID
const SUCCESS_REDIRECT_URI = process.env.SUCCESS_REDIRECT_URI; // Link to redirect if tier matches

app.get('/', (req, res) => {
  res.send('<a href="/login">Login with Patreon</a>');
});

app.get('/login', (req, res) => {
  const params = querystring.stringify({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI, // Ensure this matches Patreon settings
    scope: 'identity identity.memberships'
  });
  res.redirect(`https://www.patreon.com/oauth2/authorize?${params}`);
});

app.get('/callback', async (req, res) => {
  const code = req.query.code;
  try {
    const tokenRes = await axios.post('https://www.patreon.com/api/oauth2/token', querystring.stringify({
      code,
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI // Ensure this matches Patreon settings
    }));

    const accessToken = tokenRes.data.access_token;

    // Fetch identity + memberships
    const userRes = await axios.get(
      'https://www.patreon.com/api/oauth2/v2/identity?include=memberships.currently_entitled_tiers,memberships',
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    console.log('Patreon API Response:', JSON.stringify(userRes.data, null, 2));

    const allowedTierIds = (process.env.ALLOWED_TIER_IDS || '')
      .split(',')
      .map(id => id.trim())
      .filter(id => id); // remove empty strings

    const memberships = userRes.data.included || [];
    console.log('Memberships:', memberships);

    // Correctly extract tier IDs from the 'member' type
    const userTierIds = memberships
      .filter(item => item.type === 'member' && item.relationships?.currently_entitled_tiers?.data)
      .flatMap(item => item.relationships.currently_entitled_tiers.data.map(tier => tier.id));

    console.log('User tier IDs:', userTierIds);
    console.log('Allowed tier IDs:', allowedTierIds);

    const matched = userTierIds.some(id => allowedTierIds.includes(id));

    if (matched) {
      res.redirect(SUCCESS_REDIRECT_URI); // ✅ Redirect to the success link
    } else {
      res.status(403).send('❌ Access denied: You are not subscribed to the required tier.');
      return; // Ensure no further execution
    }

  } catch (err) {
    console.error('Error:', err.response ? err.response.data : err);
    res.status(500).send('⚠️ An error occurred during authentication.');
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ Server running on port ${port}`));
