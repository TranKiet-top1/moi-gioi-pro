create index if not exists idx_premises_district on public.premises(district);
create index if not exists idx_premises_status on public.premises(status);
create index if not exists idx_premises_price on public.premises(price);
create index if not exists idx_premises_area on public.premises(area);
create index if not exists idx_premises_width on public.premises(width);
create index if not exists idx_premises_is_approved on public.premises(is_approved);
