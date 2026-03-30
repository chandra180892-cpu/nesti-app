import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { table, data } = req.body

  try {
    const { data: result, error } = await supabase.from(table).insert(data).select()
    if (error) throw error
    res.status(200).json({ data: result })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
```

---

Now two important things:

**1 — Update Vercel Environment Variables**

You currently have `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel. We need to add the Vite versions as well. Go to Vercel → Settings → Environment Variables → add:
```
VITE_SUPABASE_URL = [same value as NEXT_PUBLIC_SUPABASE_URL]
VITE_SUPABASE_ANON_KEY = [same value as NEXT_PUBLIC_SUPABASE_ANON_KEY]
