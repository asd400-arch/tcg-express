-- Google sign-in support (run in a NEW Supabase SQL tab)
alter table express_users add column if not exists auth_provider text;
alter table express_users add column if not exists google_sub text;
create unique index if not exists express_users_google_sub_idx on express_users (google_sub) where google_sub is not null;
alter table express_users alter column password_hash drop not null;
