import { ensureBaselineData } from "../src/lib/bootstrap";

async function main() {
  console.log("Seeding baseline data…");
  await ensureBaselineData();
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
