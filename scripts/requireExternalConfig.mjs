const command = process.argv[2] ?? "external command";
const required = ["DAYTONA_API_KEY", "DAYTONA_TARGET", "DAYTONA_SNAPSHOT"];
const missing = required.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error(`${command} is opt-in and requires ${missing.join(", ")} in the process environment.`);
  console.error("It is intentionally not run by ./init.sh because it may create billable Daytona resources.");
  process.exit(1);
}

console.error(`${command} implementation has not been added yet. See docs/IMPLEMENTATION_PLAN.md for its phase.`);
process.exit(1);
