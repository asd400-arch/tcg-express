import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Lazy initialization — only creates client when first accessed
// This prevents build failures when the env var isn't set at build time
let _client = null

export const supabaseAdmin = new Proxy({}, {
  get(_, prop) {
    if (!_client) {
      if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
      }
      _client = createClient(supabaseUrl, supabaseServiceKey)
    }
    const value = _client[prop]
    return typeof value === 'function' ? value.bind(_client) : value
  }
})
