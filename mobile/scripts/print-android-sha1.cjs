#!/usr/bin/env node
/**
 * Prints EAS production Android keystore SHA-1 for Google Cloud Console.
 * Usage: node scripts/print-android-sha1.cjs
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const PROJECT_DIR = path.join(__dirname, "..");
const ACCOUNT = "zensa";
const SLUG = "pentaprotocol";
const PACKAGE = "com.pentaprotocol.app";

function readSessionSecret() {
  const statePath = path.join(os.homedir(), ".expo", "state.json");
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const secret = state?.auth?.sessionSecret;
  if (!secret) throw new Error("Not logged in to Expo. Run: npx eas-cli login");
  return secret;
}

async function main() {
  process.chdir(PROJECT_DIR);

  const sessionSecret = readSessionSecret();
  const { createGraphqlClient } = require("eas-cli/build/commandUtils/context/contextUtils/createGraphqlClient");
  const { getDefaultAndroidAppBuildCredentialsAsync } = require("eas-cli/build/credentials/android/api/GraphqlClient");

  const graphqlClient = createGraphqlClient({ accessToken: null, sessionSecret });
  const { AppQuery } = require("eas-cli/build/graphql/queries/AppQuery");

  const app = await AppQuery.byFullNameAsync(graphqlClient, `@${ACCOUNT}/${SLUG}`);
  if (!app?.ownerAccount) throw new Error("Could not load Expo project.");

  const creds = await getDefaultAndroidAppBuildCredentialsAsync(graphqlClient, {
    account: app.ownerAccount,
    projectName: app.slug,
    androidApplicationIdentifier: PACKAGE,
  });

  const sha1 = creds?.androidKeystore?.sha1CertificateFingerprint;
  if (!sha1) {
    console.error("Could not read SHA-1. Open:");
    console.error(`https://expo.dev/accounts/${ACCOUNT}/projects/${SLUG}/credentials/android/${PACKAGE}`);
    process.exit(1);
  }

  const formatted = sha1.match(/.{2}/g)?.join(":").toUpperCase() ?? sha1;
  console.log("\nEAS production SHA-1:\n");
  console.log(formatted);
  console.log("\nAdd to Google Cloud → Credentials → Create OAuth client → Android:");
  console.log(`  Package: ${PACKAGE}`);
  console.log(`  SHA-1:   ${formatted}`);
  console.log("\nhttps://console.cloud.google.com/apis/credentials\n");
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
