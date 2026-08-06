-- Remove temporary accounts created solely to verify the live contextual-enrichment deployment.
DELETE FROM users WHERE username LIKE 'codex_verify_0805%';
