const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const CLIENT_URL = process.env.CLIENT_URL; // 本番環境のFrontend URL (例: https://your-site.github.io)

// CORS設定: トラブルシューティングのため一旦全許可にします
app.use(cors());

/* Strict CORS Logic (Disabled for debugging)
const corsOptions = {
    origin: function (origin, callback) {
        if (!CLIENT_URL || !origin) {
            callback(null, true);
        } else if (origin === CLIENT_URL || origin.startsWith(CLIENT_URL)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
};
app.use(cors(corsOptions));
*/

// Health Check Endpoint
app.get('/', (req, res) => {
    res.send('Amazon Affiliate Generator Backend is Running!');
});

app.get('/api/amazon-info', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        // 偽装User-Agent
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
        };

        const response = await axios.get(url, { headers });
        const html = response.data;
        const $ = cheerio.load(html);

        // タイトル取得
        const title = $('#productTitle').text().trim();

        // 画像取得ロジックの強化
        let imageUrl = '';

        // Helper to extract first image from dynamic-image JSON
        const getDynamicImage = (selector) => {
            const data = $(selector).attr('data-a-dynamic-image');
            if (data) {
                try {
                    const images = JSON.parse(data);
                    const keys = Object.keys(images);
                    if (keys.length > 0) return keys[0]; // 最大サイズかどうかは不明だがURLを取得
                } catch (e) { return null; }
            }
            return null;
        };

        // 1. LandingImage (Main Product)
        imageUrl = getDynamicImage('#landingImage') ||
            $('#landingImage').attr('data-old-hires') ||
            $('#landingImage').attr('src');

        // 2. Books (ImgBlkFront)
        if (!imageUrl) {
            imageUrl = getDynamicImage('#imgBlkFront') ||
                $('#imgBlkFront').attr('src');
        }

        // 3. Ebooks
        if (!imageUrl) {
            imageUrl = getDynamicImage('#ebooksImgBlkFront') ||
                $('#ebooksImgBlkFront').attr('src');
        }

        // 4. Fallback: Open Graph
        if (!imageUrl) {
            imageUrl = $('meta[property="og:image"]').attr('content');
        }

        // 5. Fallback: Main Image generic
        if (!imageUrl) {
            imageUrl = $('.a-dynamic-image').first().attr('src');
        }

        if (!title) {
            // タイトルが取れない＝アクセスブロックや変なページの可能性
            return res.status(404).json({ error: 'Could not extract product info' });
        }

        res.json({ title, imageUrl });

    } catch (error) {
        console.error('Scraping error:', error.message);
        res.status(500).json({ error: 'Failed to fetch Amazon page' });
    }
});

app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
});
