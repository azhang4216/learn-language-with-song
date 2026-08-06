-- Remove the final temporary account used to inspect the OpenAI quota response.
DELETE FROM users WHERE username = 'codex_verify_0805d';
