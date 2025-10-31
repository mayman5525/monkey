const pool = require("../modules");
const { uploadFromBuffer } = require("./cloudinary");

async function migrate(table) {
  const { rows } = await pool.query(
    `SELECT * FROM ${table} WHERE photo_data IS NOT NULL`
  );
  for (const row of rows) {
    const result = await uploadFromBuffer(row.photo_data, {
      folder: "ecommerce",
    });
    await pool.query(
      `UPDATE ${table} SET photo_url = $1, photo_public_id = $2 WHERE ${table}_id = $3`,
      [result.secure_url, result.public_id, row[`${table}_id`]]
    );
    console.log(`Migrated ${table} #${row[`${table}_id`]}`);
  }
}

(async () => {
  await migrate("product");
  await migrate("merchant");
  console.log("Migration finished");
  process.exit();
})();
