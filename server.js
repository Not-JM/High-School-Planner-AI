const express = require('express')
const Groq = require('groq-sdk')
const multer = require('multer')
require('dotenv').config()

const app = express()
app.use(express.json())
app.use(express.static('public'))

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const upload = multer({ storage: multer.memoryStorage() })

app.post('/api/plan', upload.single('catalog'), async (req, res) => {
  const { prompt } = req.body

  if (!prompt) return res.status(400).json({ error: 'No prompt provided' })

  try {
    let catalogText = ''

    if (req.file) {
      let raw = req.file.buffer.toString('utf-8')
      // Strip PDF binary garbage — find first real word/sentence
      const cleanStart = raw.search(/[A-Za-z]{4,}/)
      raw = cleanStart > 0 ? raw.slice(cleanStart) : raw
      // Remove leftover PDF syntax tokens
      raw = raw.replace(/%PDF[\s\S]*?(?=\n[A-Z])/g, '')
               .replace(/<<[\s\S]*?>>/g, '')
               .replace(/\bendobj\b|\bobj\b|\bstream\b|\bendstream\b/g, '')
               .replace(/[^\x20-\x7E\n]/g, ' ') // strip non-printable chars
               .replace(/ {2,}/g, ' ')            // collapse extra spaces
               .trim()
      catalogText = raw.slice(0, 3000)
    }

    const fullPrompt = catalogText
      ? `${prompt}\n\nHere is the student's school course catalog — use it to suggest real courses where possible:\n\n${catalogText}`
      : prompt

    const msg = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1800,
      messages: [
        {
          role: 'system',
          content: `You are a warm and practical high school academic counselor. 
Your job is to help students plan their 4-year course load based on their goals.
Format your entire response using HTML — use <table> tags for the year-by-year schedule, 
<strong> for emphasis, and <h3> for section headers. 
Do NOT use markdown, backticks, or code fences.`
        },
        { role: 'user', content: fullPrompt }
      ]
    })

    res.json({ text: msg.choices[0].message.content })

  } catch (err) {
    console.error('Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

app.listen(3000, () => console.log('✅ Running on http://localhost:3000'))