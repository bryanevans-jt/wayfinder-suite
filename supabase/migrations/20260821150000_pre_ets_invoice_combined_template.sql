-- Wire the combined Pre-ETS invoice cover + attestation Google Doc.
-- Same ID may be stored in both cover and attestation fields; export treats equal IDs as one Doc.

update public.pre_ets_settings
set
  template_invoice_cover_doc_id = coalesce(
    nullif(trim(template_invoice_cover_doc_id), ''),
    '11fGWC_DEcYVOzQaOgBhcYB1Pj3miyl7Q9EHDVQJM_MM'
  ),
  template_invoice_attestation_doc_id = coalesce(
    nullif(trim(template_invoice_attestation_doc_id), ''),
    '11fGWC_DEcYVOzQaOgBhcYB1Pj3miyl7Q9EHDVQJM_MM'
  ),
  updated_at = now()
where id is not null;
