import { poolConnection } from '../server/db';

async function checkTable() {
    try {
        console.log("Checking if module_files table exists...");
        const [rows] = await poolConnection.query("SHOW TABLES LIKE 'module_files'");
        if ((rows as any[]).length > 0) {
            console.log("Table module_files EXISTS.");
        } else {
            console.log("Table module_files DOES NOT EXIST.");
        }
    } catch (error) {
        console.error("Error checking table:", error);
    } finally {
        await poolConnection.end();
    }
}

checkTable();
