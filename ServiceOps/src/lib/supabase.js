import { createClient } from '@supabase/supabase-js'
import { PRODUCT } from '../config/product'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storageKey: `alzaro-${PRODUCT.id}-auth`,
  },
  global: {
    headers: {
      'x-product': PRODUCT.id,
    },
  },
})
