import formidable from 'formidable';
import fs from 'fs';
import crypto from 'crypto';
import axios from 'axios';

export const config = { api: { bodyParser: false } };

// 读取环境变量
const ACCESS_KEY = process.env.JIMENG_ACCESS_KEY;  // AK
const SECRET_KEY = process.env.JIMENG_SECRET_KEY;  // SK
const REGION = 'cn-north-1';
const SERVICE = 'cv';
const ACTION = 'CVSync2AsyncSubmitTask';
const VERSION = '2022-08-31';
const HOST = 'visual.volcengineapi.com';

// 生成 RFC1123 格式时间戳
function getRFC1123Date() {
  return new Date().toUTCString();
}

// 计算签名 （参考火山引擎签名 v4 简化流程）
function signCanonicalRequest(date, canonicalRequest) {
  const hashedRequest = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
  const stringToSign = `HMAC-SHA256\n${date}\n${hashedRequest}`;
  return crypto.createHmac('sha256', SECRET_KEY).update(stringToSign).digest('hex');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const form = formidable({ multiples: false });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'Form parse error' });
    const prompt = fields.prompt || '帮我生成一张证件照，白底，一寸大小，毛发细腻，超高清画质，8K';
    const file = files.file?.[0];
    if (!file) return res.status(400).json({ error: 'No file' });

    const imageBase64 = fs.readFileSync(file.filepath, { encoding: 'base64' });

    const body = {
      req_key: 'jimeng_t2i_v30',
      prompt,
      ref_image: imageBase64,
      ref_strength: 0.4
    };

    const bodyString = JSON.stringify(body);
    const date = getRFC1123Date();

    // 构建 canonical request
    const canonicalRequest = [
      'POST',
      `/`,
      `Action=${ACTION}&Version=${VERSION}`,
      `content-type:application/json`,
      `host:${HOST}`,
      '',
      'content-type;host',
      crypto.createHash('sha256').update(bodyString).digest('hex')
    ].join('\n');

    const signature = signCanonicalRequest(date, canonicalRequest);
    const authorization = `HMAC-SHA256 Credential=${ACCESS_KEY},SignedHeaders=content-type;host,Signature=${signature}`;

    try {
      const resp = await axios.post(`https://${HOST}?Action=${ACTION}&Version=${VERSION}`, body, {
        headers: {
          'Content-Type': 'application/json',
          'Host': HOST,
          'X-Date': date,
          'Authorization': authorization
        },
        timeout: 20000
      });
      return res.status(200).json(resp.data);
    } catch (e) {
      console.error(e.response?.data || e.message);
      return res.status(500).json({ error: 'Jimeng API Error', detail: e.response?.data || e.message });
    }
  });
}
