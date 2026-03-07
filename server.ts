import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes for PDF Generation
  // All PDF generation has been moved to client-side (src/utils/pdfGenerator.ts)
  // to improve performance and avoid server-side dependencies.

  // Awaj Digital API Proxy Routes
  const AWAJ_API_TOKEN = process.env.AWAJ_API_TOKEN || 'oat_MjAw.d1o4LW12eXR3V2phbXB1OGJoam1SNGxlV2xuNll1UjJDaVo2SG9ITTEyNjE3Njc5MzA';
  const AWAJ_BASE_URL = process.env.AWAJ_BASE_URL || 'https://api.awajdigital.com/api';

  const awajHeaders = {
    'Authorization': `Bearer ${AWAJ_API_TOKEN}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  app.get('/api/awaj/voices', async (req, res) => {
    try {
      const response = await fetch(`${AWAJ_BASE_URL}/voices`, { headers: awajHeaders });
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/awaj/senders', async (req, res) => {
    try {
      const response = await fetch(`${AWAJ_BASE_URL}/senders`, { headers: awajHeaders });
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/awaj/voices', async (req, res) => {
    try {
      const { name, file_url } = req.body;
      let body: any = JSON.stringify(req.body);
      let headers: any = { ...awajHeaders };

      if (file_url) {
        // Download the file from file_url
        const fileRes = await fetch(file_url);
        if (!fileRes.ok) throw new Error('Failed to download file from URL');
        const fileBuffer = await fileRes.arrayBuffer();
        
        // Use Node.js FormData equivalent or standard fetch FormData
        const formData = new FormData();
        formData.append('name', name);
        formData.append('file', Buffer.from(fileBuffer), {
          filename: 'voice.mp3',
          contentType: 'audio/mpeg'
        });

        body = formData;
        // Merge form-data headers (which include boundary) with our auth headers
        headers = {
          ...headers,
          ...formData.getHeaders()
        };
      }

      const response = await fetch(`${AWAJ_BASE_URL}/voices`, {
        method: 'POST',
        headers: headers,
        body: body
      });
      
      let data;
      try {
        data = await response.json();
      } catch (e) {
        data = { message: await response.text() };
      }
      
      if (!response.ok) {
        console.error('Awaj API Error:', response.status, data);
        return res.status(response.status).json(data);
      }
      res.json(data);
    } catch (error: any) {
      console.error('Awaj API Exception:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/awaj/broadcast', async (req, res) => {
    try {
      const response = await fetch(`${AWAJ_BASE_URL}/broadcasts`, {
        method: 'POST',
        headers: awajHeaders,
        body: JSON.stringify(req.body)
      });
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/awaj/broadcast/:id', async (req, res) => {
    try {
      const response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${req.params.id}/result`, { headers: awajHeaders });
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

function calculateGrade(marks: number): string {
  if (marks >= 80) return 'A+';
  if (marks >= 70) return 'A';
  if (marks >= 60) return 'A-';
  if (marks >= 50) return 'B';
  if (marks >= 40) return 'C';
  if (marks >= 33) return 'D';
  return 'F';
}

startServer();
