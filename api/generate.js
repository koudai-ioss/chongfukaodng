// api/generate.js
const crypto = require('crypto');
const https = require('https');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('只支持 POST');
  const { prompt, imageBase64 } = req.body;
  const accessKey = process.env.JIMENG_ACCESS_KEY;
  const secretKey = process.env.JIMENG_SECRET_KEY;

  const host = 'im.volcengineapi.com';
  const path = '/v2/text2image';
  const date = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const payload = JSON.stringify({ prompt, image: imageBase64, width: 384, height: 512 });
  const md5 = crypto.createHash('md5').update(payload).digest('hex');
  const stringToSign = `POST\napplication/json\n${md5}\n${date}\n${path}`;
  const signature = crypto.createHmac('sha256', secretKey)
                          .update(stringToSign)
                          .digest('base64');

  const options = {
    hostname: host, path, method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'X-Date': date,
      'Authorization': `HMAC-SHA256 Credential=${accessKey},SignedHeaders=content-type;host;x-date,Signature=${signature}`
    }
  };

  const apiReq = https.request(options, apiRes => {
    let data = '';
    apiRes.on('data', chunk => data += chunk);
    apiRes.on('end', () => {
      const json = JSON.parse(data);
      if (json.code === 0 && json.data?.url) {
        res.status(200).json({ url: json.data.url });
      } else {
        res.status(500).json({ error: '生成失败', details: json });
      }
    });
  });

  apiReq.on('error', err => res.status(500).json({ error: err.message }));
  apiReq.write(payload);
  apiReq.end();
};
