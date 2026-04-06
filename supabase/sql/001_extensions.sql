-- 001_extensions.sql
-- Purpose: Enable required Postgres extensions.

begin;

create extension if not exists pgcrypto;

commit;

