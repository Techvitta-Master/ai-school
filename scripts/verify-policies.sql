select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'sections'
order by policyname;
