export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { audio, mimeType } = req.body
    const audioBuffer = Buffer.from(audio, 'base64')
    const blob = new Blob([audioBuffer], { type: mimeType || 'audio/webm' })
    const formData = new FormData()
    formData.append('file', blob, 'audio.webm')
    formData.append('model', 'whisper-1')
    formData.append('language', 'en')
    formData.append('prompt', 'Baby tracking app. Commands like: fed Maanvik 60ml breastmilk, slept 2 hours, diaper change wet, vitamin D given')

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      body: formData
    })

    const data = await response.json()
    if (data.error) throw new Error(data.error.message)
    res.status(200).json({ transcript: data.text })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
