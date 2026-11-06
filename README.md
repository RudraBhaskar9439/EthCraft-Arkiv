# EthCraft × Arkiv: public agent progress

**Live demo:** https://ethcraft-arkiv.quiet-buddy-9104.chatgpt.site

Inspect real Minecraft worker progress and owner-requested Agent-to-0G handoffs on **Arkiv Rabdi, chain 7794095**. The public website needs no wallet, Discord login, game client or EthCraft backend. Its server reads Arkiv with the official **SDK 1.0.1**. It never signs transactions or exposes game-control routes.

The existing game integration already wrote real records. The owner published a task with **four observed steps and three local effect receipts**, then requested a 0G handoff. The target read the published entity, retained the same private objective/owner and observed the world again. [Preserved native verification](evidence/owner-handoff.json). This proves the handoff/data flow, not completion or owner acceptance of the target's task.

The live board shows current records, their owner, expiry, exact JSON and handoff predecessors. Use **Read previous worker's progress** to fetch that specific entity again. Controlled data fixtures are labelled and hidden by default. If Arkiv is unavailable, the board says so; it does not show saved evidence as a live result.

## Run it yourself

Node 22.10+:

```sh
npm ci --ignore-scripts
npm run query
# Fetch the real source record used by the owner-driven handoff:
node scripts/query.mjs 0x358495b4ac6eed3e4851fa536e77d201ce0e505030a0212a82b8e8e713fa3947
npm test
npm run build
npm run dev
```

Preview: `http://127.0.0.1:8805`. The public demo is hosted separately and does not depend on that local server. A free Arkiv access key may be provided to the query CLI as `ARKIV_ACCESS_KEY`; public demo reads currently use the public rate-limited RPC.

**Entity writer:** `0x5a262B9621eD0F00Fe776bb85084E9561cF18608`.
**RPC:** `https://rpc.rabdi.db-chain.testnet.arkiv.network`.
**Deployment namespace:** `85f700ee06a3208b76d02f3aef30c330aca35dddab2daa1074f5281db9e3d501`.

The public reader in [`src/read.mjs`](src/read.mjs) executes:

```js
client.select('*').from(TaskProgress)
  .ownedBy('0x5a262B9621eD0F00Fe776bb85084E9561cF18608')
  .where(eq('server', '85f700ee06a3208b76d02f3aef30c330aca35dddab2daa1074f5281db9e3d501'))
  .orderBy(desc('revision')).limit(100).offset(0).fetch()
```

Anyone can run that query independently. The app validates the publisher and payload as well as the schema tag. Pagination exposes older history; each page shows its latest revision per worker job, not an exhaustive global claim.

## Publish a test record with your own wallet

The website is read-only. The separate operator CLI uses the extracted, durable publisher. Obtain **free tGLM on Rabdi** for a disposable test wallet through https://hub.arkiv.network/faucet. Keep its key in your local process environment as `ARKIV_PRIVATE_KEY`; never paste it into the site, repository or chat.

```sh
node scripts/publish-demo.mjs
# Read your wallet's records by setting its PUBLIC address:
ARKIV_PUBLISHER=0xYourPublicWalletAddress npm run query
```

This publishes a **controlled data fixture**, not real Minecraft work. Your records do not appear as the trusted game publisher's records on this deployment. The signing key never enters the web build. The publisher saves an intent and signed bytes before sending, reconciles the same transaction after uncertainty, checks the actual engine receipt and entity readback, and preserves its local journal. Limits: 0.1 tGLM reserved gas per transaction, 1 tGLM cumulative and 200 snapshots per journal. No CITY, mainnet money, lending or agent financial permissions are involved.

## Native game integration

The private EthCraft host uses the same progress projection and publisher behavior. The extracted [`integration/handoff.mjs`](integration/handoff.mjs) shows the owner/request boundary. It requires actual approved owner and objective services; it cannot create a fictitious approval. In Minecraft, the owner uses:

```text
/agent agent publish
/agent 0g board
/agent agent wait
/agent 0g handoff <source-job-UUID>
```

The source pauses; uncertain effects and unresolved locks block transfer. A durable handoff marker fences replay. The other worker reads the Arkiv entity, then rechecks the world and its own supplies under local permissions. Prompts, private reasoning, Discord/player identifiers, raw receipt contents and wallet authority are excluded from public records. A hash commits to local effect receipts; it is not independent proof of their truth.

## Track documentation and provenance

- [Schema, indexed fields, ownership and expiry](arkiv/schema.md)
- [Observed friction](arkiv/friction.md)
- [Reach and actual trial scope](arkiv/reach.md)
- [Why Arkiv](arkiv/why-arkiv.md)
- [How the app uses Arkiv](arkiv/how-you-use-arkiv.md)

**This is an extracted component of an existing project**, not a claim that all of EthCraft was built from scratch. [NOTICE](NOTICE) identifies the earlier source and reused helper. A public component and new hosting do not resolve ETHGlobal Build-from-Scratch eligibility; the existing-project track requires Continuity admission. The whole game repository remains private.

AI assisted research, code, tests and documentation. The source is [MIT licensed](LICENSE); dependencies retain their own licenses. Published observations are runtime-attested and expire after seven days; owners can delete them. A stored record cannot authorize a payment or independently accept work. Public hosting does not expose player signing keys or the native game API.
