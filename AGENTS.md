# Architecture rules
- Keep personal task tracking in dedicated tracker tables and routes, using the existing auth client and query cache; isolation prevents accidental changes to exam and study records.
- Enforce tracker task ownership with a composite list/user foreign key and row-level policies; client filters alone do not protect private data.