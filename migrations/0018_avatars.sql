-- Characters (src/avatar/avatar.ts): the player's character as a JSON of part ids, picked
-- after signing up and changeable later. NULL: not made yet (the default is drawn).
ALTER TABLE users ADD COLUMN avatar TEXT;
