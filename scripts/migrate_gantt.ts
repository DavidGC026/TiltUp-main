import fs from 'fs';
import path from 'path';
import { poolConnection } from '../server/db';

async function migrate() {
    try {
        const sqlPath = path.join(process.cwd(), 'sql', '02_replace_gantt_with_files.sql');
        const sql = fs.readFileSync(sqlPath, 'utf-8');

        console.log('Running migration from:', sqlPath);

        // Split by semicolon and run each command
        // Note: simple splitting might break if semicolons are in strings, but for this simple schema it's fine.
        const commands = sql.split(';').filter(cmd => cmd.trim().length > 0);

        for (const command of commands) {
            console.log('Executing:', command.substring(0, 50) + '...');
            await poolConnection.query(command);
        }

        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await poolConnection.end();
    }
}

migrate();
