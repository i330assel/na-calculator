// supabase.js — подключение к Supabase
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL  = 'https://orszanxdpaegoujlbycj.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yc3phbnhkcGFlZ291amxieWNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3ODk1MTQsImV4cCI6MjA5MDM2NTUxNH0.JRnnhrlycB8RLM5j5FXAYXZAe_ppszIuJbMgFcOGQuQ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)