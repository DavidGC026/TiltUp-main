ALTER TABLE module_files ADD COLUMN user_id INT(11) NULL AFTER module_id;
ALTER TABLE module_files ADD CONSTRAINT fk_module_files_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
