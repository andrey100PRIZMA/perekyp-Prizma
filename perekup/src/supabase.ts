import {createClient} from '@supabase/supabase-js';
export const SUPABASE_URL='https://tgqlvhhmnaedjzlosscl.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY='sb_publishable_YD8thu1Z5-TCOLi3_W_dgQ_YOOHDZde';
export const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);