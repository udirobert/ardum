-- Apply only after application cutover, row-count verification, and a tested
-- rollback snapshot. Ardum does not keep dual-write compatibility tables.
drop table if exists public.sessions;
