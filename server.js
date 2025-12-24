const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const CLIENT_URL = process.env.CLIENT_URL; // 本番環境のFrontend URL (例: https://your-site.github.io)

const corsOptions = {
    origin: function (origin, callback) {
        // CLIENT_URLが未設定(ローカル等) または originが無い(サーバー間通信) 場合は許可
        if (!CLIENT_URL || !origin) {
            callback(null, true);
        } else if (origin === CLIENT_URL || origin.startsWith(CLIENT_URL)) {
            // 設定されたURLからのアクセスなら許可
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
};

app.use(cors(corsOptions));

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

        // 画像取得 (複数のセレクタを試す)
        let imageUrl = '';

        // 1. LandingImage (データ属性に入っていることが多い)
        const landingImage = $('#landingImage').attr('data-old-hires') || $('#landingImage').attr('src');
        if (landingImage) imageUrl = landingImage;

        // 2. なければ og:image
        if (!imageUrl) {
            imageUrl = $('meta[property="og:image"]').attr('content');
        }

        // 3. まだなければ #imgBlkFront (書籍など)
        if (!imageUrl) {
            imageUrl = $('#imgBlkFront').attr('src');
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
