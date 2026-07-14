-- Private staging bucket for Share a Moment originals (uploaded via signed URLs).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'team-moments',
  'team-moments',
  false,
  26214400,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
