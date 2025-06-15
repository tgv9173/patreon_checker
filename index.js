const express = require('express');
const axios = require('axios');
const querystring = require('querystring');

const app = express();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const REQUIRED_TIER_ID = process.env.REQUIRED_TIER_ID; // Your Patreon tier ID

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
    const tokenRes = await axios.post('https://www.patreon.com/api/oauth2/token', querystring.stringify({
      code,
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI
    }));

    const accessToken = tokenRes.data.access_token;

    const userRes = await axios.get('https://www.patreon.com/api/oauth2/v2/identity?include=memberships.currently_entitled_tiers&fields%5Bmember%5D=currently_entitled_tiers', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const memberships = userRes.data.included || [];
    const hasTier = memberships.some(item => item.type === 'tier' && item.id === REQUIRED_TIER_ID);

    if (hasTier) {
      res.redirect('https://docs.google.com/document/d/1LlZ-4q2Nn0u1fts8Cc5_fPln_p-_PRWQB83GIhVXYS4/edit?usp=sharing'); // Change to your success URL
    } else {
      res.send('❌ You are not subscribed to the required tier.');
    }
  } catch (err) {
    console.error(err.response ? err.response.data : err);
    res.send('⚠️ An error occurred during authentication.');
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ Server running on port ${port}`));
