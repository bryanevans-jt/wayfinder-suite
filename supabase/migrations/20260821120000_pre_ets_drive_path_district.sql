-- Align Pre-ETS Drive folder path with worksheet district: {SchoolYear}/{District}/{School}/{Month}
alter table public.pre_ets_settings
  alter column drive_folder_path_template
  set default '{SchoolYear}/{District}/{School}/{Month}';

update public.pre_ets_settings
set
  drive_folder_path_template = '{SchoolYear}/{District}/{School}/{Month}',
  updated_at = now()
where drive_folder_path_template in (
  'Pre-ETS/{SchoolYear}/{Month}/{School}/{AuthNumber}',
  '{SchoolYear}/{Month}/{School}/{AuthNumber}'
);
