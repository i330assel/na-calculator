// supabase.js — подключение к Supabase
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://orszanxdpaegoujlbycj.supabase.co'
const SUPABASE_KEY = 'sb_publishable_hQkjdW75iRZCmEMuMzgL2Q_6e1HI8ef'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)