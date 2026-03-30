export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { systemPrompt, userMessage, conversationHistory } = req.body

  try {
    const messages = conversationHistory
      ? conversationHistory
      : [{ role: 'user', content: userMessage }]

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages
      })
    })

    const data = await response.json()
    if (data.error) throw new Error(data.error.message)
    res.status(200).json({ text: data.content[0].text })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
