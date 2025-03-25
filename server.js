const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const { OpenAI } = require('openai');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
const db = new sqlite3.Database('./chat.db', (err) => {
  if (err) console.error(err.message);
  console.log('Connected to the chat database.');
});

// Create tables if they don't exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize OpenAI (replace with your API key)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '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'
});

// API Routes
app.get('/messages', (req, res) => {
  db.all('SELECT * FROM messages ORDER BY timestamp ASC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.post('/messages', async (req, res) => {
  const { sender, content } = req.body;
  
  if (!content) {
    return res.status(400).json({ error: 'Message content is required' });
  }

  // Save user message
  db.run(
    'INSERT INTO messages (sender, content) VALUES (?, ?)',
    [sender || 'user', content],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      // Get AI response
      generateAIResponse(content)
        .then(aiResponse => {
          // Save AI response
          db.run(
            'INSERT INTO messages (sender, content) VALUES (?, ?)',
            ['AI', aiResponse],
            function(err) {
              if (err) {
                console.error('Error saving AI response:', err);
              }
              res.json({ success: true });
            }
          );
        })
        .catch(error => {
          console.error('AI Error:', error);
          res.status(500).json({ error: 'Failed to get AI response' });
        });
    }
  );
});

async function generateAIResponse(prompt) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant. Keep responses concise and friendly." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API Error:', error);
    return "I'm having trouble thinking right now. Please try again later.";
  }
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});